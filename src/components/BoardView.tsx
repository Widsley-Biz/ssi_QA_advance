import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { fetchProfiles, fetchTeams, fetchCourses, fetchAssessments, fetchAnswers, fetchSkills, fetchLevels } from '../lib/data';
import { calcRate, calcReachedLevel } from '../lib/score';
import type { Profile, Team, Course, Skill, Level, Assessment, Answer } from '../types';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const SHADES = ['#50DAB0', '#3DB7E4', '#03202F', '#E21776'];

interface ScoreRow {
  id: string;
  name: string;
  teamName: string;
  courseRates: Record<string, { rate: number; level: string }>;
  lastSubmitted: string;
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

  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<number | 'all'>('all');

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
      setProfiles(p); // already excludes retired in data layer
      setSkills(s);
      setLevels(l);
      setAssessments(a);

      if (c.length > 0 && !selectedCourse) {
        setSelectedCourse(c[0].id);
      }

      // Load answers for all submitted assessments
      const submitted = a.filter(as => as.status === 'submitted');
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

  if (loading) {
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

  const filteredProfiles = selectedTeam === 'all'
    ? profiles
    : profiles.filter(p => p.team_id === selectedTeam);

  const activeCourse = courses.find(c => c.id === selectedCourse);

  // Build score rows
  const scoreRows: ScoreRow[] = filteredProfiles.map((p) => {
    const team = teams.find(t => t.id === p.team_id);
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
      teamName: team?.name ?? '-',
      courseRates,
      lastSubmitted: latestDate
        ? new Date(latestDate).toLocaleDateString('ja-JP')
        : '未提出',
    };
  });

  // Level distribution for selected course
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

  // Team average rates for selected course
  const teamAvgData = teams.map((team) => {
    const members = profiles.filter(p => p.team_id === team.id);
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

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>全社ダッシュボード</h1>

        <div style={styles.filterRow}>
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
          <div>
            <label style={styles.filterLabel}>チーム:</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={styles.select}
            >
              <option value="all">全チーム</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Score table */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>全社得点一覧</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={styles.th}>氏名</th>
                  <th style={styles.th}>チーム</th>
                  {courses.map(c => (
                    <th key={c.id} style={styles.th} colSpan={c.type === 'leveled' ? 2 : 1}>
                      {c.name}
                    </th>
                  ))}
                  <th style={styles.th}>最終提出日</th>
                </tr>
                <tr>
                  <th style={styles.thSub}></th>
                  <th style={styles.thSub}></th>
                  {courses.map(c => (
                    c.type === 'leveled' ? (
                      <React.Fragment key={c.id}>
                        <th style={styles.thSub}>達成率</th>
                        <th style={styles.thSub}>レベル</th>
                      </React.Fragment>
                    ) : (
                      <th key={c.id} style={styles.thSub}>達成率</th>
                    )
                  ))}
                  <th style={styles.thSub}></th>
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
                    <tr key={row.id} style={styles.tr}>
                      <td style={{ ...styles.td, fontWeight: 600, color: DEEP_BLUE }}>{row.name}</td>
                      <td style={styles.td}>{row.teamName}</td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={styles.chartsRow}>
          {activeCourse?.type === 'leveled' && levelDistribution.length > 0 && (
            <div style={{ ...styles.section, flex: 1 }}>
              <h2 style={styles.sectionTitle}>レベル別人数サマリー</h2>
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

          <div style={{ ...styles.section, flex: 1 }}>
            <h2 style={styles.sectionTitle}>チーム別平均達成率</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={teamAvgData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="avg" fill={CYAN} radius={[4, 4, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Admin */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>管理</h2>
          <div style={styles.adminPlaceholder}>
            <div style={styles.adminCard}>
              <h3 style={styles.adminCardTitle}>ユーザー管理</h3>
              <p style={styles.adminCardDesc}>ユーザーの追加・編集・ロール変更</p>
              <div style={styles.adminCount}>{profiles.length}名</div>
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
    marginBottom: 20,
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
  filterRow: {
    display: 'flex',
    gap: 20,
    marginBottom: 24,
    flexWrap: 'wrap' as const,
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
  section: {
    background: '#fff',
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 20,
    boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: DEEP_BLUE,
    marginBottom: 16,
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
  thSub: {
    padding: '6px 14px',
    textAlign: 'left' as const,
    fontSize: 11,
    fontWeight: 600,
    color: '#999',
    borderBottom: '1px solid #eee',
    background: '#fafbfc',
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
