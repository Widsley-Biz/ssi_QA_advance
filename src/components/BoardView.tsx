import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

type SectionKey = 'skillmap' | 'courseProgress' | 'examResults' | 'daily' | 'charts' | 'admin';
const COLLAPSE_STORAGE_KEY = 'dashboard-collapsed-sections';
/** 試験結果カードの選択中試験。/exams/result/:id への遷移→戻るで選択が消えないように保持する */
const SELECTED_EXAM_STORAGE_KEY = 'dashboard-selected-exam';

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

/**
 * 行ベースのセクション(スキルマップ達成率・講座学習進捗・デイリー学習進捗・試験結果)
 * 共通の検索・ソート。値なし(null)は昇順・降順どちらでも常に末尾に来る。
 * 文字列の比較は日本語ロケールで行う。同じ列を3回目クリックするとソート解除(今日のまま)。
 */
type SortDir = 'asc' | 'desc';

function compareNullable(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'ja');
}

/**
 * 検索語・ソート列・ソート方向の状態だけを持つ(計算はしない)。
 * BoardViewはローディング中に早期returnするため、実データに依存する行配列を
 * 引数に取る形のフックにすると「ローディング中はフックを呼ばない」ことになり
 * Hooksのルール違反になる。状態と計算を分離し、計算(applySortAndSearch)は
 * 早期returnの後、実データが揃ってから呼び出す
 */
function useSortAndSearchState(initialSortKey: string | null = null) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialSortKey ? 'desc' : 'asc');

  const handleSortClick = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
  };

  return { query, setQuery, sortKey, sortDir, handleSortClick };
}

function applySortAndSearch<T>(
  rows: T[],
  state: { query: string; sortKey: string | null; sortDir: SortDir },
  opts: { searchText: (row: T) => string; sorters: Record<string, (row: T) => string | number | null> },
): T[] {
  const q = state.query.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => opts.searchText(r).toLowerCase().includes(q)) : rows;

  const getValue = state.sortKey ? opts.sorters[state.sortKey] : null;
  if (!getValue) return filtered;

  const withValue = filtered.filter((r) => getValue(r) != null);
  const withNull = filtered.filter((r) => getValue(r) == null);
  withValue.sort((a, b) => {
    const cmp = compareNullable(getValue(a), getValue(b));
    return state.sortDir === 'asc' ? cmp : -cmp;
  });
  return [...withValue, ...withNull];
}

function SortableTh({
  label, sortKey, activeKey, dir, onClick, style,
}: {
  label: string; sortKey: string; activeKey: string | null; dir: SortDir; onClick: (key: string) => void; style?: React.CSSProperties;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      style={{ ...style, cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onClick(sortKey)}
      title="クリックで並べ替え"
    >
      {label}{active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );
}

function SectionSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? '氏名・チームで検索'}
      style={styles.sectionSearch}
    />
  );
}

export default function BoardView() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [materialsSummary, setMaterialsSummary] = useState<MaterialsSummaryRow[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity | null>(null);

  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<number | 'all' | 'unassigned'>('all');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    try {
      return localStorage.getItem(SELECTED_EXAM_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(loadCollapsedSections);

  // デイリー学習進捗・試験結果(どちらもテーブル)のソート・検索状態(フックなので
  // ローディング中の早期returnより前で、無条件に呼び出す必要がある)
  const dailySort = useSortAndSearchState('when');
  const examResultSort = useSortAndSearchState('name');

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
        const [report, examList, matSummary, activity] = await Promise.all([
          getExamReport(),
          listExams(),
          fetchMaterialsSummary(),
          fetchDailyActivity(90),
        ]);
        setExamReport(report);
        setExamKindMap(new Map(examList.map((e) => [e.id, e.kind])));
        setExams(examList);
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
  const filteredIds = new Set(filteredProfiles.map((p) => p.id));

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

  // ---- 試験結果(社内認定試験を1つ選んで、受験者ごとの結果を見る) ----
  // 社内認定試験(category='certification')のみを対象にする。/admin/exam-scheduleと
  // 同じ絞り込み(模擬試験・学習教材はここでは扱わない)
  const certificationExams = exams
    .filter((e) => e.category === 'certification')
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  const activeExamResultId = selectedExamId || certificationExams[0]?.id || '';
  const selectExamResult = (id: string) => {
    setSelectedExamId(id);
    try {
      localStorage.setItem(SELECTED_EXAM_STORAGE_KEY, id);
    } catch {
      // プライベートウィンドウ等で失敗しても表示には影響しない
    }
  };

  type ExamResultRow = {
    userId: string; name: string; team: string;
    attemptCount: number; earnedPoints: number | null; totalPoints: number | null;
    passed: boolean | null; submittedAt: string | null;
  };
  const examResultCandidates = examReport.filter(
    (c) => c.exam_id === activeExamResultId && filteredIds.has(c.user_id),
  );
  const examResultExcludedCount = examResultCandidates.filter((c) => c.excluded).length;
  const examResultRawRows: ExamResultRow[] = examResultCandidates
    .filter((c) => !c.excluded)
    .map((c) => ({
      userId: c.user_id, name: c.display_name, team: teamNameOf(profiles.find((p) => p.id === c.user_id) ?? ({} as Profile)),
      attemptCount: c.attempt_count, earnedPoints: c.earned_points, totalPoints: c.total_points,
      passed: c.passed, submittedAt: c.submitted_at,
    }));
  const examResultRows = applySortAndSearch(examResultRawRows, examResultSort, {
    searchText: (r) => `${r.name} ${r.team}`,
    sorters: {
      name: (r) => r.name,
      team: (r) => r.team,
      attemptCount: (r) => r.attemptCount,
      score: (r) => r.earnedPoints,
      passed: (r) => (r.passed == null ? null : r.passed ? 1 : 0),
      submittedAt: (r) => (r.submittedAt ? new Date(r.submittedAt).getTime() : null),
    },
  });

  // ---- KPIタイル ----
  const writtenAttempted = filteredProfiles.filter((p) => writtenBadgeFor(p.id).label !== '未受験');
  const writtenPassed = writtenAttempted.filter((p) => writtenBadgeFor(p.id).label.includes('合格'));
  const practicalSubmittedCount = filteredProfiles.filter((p) => practicalBadgeFor(p.id).label === '提出済み').length;
  const materialsAvgPct = (() => {
    const pcts = filteredProfiles.flatMap((p) => materialGroupNames.map((g) => materialsPctFor(p.id, g)));
    return pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  })();

  // ---- デイリー学習進捗(テーブル) ----
  // key: 同一ユーザーが同時刻帯に複数件出すことは無いはずだが、念のため
  // userId+when+textで一意なキーを作る(React keyおよびドリルダウン開閉の対象行特定に使う)
  type FeedEvent = { key: string; userId: string; name: string; team: string; when: string; text: string; dot: string };
  const feedEvents: FeedEvent[] = [
    ...dailyActivity.examEvents
      .filter((e) => filteredIds.has(e.user_id))
      .map((e) => ({
        key: `exam-${e.user_id}-${e.exam_id}-${e.submitted_at}`,
        userId: e.user_id, name: e.display_name, team: teamNameOf(profiles.find((p) => p.id === e.user_id) ?? ({} as Profile)),
        when: e.submitted_at,
        text: e.kind === 'practical' ? `${e.exam_name}のPRを提出` : `${e.exam_name}に${e.passed ? '合格' : '不合格'}(${e.earned_points}点)`,
        dot: e.kind === 'practical' ? CYAN : e.passed ? '#0a7a5a' : '#c0185a',
      })),
    ...dailyActivity.skillmapEvents
      .filter((e) => filteredIds.has(e.user_id))
      .map((e) => ({
        key: `skillmap-${e.user_id}-${e.course_id}-${e.submitted_at}`,
        userId: e.user_id, name: e.display_name, team: teamNameOf(profiles.find((p) => p.id === e.user_id) ?? ({} as Profile)),
        when: e.submitted_at, text: `スキルマップ「${e.course_name}」を提出`, dot: MAGENTA,
      })),
    ...dailyActivity.materialDaily
      .filter((r) => filteredIds.has(r.user_id))
      .map((r) => {
        const p = profiles.find((pr) => pr.id === r.user_id);
        return {
          key: `material-${r.user_id}-${r.day}`,
          userId: r.user_id, name: p?.display_name ?? r.user_id, team: p ? teamNameOf(p) : '-',
          when: r.last_viewed_at, text: `教材を${r.pages}ページ新しく既読`, dot: SEA_GREEN,
        };
      }),
  ];

  const dailyRows = applySortAndSearch(feedEvents, dailySort, {
    searchText: (e) => `${e.name} ${e.team}`,
    sorters: {
      name: (e) => e.name,
      team: (e) => e.team,
      text: (e) => e.text,
      when: (e) => new Date(e.when).getTime(),
    },
  });

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
          <div style={styles.scrollBox}>
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
          <div style={styles.scrollBox}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={styles.thSticky}>氏名</th>
                  <th style={styles.thSticky}>チーム</th>
                  <th style={styles.thSticky}>座学模擬</th>
                  <th style={styles.thSticky}>実技模擬</th>
                  {materialGroupNames.map((g) => (
                    <th key={g} style={styles.thSticky}>{g}</th>
                  ))}
                  <th style={styles.thSticky}>最終更新</th>
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

        {/* カード3: 試験結果(社内認定試験を1つ選んで受験者一覧) */}
        <div style={styles.section}>
          <SectionHeader
            title="試験結果"
            note="試験を選択→氏名クリックで個人推移・行クリックで詳細"
            collapsed={!!collapsedSections.examResults}
            onToggle={() => toggleSection('examResults')}
          />
          {!collapsedSections.examResults && (
            certificationExams.length === 0 ? (
              <p style={{ color: '#999', fontSize: 13 }}>社内認定試験がまだありません</p>
            ) : (
              <>
                <p style={styles.hint}>
                  管理者(board)は集計対象外です。対象者限定の試験で対象外のメンバーは一覧から除外されます
                  {examResultExcludedCount > 0 && `(現在のチーム絞り込みで${examResultExcludedCount}名が対象外)`}。
                </p>
                <div style={styles.examResultControls}>
                  <select
                    value={activeExamResultId}
                    onChange={(e) => selectExamResult(e.target.value)}
                    style={{ ...styles.select, flex: '1 1 320px' }}
                  >
                    {certificationExams.map((e) => (
                      <option key={e.id} value={e.id}>{e.group_name ? `${e.group_name} / ` : ''}{e.name}</option>
                    ))}
                  </select>
                  <div style={{ flex: '1 1 260px' }}>
                    <SectionSearch value={examResultSort.query} onChange={examResultSort.setQuery} />
                  </div>
                </div>
                <div style={styles.scrollBox}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <SortableTh label="氏名" sortKey="name" activeKey={examResultSort.sortKey} dir={examResultSort.sortDir} onClick={examResultSort.handleSortClick} style={styles.thSticky} />
                        <SortableTh label="チーム" sortKey="team" activeKey={examResultSort.sortKey} dir={examResultSort.sortDir} onClick={examResultSort.handleSortClick} style={styles.thSticky} />
                        <SortableTh label="受験回数" sortKey="attemptCount" activeKey={examResultSort.sortKey} dir={examResultSort.sortDir} onClick={examResultSort.handleSortClick} style={styles.thSticky} />
                        <SortableTh label="最高得点" sortKey="score" activeKey={examResultSort.sortKey} dir={examResultSort.sortDir} onClick={examResultSort.handleSortClick} style={styles.thSticky} />
                        <SortableTh label="判定" sortKey="passed" activeKey={examResultSort.sortKey} dir={examResultSort.sortDir} onClick={examResultSort.handleSortClick} style={styles.thSticky} />
                        <SortableTh label="提出日時" sortKey="submittedAt" activeKey={examResultSort.sortKey} dir={examResultSort.sortDir} onClick={examResultSort.handleSortClick} style={styles.thSticky} />
                      </tr>
                    </thead>
                    <tbody>
                      {examResultRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: '#999', padding: 24 }}>
                            該当するメンバーがいません
                          </td>
                        </tr>
                      ) : (
                        examResultRows.map((r) => (
                          <React.Fragment key={r.userId}>
                            <tr
                              style={{ ...styles.tr, cursor: r.attemptCount > 0 ? 'pointer' : 'default' }}
                              onClick={() => {
                                const cell = examResultCandidates.find((c) => c.user_id === r.userId && c.attempt_id != null);
                                if (cell) navigate(`/exams/result/${cell.attempt_id}`);
                              }}
                            >
                              <td style={{ ...styles.td, ...styles.nameLink, fontWeight: 600, color: DEEP_BLUE }}
                                onClick={(e) => { e.stopPropagation(); setSelectedPerson(selectedPerson === r.userId ? null : r.userId); }}>
                                {r.name}
                              </td>
                              <td style={{ ...styles.td, color: r.team === '未所属' ? MAGENTA : '#333' }}>{r.team}</td>
                              <td style={styles.td}>{r.attemptCount}回</td>
                              <td style={styles.td}>
                                {r.attemptCount === 0 ? (
                                  <span style={{ color: '#999' }}>未受験</span>
                                ) : (
                                  `${r.earnedPoints} / ${r.totalPoints}点`
                                )}
                              </td>
                              <td style={styles.td}>
                                {r.passed == null ? '-' : (
                                  <span style={{ ...styles.badge, background: r.passed ? '#E8F7F1' : '#FDEBEF', color: r.passed ? '#0a7a5a' : '#c0185a' }}>
                                    {r.passed ? '合格' : '不合格'}
                                  </span>
                                )}
                              </td>
                              <td style={{ ...styles.td, color: '#999' }}>
                                {r.submittedAt ? new Date(r.submittedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}
                              </td>
                            </tr>
                            {selectedPerson === r.userId && (
                              <tr>
                                <td colSpan={6} style={{ padding: '8px 4px 16px' }}>
                                  <DrilldownChart
                                    userId={r.userId}
                                    displayName={r.name}
                                    teamLabel={r.team}
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
              </>
            )
          )}
        </div>

        {/* カード4: デイリー学習進捗 */}
        <div style={styles.section}>
          <SectionHeader
            title="デイリー学習進捗"
            note="氏名クリックで個人推移・列見出しクリックで並べ替え"
            collapsed={!!collapsedSections.daily}
            onToggle={() => toggleSection('daily')}
          />
          {!collapsedSections.daily && (
            feedEvents.length === 0 ? (
              <p style={{ color: '#999', fontSize: 13 }}>直近90日に記録された活動はありません</p>
            ) : (
              <>
                <SectionSearch value={dailySort.query} onChange={dailySort.setQuery} />
                <div style={styles.scrollBox}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <SortableTh label="氏名" sortKey="name" activeKey={dailySort.sortKey} dir={dailySort.sortDir} onClick={dailySort.handleSortClick} style={styles.thSticky} />
                        <SortableTh label="チーム" sortKey="team" activeKey={dailySort.sortKey} dir={dailySort.sortDir} onClick={dailySort.handleSortClick} style={styles.thSticky} />
                        <SortableTh label="学習内容" sortKey="text" activeKey={dailySort.sortKey} dir={dailySort.sortDir} onClick={dailySort.handleSortClick} style={styles.thSticky} />
                        <SortableTh label="学習日時" sortKey="when" activeKey={dailySort.sortKey} dir={dailySort.sortDir} onClick={dailySort.handleSortClick} style={styles.thSticky} />
                      </tr>
                    </thead>
                    <tbody>
                      {dailyRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: '#999', padding: 24 }}>
                            該当する活動がありません
                          </td>
                        </tr>
                      ) : (
                        dailyRows.map((ev) => (
                          <React.Fragment key={ev.key}>
                            <tr style={styles.tr}>
                              <td style={{ ...styles.td, ...styles.nameLink, fontWeight: 600, color: DEEP_BLUE }}
                                onClick={() => setSelectedPerson(selectedPerson === ev.userId ? null : ev.userId)}>
                                <span style={{ ...styles.feedDot, background: ev.dot, display: 'inline-block', marginRight: 8 }} />
                                {ev.name}
                              </td>
                              <td style={{ ...styles.td, color: ev.team === '未所属' ? MAGENTA : '#333' }}>{ev.team}</td>
                              <td style={styles.td}>{ev.text}</td>
                              <td style={{ ...styles.td, color: '#999' }}>
                                {new Date(ev.when).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                              </td>
                            </tr>
                            {selectedPerson === ev.userId && (
                              <tr>
                                <td colSpan={4} style={{ padding: '8px 4px 16px' }}>
                                  <DrilldownChart
                                    userId={ev.userId}
                                    displayName={ev.name}
                                    teamLabel={ev.team}
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
              </>
            )
          )}
        </div>

        <div style={styles.section}>
          <SectionHeader
            title="チーム別グラフ"
            collapsed={!!collapsedSections.charts}
            onToggle={() => toggleSection('charts')}
          />
          {!collapsedSections.charts && (
          <>
          <div style={{ marginBottom: 16 }}>
            <label style={styles.filterLabel}>コース(下のグラフの対象):</label>
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
          </>
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
  hint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 14,
    lineHeight: 1.6,
  },
  examResultControls: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    marginBottom: 12,
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
  scrollBox: {
    overflowX: 'auto',
    overflowY: 'auto',
    maxHeight: '65vh',
  },
  sectionSearch: {
    width: '100%',
    maxWidth: 320,
    padding: '8px 12px',
    fontSize: 13,
    border: '1px solid #ddd',
    borderRadius: 8,
    marginBottom: 12,
    boxSizing: 'border-box' as const,
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
