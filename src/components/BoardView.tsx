import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { fetchProfiles, fetchTeams, fetchCourses, fetchAssessments, fetchAnswers, fetchSkills, fetchLevels, isInTeam } from '../lib/data';
import { calcRate, calcReachedLevel } from '../lib/score';
import { getExamReport, listExams, type ExamReportCell, type ExamSummary } from '../lib/exams';
import { fetchMaterialsSummary, fetchDailyActivity, type MaterialsSummaryRow, type DailyActivity } from '../lib/dashboard';
import DrilldownChart from './DrilldownChart';
import type { Profile, Team, Course, Skill, Level, Assessment, Answer } from '../types';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const MAGENTA = '#E21776';
const SHADES = ['#50DAB0', '#3DB7E4', '#03202F', '#E21776'];

/** 座学模擬・実技模擬の列はこのグループに限定する(現状アプリ内で座学/実技に分かれているのはPlaywrightのみ) */
const WRITTEN_PRACTICAL_GROUP = 'Playwright社内試験模擬（座学・実技）';

interface ScoreRow {
  id: string;
  name: string;
  teamName: string;
  courseRates: Record<string, { rate: number; level: string }>;
  lastSubmitted: string;
}

function profileTeamIds(p: Profile): (number | string)[] {
  if (p.team_ids) return p.team_ids;
  return p.team_id != null ? [p.team_id] : [];
}

type SectionKey = 'skillmap' | 'courseProgress' | 'daily' | 'charts' | 'admin';
const COLLAPSE_STORAGE_KEY = 'dashboard-collapsed-sections';

function loadCollapsedSections(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function SectionHeader({ title, note, collapsed, onToggle }: {
  title: string; note?: string; collapsed: boolean; onToggle: () => void;
}) {
  return (
    <div style={styles.sectionHead}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {note && <span style={styles.sectionNote}>{note}</span>}
        <span style={styles.collapseToggle} onClick={onToggle}>
          {collapsed ? '展開 ▸' : '折りたたむ ▾'}
        </span>
      </div>
    </div>
  );
}

export default function BoardView() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [answersMap, setAnswersMap] = useState<Record<number, Answer[]>>({});
  const [examReport, setExamReport] = useState<ExamReportCell[]>([]);
  const [examKindMap, setExamKindMap] = useState<Map<string, ExamSummary['kind']>>(new Map());
  const [materialsSummary, setMaterialsSummary] = useState<MaterialsSummaryRow[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity | null>(null);

  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<number | 'all' | 'unassigned'>('all');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(loadCollapsedSections);

  const toggleSection = (key: SectionKey) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // プライベートウィンドウ等で失敗しても表示には影響しない
      }
      return next;
    });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, t, p, s, l, a] = await Promise.all([
        fetchCourses(),
        fetchTeams(),
        fetchProfiles(),
        fetchSkills(),
        fetchLevels(),
        fetchAssessments(),
      ]);
      setCourses(c);
      setTeams(t);
      // 管理者(role=board)は進捗・集計の対象外。退職者は既にdata層で除外済み
      setProfiles(p.filter((pr) => pr.role !== 'board'));
      setSkills(s);
      setLevels(l);
      setAssessments(a);

      if (c.length > 0 && !selectedCourse) {
        setSelectedCourse(c[0].id);
      }

      // 試験レポート・教材進捗・デイリー活動はexams.ts系API専用(デモモード非対応)。
      // デモモードやAPI未設定時でもスキルマップ側は使えるよう、ここだけ個別にcatchする
      try {
        const [report, exams, matSummary, activity] = await Promise.all([
          getExamReport(),
          listExams(),
          fetchMaterialsSummary(),
          fetchDailyActivity(90),
        ]);
        setExamReport(report);
        setExamKindMap(new Map(exams.map((e) => [e.id, e.kind])));
        setMaterialsSummary(matSummary);
        setDailyActivity(activity);
      } catch (err) {
        console.error('Failed to load exam/material dashboard data:', err);
        setDailyActivity({ examEvents: [], skillmapEvents: [], materialDaily: [], recordStart: null });
      }

      const submitted = a.filter((as) => as.status === 'submitted');
      const ansMap: Record<number, Answer[]> = {};
      await Promise.all(
        submitted.map(async (as) => {
          ansMap[as.id] = await fetchAnswers(as.id);
        })
      );
      setAnswersMap(ansMap);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!user || user.role !== 'board') {
    return <div style={styles.container}><p>アクセス権限がありません</p></div>;
  }

  if (loading || !dailyActivity) {
    return (
      <div style={styles.container}>
        <div style={styles.content}>
          <div style={styles.loadingBox}>
            <div style={styles.spinner} />
            <p style={{ color: '#999', marginTop: 12 }}>読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  const unassignedProfiles = profiles.filter((p) => profileTeamIds(p).length === 0);

  const filteredProfiles = selectedTeam === 'all'
    ? profiles
    : selectedTeam === 'unassigned'
      ? unassignedProfiles
      : profiles.filter((p) => isInTeam(p, selectedTeam));

  const activeCourse = courses.find(c => c.id === selectedCourse);

  const teamNameOf = (p: Profile): string => {
    if (profileTeamIds(p).length === 0) return '未所属';
    const team = teams.find(t => t.id === p.team_id);
    return team?.name ?? '-';
  };

  // ---- スキルマップ達成率 ----
  const scoreRows: ScoreRow[] = filteredProfiles.map((p) => {
    const courseRates: ScoreRow['courseRates'] = {};
    let latestDate = '';

    for (const course of courses) {
      const courseSkills = skills.filter(s => s.course_id === course.id);
      const courseLevels = levels.filter(l => l.course_id === course.id);

      const latestSubmitted = assessments
        .filter(a => a.user_id === p.id && a.course_id === course.id && a.status === 'submitted')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      const pAnswers = latestSubmitted ? (answersMap[latestSubmitted.id] ?? []) : [];
      const { rate } = calcRate(courseSkills, pAnswers);
      const reachedLevel = course.type === 'leveled'
        ? calcReachedLevel(courseLevels, courseSkills, pAnswers)
        : '-';

      courseRates[course.id] = { rate, level: reachedLevel };

      if (latestSubmitted?.submitted_at) {
        if (!latestDate || new Date(latestSubmitted.submitted_at) > new Date(latestDate)) {
          latestDate = latestSubmitted.submitted_at;
        }
      }
    }

    return {
      id: p.id,
      name: p.display_name,
      teamName: teamNameOf(p),
      courseRates,
      lastSubmitted: latestDate
        ? new Date(latestDate).toLocaleDateString('ja-JP')
        : '未提出',
    };
  });

  const levelDistribution = activeCourse?.type === 'leveled'
    ? (() => {
        const courseLevels = levels.filter(l => l.course_id === selectedCourse);
        const courseSkills = skills.filter(s => s.course_id === selectedCourse);
        const levelNames = courseLevels
          .filter(l => l.kind === 'level')
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(l => l.name);
        const dist: Record<string, number> = { '未到達': 0 };
        levelNames.forEach(n => { dist[n] = 0; });

        filteredProfiles.forEach((p) => {
          const latestSubmitted = assessments
            .filter(a => a.user_id === p.id && a.course_id === selectedCourse && a.status === 'submitted')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          const pAns = latestSubmitted ? (answersMap[latestSubmitted.id] ?? []) : [];
          const reached = calcReachedLevel(courseLevels, courseSkills, pAns);
          dist[reached] = (dist[reached] || 0) + 1;
        });

        return Object.entries(dist).map(([name, count]) => ({ name, count }));
      })()
    : [];

  const teamAvgData = teams.map((team) => {
    const members = profiles.filter(p => isInTeam(p, team.id));
    const courseSkills = skills.filter(s => s.course_id === selectedCourse);
    const rates = members.map(m => {
      const latestSubmitted = assessments
        .filter(a => a.user_id === m.id && a.course_id === selectedCourse && a.status === 'submitted')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const mAns = latestSubmitted ? (answersMap[latestSubmitted.id] ?? []) : [];
      return calcRate(courseSkills, mAns).rate;
    });
    const avg = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
    return { name: team.name, avg };
  });

  // ---- 講座学習進捗(座学模擬・実技模擬・教材) ----
  const materialGroupNames = Array.from(new Set(materialsSummary.map((r) => r.group_name))).sort();

  function writtenBadgeFor(userId: string) {
    const cells = examReport.filter(
      (c) => c.user_id === userId && c.group_name === WRITTEN_PRACTICAL_GROUP &&
        examKindMap.get(c.exam_id) === 'written' && !c.excluded && c.attempt_id != null,
    );
    if (cells.length === 0) return { label: '未受験', bg: '#f0f0f0', color: '#888' };
    const best = cells.reduce((a, b) => ((b.earned_points ?? 0) > (a.earned_points ?? 0) ? b : a));
    return best.passed
      ? { label: `${best.earned_points}点・合格`, bg: '#E8F7F1', color: '#0a7a5a' }
      : { label: `${best.earned_points}点・不合格`, bg: '#FDEBEF', color: '#c0185a' };
  }

  function practicalBadgeFor(userId: string) {
    const submitted = examReport.some(
      (c) => c.user_id === userId && c.group_name === WRITTEN_PRACTICAL_GROUP &&
        examKindMap.get(c.exam_id) === 'practical' && !c.excluded && c.attempt_id != null,
    );
    return submitted
      ? { label: '提出済み', bg: '#E8F7F1', color: '#0a7a5a' }
      : { label: '未提出', bg: '#f0f0f0', color: '#888' };
  }

  function materialsPctFor(userId: string, groupName: string): number {
    const row = materialsSummary.find((r) => r.user_id === userId && r.group_name === groupName);
    if (!row || row.total_pages === 0) return 0;
    return Math.round((row.viewed_pages / row.total_pages) * 100);
  }

  function lastExamUpdateFor(userId: string): string {
    const dates = examReport
      .filter((c) => c.user_id === userId && c.group_name === WRITTEN_PRACTICAL_GROUP && c.submitted_at)
      .map((c) => new Date(c.submitted_at as string).getTime());
    if (dates.length === 0) return '-';
    return new Date(Math.max(...dates)).toLocaleDateString('ja-JP');
  }

  // ---- KPIタイル ----
  const writtenAttempted = filteredProfiles.filter((p) => writtenBadgeFor(p.id).label !== '未受験');
  const writtenPassed = writtenAttempted.filter((p) => writtenBadgeFor(p.id).label.includes('合格'));
  const practicalSubmittedCount = filteredProfiles.filter((p) => practicalBadgeFor(p.id).label === '提出済み').length;
  const materialsAvgPct = (() => {
    const pcts = filteredProfiles.flatMap((p) => materialGroupNames.map((g) => materialsPctFor(p.id, g)));
    return pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  })();

  // ---- デイリー学習進捗 ----
  const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const yesterdayStr = (() => {
    const d = new Date(`${todayStr}T00:00:00+09:00`);
    d.setDate(d.getDate() - 1);
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(d);
  })();

  type FeedEvent = { userId: string; name: string; team: string; day: string; text: string; dot: string };
  const filteredIds = new Set(filteredProfiles.map((p) => p.id));
  const feedEvents: FeedEvent[] = [
    ...dailyActivity.examEvents
      .filter((e) => filteredIds.has(e.user_id))
      .map((e) => ({
        userId: e.user_id, name: e.display_name, team: teamNameOf(profiles.find((p) => p.id === e.user_id) ?? ({} as Profile)),
        day: e.day,
        text: e.kind === 'practical' ? `${e.exam_name}のPRを提出` : `${e.exam_name}に${e.passed ? '合格' : '不合格'}(${e.earned_points}点)`,
        dot: e.kind === 'practical' ? CYAN : e.passed ? '#0a7a5a' : '#c0185a',
      })),
    ...dailyActivity.skillmapEvents
      .filter((e) => filteredIds.has(e.user_id))
      .map((e) => ({
        userId: e.user_id, name: e.display_name, team: teamNameOf(profiles.find((p) => p.id === e.user_id) ?? ({} as Profile)),
        day: e.day, text: `スキルマップ「${e.course_name}」を提出`, dot: MAGENTA,
      })),
    ...dailyActivity.materialDaily
      .filter((r) => filteredIds.has(r.user_id))
      .map((r) => {
        const p = profiles.find((pr) => pr.id === r.user_id);
        return {
          userId: r.user_id, name: p?.display_name ?? r.user_id, team: p ? teamNameOf(p) : '-',
          day: r.day, text: `教材を${r.pages}ページ新しく既読`, dot: SEA_GREEN,
        };
      }),
  ].sort((a, b) => (a.day < b.day ? 1 : -1));

  const feedGroups = [
    { label: `今日(${todayStr.slice(5)})`, events: feedEvents.filter((e) => e.day === todayStr) },
    { label: `前日(${yesterdayStr.slice(5)})`, events: feedEvents.filter((e) => e.day === yesterdayStr) },
    { label: 'それ以前', events: feedEvents.filter((e) => e.day < yesterdayStr) },
  ].filter((g) => g.events.length > 0);

  const selectedProfile = selectedPerson ? profiles.find((p) => p.id === selectedPerson) : null;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>ダッシュボード</h1>
        <p style={styles.subtitle}>管理者限定</p>

        {/* KPIタイル */}
        <div style={styles.kpiRow}>
          <div style={styles.kpiCard}>
            <div style={styles.kpiNumber}>{profiles.length}<span style={styles.kpiUnit}>名</span></div>
            <div style={styles.kpiLabel}>受講者数</div>
            <div style={styles.kpiNote}>管理者は除く・未所属含む</div>
          </div>
          <div style={{ ...styles.kpiCard, border: `1px solid ${MAGENTA}40` }}>
            <div style={{ ...styles.kpiNumber, color: MAGENTA }}>{unassignedProfiles.length}<span style={styles.kpiUnit}>名</span></div>
            <div style={styles.kpiLabel}>チーム未所属</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={{ ...styles.kpiNumber, color: '#0a7a5a' }}>{writtenPassed.length}<span style={styles.kpiUnit}>/{writtenAttempted.length} 合格</span></div>
            <div style={styles.kpiLabel}>座学模擬</div>
            <div style={styles.kpiNote}>受験済みのうち合格した人数</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiNumber}>{practicalSubmittedCount}<span style={styles.kpiUnit}>/{filteredProfiles.length} 提出</span></div>
            <div style={styles.kpiLabel}>実技模擬</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiNumber}>{materialsAvgPct}<span style={styles.kpiUnit}>%</span></div>
            <div style={styles.kpiLabel}>教材(スライド)閲覧率平均</div>
            <div style={styles.kpiNote}>動画は対象外</div>
          </div>
        </div>

        <div style={styles.filterRow}>
          <div>
            <label style={styles.filterLabel}>チーム:</label>
            <span
              onClick={() => setSelectedTeam('all')}
              style={{ ...styles.chip, ...(selectedTeam === 'all' ? styles.chipActive : {}) }}
            >全チーム</span>
            {teams.map((t) => (
              <span
                key={t.id}
                onClick={() => setSelectedTeam(t.id)}
                style={{ ...styles.chip, ...(selectedTeam === t.id ? styles.chipActive : {}) }}
              >{t.name}</span>
            ))}
            <span
              onClick={() => setSelectedTeam('unassigned')}
              style={{ ...styles.chip, ...(selectedTeam === 'unassigned' ? styles.chipActive : {}) }}
            >未所属</span>
          </div>
          <div>
            <label style={styles.filterLabel}>コース:</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              style={styles.select}
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* カード1: スキルマップ達成率 */}
        <div style={styles.section}>
          <SectionHeader
            title="スキルマップ達成率"
            note="氏名クリックで個人推移"
            collapsed={!!collapsedSections.skillmap}
            onToggle={() => toggleSection('skillmap')}
          />
          {!collapsedSections.skillmap && (
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '65vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={styles.thCorner}>氏名</th>
                  <th style={styles.thSticky}>チーム</th>
                  {courses.map(c => (
                    <th key={c.id} style={styles.thSticky} colSpan={c.type === 'leveled' ? 2 : 1}>
                      {c.name}
                    </th>
                  ))}
                  <th style={styles.thSticky}>最終提出日</th>
                </tr>
                <tr>
                  <th style={styles.thSubCorner}></th>
                  <th style={styles.thSubSticky}></th>
                  {courses.map(c => (
                    c.type === 'leveled' ? (
                      <React.Fragment key={c.id}>
                        <th style={styles.thSubSticky}>達成率</th>
                        <th style={styles.thSubSticky}>レベル</th>
                      </React.Fragment>
                    ) : (
                      <th key={c.id} style={styles.thSubSticky}>達成率</th>
                    )
                  ))}
                  <th style={styles.thSubSticky}></th>
                </tr>
              </thead>
              <tbody>
                {scoreRows.length === 0 ? (
                  <tr>
                    <td colSpan={99} style={{ textAlign: 'center', color: '#999', padding: 24 }}>
                      データがありません
                    </td>
                  </tr>
                ) : (
                  scoreRows.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr style={styles.tr}>
                        <td style={{ ...styles.tdSticky, ...styles.nameLink, fontWeight: 600, color: DEEP_BLUE }}
                          onClick={() => setSelectedPerson(selectedPerson === row.id ? null : row.id)}>
                          {row.name}
                        </td>
                        <td style={{ ...styles.td, color: row.teamName === '未所属' ? MAGENTA : '#333' }}>{row.teamName}</td>
                        {courses.map(c => {
                          const cr = row.courseRates[c.id];
                          return c.type === 'leveled' ? (
                            <React.Fragment key={c.id}>
                              <td style={styles.td}>
                                <div style={styles.rateCell}>
                                  <div style={styles.rateBar}>
                                    <div style={{ ...styles.rateBarFill, width: `${cr?.rate ?? 0}%` }} />
                                  </div>
                                  <span style={styles.rateText}>{cr?.rate ?? 0}%</span>
                                </div>
                              </td>
                              <td style={styles.td}>
                                <span style={styles.levelBadge}>{cr?.level ?? '-'}</span>
                              </td>
                            </React.Fragment>
                          ) : (
                            <td key={c.id} style={styles.td}>
                              <div style={styles.rateCell}>
                                <div style={styles.rateBar}>
                                  <div style={{ ...styles.rateBarFill, width: `${cr?.rate ?? 0}%` }} />
                                </div>
                                <span style={styles.rateText}>{cr?.rate ?? 0}%</span>
                              </div>
                            </td>
                          );
                        })}
                        <td style={styles.td}>{row.lastSubmitted}</td>
                      </tr>
                      {selectedPerson === row.id && selectedProfile && (
                        <tr>
                          <td colSpan={99} style={{ padding: '8px 4px 16px' }}>
                            <DrilldownChart
                              userId={row.id}
                              displayName={row.name}
                              teamLabel={row.teamName}
                              activity={dailyActivity}
                              onClose={() => setSelectedPerson(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* カード2: 講座学習進捗 */}
        <div style={styles.section}>
          <SectionHeader
            title="講座学習進捗"
            note="旧「試験レポート」。氏名クリックで個人推移"
            collapsed={!!collapsedSections.courseProgress}
            onToggle={() => toggleSection('courseProgress')}
          />
          {!collapsedSections.courseProgress && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={styles.th}>氏名</th>
                  <th style={styles.th}>チーム</th>
                  <th style={styles.th}>座学模擬</th>
                  <th style={styles.th}>実技模擬</th>
                  {materialGroupNames.map((g) => (
                    <th key={g} style={styles.th}>{g}</th>
                  ))}
                  <th style={styles.th}>最終更新</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((p) => {
                  const written = writtenBadgeFor(p.id);
                  const practical = practicalBadgeFor(p.id);
                  return (
                    <React.Fragment key={p.id}>
                      <tr style={styles.tr}>
                        <td style={{ ...styles.td, ...styles.nameLink, fontWeight: 600, color: DEEP_BLUE }}
                          onClick={() => setSelectedPerson(selectedPerson === p.id ? null : p.id)}>
                          {p.display_name}
                        </td>
                        <td style={{ ...styles.td, color: teamNameOf(p) === '未所属' ? MAGENTA : '#333' }}>{teamNameOf(p)}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, background: written.bg, color: written.color }}>{written.label}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, background: practical.bg, color: practical.color }}>{practical.label}</span>
                        </td>
                        {materialGroupNames.map((g) => (
                          <td key={g} style={styles.td}>{materialsPctFor(p.id, g)}%</td>
                        ))}
                        <td style={{ ...styles.td, color: '#999' }}>{lastExamUpdateFor(p.id)}</td>
                      </tr>
                      {selectedPerson === p.id && (
                        <tr>
                          <td colSpan={99} style={{ padding: '8px 4px 16px' }}>
                            <DrilldownChart
                              userId={p.id}
                              displayName={p.display_name}
                              teamLabel={teamNameOf(p)}
                              activity={dailyActivity}
                              onClose={() => setSelectedPerson(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* カード3: デイリー学習進捗 */}
        <div style={styles.section}>
          <SectionHeader
            title="デイリー学習進捗"
            note="氏名クリックで個人推移"
            collapsed={!!collapsedSections.daily}
            onToggle={() => toggleSection('daily')}
          />
          {!collapsedSections.daily && (feedGroups.length === 0 ? (
            <p style={{ color: '#999', fontSize: 13 }}>直近90日に記録された活動はありません</p>
          ) : (
            feedGroups.map((grp) => (
              <div key={grp.label}>
                <span style={styles.dayGroupLabel}>{grp.label}</span>
                {grp.events.map((ev, i) => (
                  <React.Fragment key={`${ev.userId}-${i}`}>
                    <div style={styles.feedRow}>
                      <span style={{ ...styles.feedDot, background: ev.dot }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{ ...styles.nameLink, fontSize: 13, fontWeight: 700, color: DEEP_BLUE }}
                          onClick={() => setSelectedPerson(selectedPerson === ev.userId ? null : ev.userId)}
                        >
                          {ev.name}
                        </span>
                        <span style={{ fontSize: 11, color: '#9fb3bd', marginLeft: 6 }}>{ev.team}</span>
                        <div style={{ fontSize: 12, color: '#555', marginTop: 1 }}>{ev.text}</div>
                      </div>
                    </div>
                    {selectedPerson === ev.userId && (
                      <div style={{ padding: '0 0 16px 22px' }}>
                        <DrilldownChart
                          userId={ev.userId}
                          displayName={ev.name}
                          teamLabel={ev.team}
                          activity={dailyActivity}
                          onClose={() => setSelectedPerson(null)}
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            ))
          ))}
        </div>

        <div style={styles.section}>
          <SectionHeader
            title="チーム別グラフ"
            collapsed={!!collapsedSections.charts}
            onToggle={() => toggleSection('charts')}
          />
          {!collapsedSections.charts && (
          <div style={styles.chartsRow}>
            {activeCourse?.type === 'leveled' && levelDistribution.length > 0 && (
              <div style={{ flex: 1 }}>
                <h3 style={styles.subChartTitle}>レベル別人数サマリー</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={levelDistribution}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
                      {levelDistribution.map((_, i) => (
                        <Cell key={i} fill={SHADES[i % SHADES.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{ flex: 1 }}>
              <h3 style={styles.subChartTitle}>チーム別平均達成率</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={teamAvgData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="avg" fill={CYAN} radius={[4, 4, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
              <p style={{ fontSize: 11, color: '#9fb3bd', marginTop: 8 }}>チーム未所属は上の表で個別に確認できます(平均には含めません)</p>
            </div>
          </div>
          )}
        </div>

        {/* Admin */}
        <div style={styles.section}>
          <SectionHeader
            title="管理"
            collapsed={!!collapsedSections.admin}
            onToggle={() => toggleSection('admin')}
          />
          {!collapsedSections.admin && (
          <div style={styles.adminPlaceholder}>
            <div style={styles.adminCard}>
              <h3 style={styles.adminCardTitle}>ユーザー管理</h3>
              <p style={styles.adminCardDesc}>ユーザーの追加・編集・ロール変更</p>
              <div style={styles.adminCount}>{profiles.length}名(受講者)</div>
            </div>
            <div style={styles.adminCard}>
              <h3 style={styles.adminCardTitle}>チーム管理</h3>
              <p style={styles.adminCardDesc}>チームの作成・メンバー割り当て</p>
              <div style={styles.adminCount}>{teams.length}チーム</div>
            </div>
            <div style={styles.adminCard}>
              <h3 style={styles.adminCardTitle}>コース管理</h3>
              <p style={styles.adminCardDesc}>コース・スキルの編集</p>
              <div style={styles.adminCount}>{courses.length}コース</div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: 'calc(100vh - 56px)',
    padding: '24px 16px 48px',
  },
  content: {
    maxWidth: 1100,
    margin: '0 auto',
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: DEEP_BLUE,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#6b828c',
    marginBottom: 16,
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  spinner: {
    width: 32,
    height: 32,
    border: `3px solid #eee`,
    borderTop: `3px solid ${CYAN}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  kpiRow: {
    display: 'flex',
    gap: 14,
    flexWrap: 'wrap' as const,
    margin: '4px 0 20px',
  },
  kpiCard: {
    flex: '1 1 190px',
    background: '#fff',
    border: '1px solid #e1ebee',
    borderRadius: 12,
    padding: '14px 16px',
  },
  kpiNumber: {
    fontSize: 24,
    fontWeight: 800,
    color: DEEP_BLUE,
  },
  kpiUnit: {
    fontSize: 13,
    fontWeight: 600,
    color: '#6b828c',
    marginLeft: 2,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#6b828c',
    marginTop: 2,
  },
  kpiNote: {
    fontSize: 10,
    color: '#9fb3bd',
    marginTop: 4,
  },
  filterRow: {
    display: 'flex',
    gap: 20,
    marginBottom: 24,
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#555',
    marginRight: 8,
  },
  select: {
    padding: '8px 12px',
    fontSize: 14,
    border: '1px solid #ddd',
    borderRadius: 8,
    background: '#fff',
  },
  chip: {
    display: 'inline-block',
    cursor: 'pointer',
    userSelect: 'none' as const,
    fontSize: 12,
    fontWeight: 700,
    padding: '6px 14px',
    borderRadius: 999,
    background: '#fff',
    color: '#555',
    border: '1px solid #d7e2e8',
    marginRight: 8,
  },
  chipActive: {
    background: DEEP_BLUE,
    color: '#fff',
    border: `1px solid ${DEEP_BLUE}`,
  },
  nameLink: {
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationColor: 'transparent',
  },
  section: {
    background: '#fff',
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 20,
    boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
  },
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: DEEP_BLUE,
    marginBottom: 16,
  },
  sectionNote: {
    fontSize: 11,
    color: '#9fb3bd',
  },
  collapseToggle: {
    cursor: 'pointer',
    userSelect: 'none' as const,
    fontSize: 12,
    fontWeight: 700,
    color: CYAN,
    whiteSpace: 'nowrap' as const,
  },
  subChartTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: DEEP_BLUE,
    margin: '0 0 12px',
  },
  dayGroupLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: DEEP_BLUE,
    background: '#F4F8FA',
    padding: '4px 10px',
    borderRadius: 6,
    display: 'inline-block',
    margin: '14px 0 4px',
  },
  feedRow: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    padding: '10px 0',
    borderBottom: '1px solid #f3f6f7',
  },
  feedDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginTop: 6,
    flexShrink: 0,
  },
  badge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 8,
    whiteSpace: 'nowrap' as const,
  },
  chartsRow: {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap' as const,
  },
  th: {
    padding: '12px 14px',
    textAlign: 'left' as const,
    fontSize: 13,
    fontWeight: 700,
    color: DEEP_BLUE,
    borderBottom: '2px solid #eee',
    background: '#fafbfc',
    whiteSpace: 'nowrap' as const,
  },
  thSticky: {
    padding: '12px 14px',
    textAlign: 'left' as const,
    fontSize: 13,
    fontWeight: 700,
    color: DEEP_BLUE,
    borderBottom: '2px solid #eee',
    background: '#fafbfc',
    whiteSpace: 'nowrap' as const,
    position: 'sticky' as const,
    top: 0,
    zIndex: 2,
  },
  thSubSticky: {
    padding: '6px 14px',
    textAlign: 'left' as const,
    fontSize: 11,
    fontWeight: 600,
    color: '#999',
    borderBottom: '1px solid #eee',
    background: '#fafbfc',
    position: 'sticky' as const,
    top: 42,
    zIndex: 2,
  },
  thCorner: {
    padding: '12px 14px',
    textAlign: 'left' as const,
    fontSize: 13,
    fontWeight: 700,
    color: DEEP_BLUE,
    borderBottom: '2px solid #eee',
    borderRight: '1px solid #eee',
    background: '#fafbfc',
    whiteSpace: 'nowrap' as const,
    position: 'sticky' as const,
    top: 0,
    left: 0,
    zIndex: 3,
  },
  thSubCorner: {
    padding: '6px 14px',
    textAlign: 'left' as const,
    fontSize: 11,
    fontWeight: 600,
    color: '#999',
    borderBottom: '1px solid #eee',
    borderRight: '1px solid #eee',
    background: '#fafbfc',
    position: 'sticky' as const,
    top: 42,
    left: 0,
    zIndex: 3,
  },
  tr: {
    borderBottom: '1px solid #f0f0f0',
  },
  td: {
    padding: '10px 14px',
    fontSize: 13,
    color: '#333',
    whiteSpace: 'nowrap' as const,
  },
  tdSticky: {
    padding: '10px 14px',
    fontSize: 13,
    color: '#333',
    whiteSpace: 'nowrap' as const,
    position: 'sticky' as const,
    left: 0,
    zIndex: 1,
    background: '#fff',
    borderRight: '1px solid #f0f0f0',
  },
  levelBadge: {
    fontSize: 12,
    fontWeight: 700,
    background: `${CYAN}15`,
    color: CYAN,
    padding: '3px 10px',
    borderRadius: 8,
    display: 'inline-block',
  },
  rateCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  rateBar: {
    width: 60,
    height: 6,
    background: '#eee',
    borderRadius: 3,
  },
  rateBarFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${SEA_GREEN}, ${CYAN})`,
    borderRadius: 3,
  },
  rateText: {
    fontSize: 13,
    fontWeight: 600,
    color: CYAN,
    whiteSpace: 'nowrap' as const,
  },
  adminPlaceholder: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap' as const,
  },
  adminCard: {
    flex: '1 1 200px',
    background: `${CYAN}10`,
    border: `1px solid ${CYAN}25`,
    borderRadius: 10,
    padding: '16px 20px',
    minWidth: 180,
  },
  adminCardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: DEEP_BLUE,
    margin: '0 0 4px',
  },
  adminCardDesc: {
    fontSize: 12,
    color: '#888',
    margin: '0 0 12px',
  },
  adminCount: {
    fontSize: 24,
    fontWeight: 800,
    color: CYAN,
  },
};
