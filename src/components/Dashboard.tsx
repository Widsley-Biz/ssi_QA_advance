import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { fetchSkills, fetchLevels, fetchAssessments, fetchAnswers } from '../lib/data';
import { calcRate, checkGate, calcReachedLevel, checkAcademiaGraduation, getNextSkills } from '../lib/score';
import type { Skill, Level, Assessment, Answer } from '../types';

const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const GRAY = '#e0e0e0';

interface Props {
  userId?: string; // for leader viewing a member's dashboard (via prop)
}

export default function Dashboard({ userId: propUserId }: Props) {
  const { course_id, userId: paramUserId } = useParams<{ course_id: string; userId?: string }>();
  const { user } = useAuth();
  const [courseSkills, setCourseSkills] = useState<Skill[]>([]);
  const [courseLevels, setCourseLevels] = useState<Level[]>([]);
  const [allAssessments, setAllAssessments] = useState<Assessment[]>([]);
  const [latestAnswers, setLatestAnswers] = useState<Answer[]>([]);
  const [prevAnswers, setPrevAnswers] = useState<Answer[]>([]);
  const [historyData, setHistoryData] = useState<{ date: string; rate: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);

  const targetUserId = propUserId || paramUserId || user?.id;

  useEffect(() => {
    if (!course_id || !targetUserId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [skills, levels, assessments] = await Promise.all([
          fetchSkills(course_id),
          fetchLevels(course_id),
          fetchAssessments(targetUserId, course_id),
        ]);

        if (cancelled) return;

        const sorted = [...assessments].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        setCourseSkills(skills);
        setCourseLevels(levels);
        setAllAssessments(sorted);

        // Load latest answers
        const latest = sorted[0];
        const latestAns = latest ? await fetchAnswers(latest.id) : [];
        if (cancelled) return;
        setLatestAnswers(latestAns);

        // Load previous answers for diff comparison
        const submitted = sorted.filter(a => a.status === 'submitted');
        if (submitted.length >= 2) {
          const prevAns = await fetchAnswers(submitted[1].id);
          if (cancelled) return;
          setPrevAnswers(prevAns);
        } else {
          setPrevAnswers([]);
        }

        // Build history for line chart
        const history: { date: string; rate: number }[] = [];
        for (const a of [...submitted].reverse()) {
          const aAns = await fetchAnswers(a.id);
          if (cancelled) return;
          const { rate } = calcRate(skills, aAns);
          history.push({
            date: a.submitted_at
              ? new Date(a.submitted_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
              : '-',
            rate,
          });
        }
        setHistoryData(history);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [course_id, targetUserId]);

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>読み込み中...</p>
      </div>
    );
  }

  if (!course_id || !user) {
    return <div style={styles.container}><p>データがありません</p></div>;
  }

  // Determine course type from levels (single = has category kind only or no levels)
  const hasLevelKind = courseLevels.some(l => l.kind === 'level');
  const courseType = hasLevelKind ? 'leveled' : 'single';

  const latestAssessment = allAssessments[0];
  const submittedAssessments = allAssessments.filter(a => a.status === 'submitted');

  const { rate: overallRate } = calcRate(courseSkills, latestAnswers);

  const donutData = [
    { name: '達成', value: overallRate },
    { name: '残り', value: Math.max(0, 100 - overallRate) },
  ];

  const prevAnswerMap = new Map(prevAnswers.map(a => [a.skill_id, a.score]));
  const latestAnswerMap = new Map(latestAnswers.map(a => [a.skill_id, a.score]));

  const breakdownData = [...courseLevels]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((lv) => {
      const lvSkills = courseSkills.filter(s => s.level_id === lv.id);
      const { rate } = calcRate(lvSkills, latestAnswers);
      const gate = checkGate(lvSkills, latestAnswers);
      return { name: lv.name, rate, gate: gate.gate, kind: lv.kind };
    });

  const reachedLevel = courseType === 'leveled'
    ? calcReachedLevel(courseLevels, courseSkills, latestAnswers)
    : null;

  const nextSkills = getNextSkills(courseSkills, latestAnswers, 3);

  // Academia graduation
  const academiaResult = courseType === 'single'
    ? checkAcademiaGraduation(courseSkills, latestAnswers)
    : null;

  // Diff arrow helper
  const getDiffIndicator = (skillId: number): { arrow: string; color: string } => {
    if (prevAnswers.length === 0) return { arrow: '', color: GRAY };
    const prev = prevAnswerMap.get(skillId) ?? 0;
    const curr = latestAnswerMap.get(skillId) ?? 0;
    if (curr > prev) return { arrow: '↑', color: '#16a34a' };
    if (curr < prev) return { arrow: '↓', color: '#dc2626' };
    return { arrow: '→', color: '#9ca3af' };
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>マイダッシュボード</h1>

        {/* Overall ring + status */}
        <div style={styles.ringSection}>
          <div style={styles.ringCard}>
            <div style={styles.ringWrapper}>
              <PieChart width={180} height={180}>
                <Pie
                  data={donutData}
                  innerRadius={60}
                  outerRadius={80}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                >
                  <Cell fill={SEA_GREEN} />
                  <Cell fill={GRAY} />
                </Pie>
              </PieChart>
              <div style={styles.ringLabel}>
                <div style={styles.ringPercent}>{overallRate}%</div>
                <div style={styles.ringSubLabel}>総合達成率</div>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 220 }}>
              {/* Academia: graduation + JSTQB */}
              {courseType === 'single' && academiaResult && (
                <>
                  {/* JSTQB badge */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '6px 14px', borderRadius: 999, marginBottom: 8,
                    background: academiaResult.jstqbPassed ? '#dcfce7' : '#fee2e2',
                    color: academiaResult.jstqbPassed ? '#166534' : '#991b1b',
                    fontWeight: 800, fontSize: 13,
                  }}>
                    JSTQB FL: {academiaResult.jstqbPassed ? '取得済み' : 'まだ'}
                  </div>
                  <br />
                  {/* Graduation badge */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '7px 14px', borderRadius: 999,
                    background: academiaResult.graduated ? '#E7F6EE' : '#FFF3E0',
                    color: academiaResult.graduated ? '#1F8F58' : '#B97A1F',
                    fontWeight: 800, fontSize: 13.5, marginBottom: 12,
                  }}>
                    {academiaResult.graduated ? '卒業' : 'Academia生'}
                  </div>
                  <div style={{ fontSize: 13.5, color: '#46546A', lineHeight: 1.7 }}>
                    卒業条件：JSTQB FL 取得済み ＋ 総合達成率 <strong>80%</strong> 以上
                  </div>
                  {/* 80% threshold bar */}
                  <div style={{ marginTop: 8, position: 'relative', height: 8, background: '#e5e7eb', borderRadius: 4 }}>
                    <div style={{
                      height: '100%', borderRadius: 4, width: `${Math.min(overallRate, 100)}%`,
                      background: overallRate >= 80 ? SEA_GREEN : CYAN,
                    }} />
                    <div style={{
                      position: 'absolute', left: '80%', top: -4, width: 2, height: 16,
                      background: '#ef4444',
                    }} />
                    <div style={{ position: 'absolute', left: '80%', top: 18, fontSize: 10, color: '#ef4444', transform: 'translateX(-50%)' }}>
                      80%
                    </div>
                  </div>
                </>
              )}

              {/* Leveled course: reached level */}
              {courseType === 'leveled' && reachedLevel && (
                <>
                  <div style={{ fontSize: 12.5, color: '#8893A4', fontWeight: 700, marginBottom: 4 }}>現在の到達レベル</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: CYAN, marginBottom: 8 }}>{reachedLevel}</div>
                  <div style={{ fontSize: 13, color: '#46546A', lineHeight: 1.7 }}>
                    各レベルは「すべて評価3以上」で到達
                  </div>
                </>
              )}

              {latestAssessment && (
                <div style={styles.statusBadge}>
                  提出済み
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trend line chart */}
        {historyData.length >= 2 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>達成率の推移</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={historyData} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={CYAN}
                  strokeWidth={2.5}
                  dot={{ fill: CYAN, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Breakdown chart */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            {courseType === 'leveled' ? 'レベル別達成率' : 'カテゴリ別達成率'}
          </h2>

          {courseType === 'leveled' && (
            <div style={styles.gateBadges}>
              {breakdownData.filter(d => d.kind === 'level').map((d) => (
                <span
                  key={d.name}
                  style={{
                    ...styles.gateBadge,
                    background: d.gate ? '#dcfce7' : '#fee2e2',
                    color: d.gate ? '#166534' : '#991b1b',
                  }}
                >
                  {d.gate ? '✓' : '✗'} {d.name}
                </span>
              ))}
            </div>
          )}

          <ResponsiveContainer width="100%" height={breakdownData.length * 40 + 40}>
            <BarChart data={breakdownData} layout="vertical" margin={{ left: 80, right: 20 }}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="rate" fill={CYAN} radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Answer detail section */}
        <div style={styles.section}>
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setDetailOpen(!detailOpen)}
          >
            <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>回答詳細</h2>
            <button style={{
              background: `${CYAN}15`, color: CYAN, border: `1px solid ${CYAN}40`,
              borderRadius: 8, padding: '5px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              {detailOpen ? '閉じる' : '詳細'}
            </button>
          </div>
          {detailOpen && (
            <div style={{ marginTop: 16, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5eef5' }}>
                    <th style={thStyle}>スキル</th>
                    <th style={thStyle}>カテゴリ</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>スコア</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>重み</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>加重点</th>
                    {prevAnswers.length > 0 && (
                      <th style={{ ...thStyle, textAlign: 'center' }}>前回比</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {courseSkills
                    .sort((a, b) => a.no - b.no)
                    .map((skill) => {
                      const ans = latestAnswers.find(a => a.skill_id === skill.id);
                      const score = ans?.score ?? 0;
                      const isBinary = skill.answer_type === 'binary' && skill.score_excluded;
                      const displayScore = isBinary ? (score === 5 ? '合格' : 'まだ') : `${score}/5`;
                      const weightedScore = skill.score_excluded ? '-' : `${(score * skill.weight).toFixed(1)}`;
                      const diff = getDiffIndicator(skill.id);
                      const level = courseLevels.find(l => l.id === skill.level_id);
                      return (
                        <tr key={skill.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={tdStyle}>{skill.name}</td>
                          <td style={tdStyle}>{level?.name ?? skill.category}</td>
                          <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{displayScore}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {skill.score_excluded ? '-' : skill.weight}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{weightedScore}</td>
                          {prevAnswers.length > 0 && (
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: diff.color }}>
                              {diff.arrow}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Next skills */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>次に伸ばすスキル</h2>
          {nextSkills.length === 0 ? (
            <p style={{ color: '#999', fontSize: 14 }}>全スキルが高水準です。</p>
          ) : (
            <div style={styles.nextList}>
              {nextSkills.map((s, i) => {
                const ans = latestAnswers.find((a) => a.skill_id === s.id);
                const score = ans?.score ?? 0;
                const diff = getDiffIndicator(s.id);
                return (
                  <div key={s.id} style={styles.nextItem}>
                    <div style={styles.nextRank}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={styles.nextName}>
                        {s.name}
                        {prevAnswers.length > 0 && (
                          <span style={{ marginLeft: 8, fontWeight: 800, color: diff.color }}>{diff.arrow}</span>
                        )}
                      </div>
                      <div style={styles.nextMeta}>
                        {s.category} ・ 重み {s.weight} ・ 現在スコア: {score}/5
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History table */}
        {submittedAssessments.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>提出履歴</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5eef5' }}>
                  <th style={thStyle}>提出日</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>達成率</th>
                </tr>
              </thead>
              <tbody>
                {historyData.length > 0
                  ? [...historyData].reverse().map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={tdStyle}>{h.date}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{h.rate}%</td>
                      </tr>
                    ))
                  : submittedAssessments.map((a) => (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={tdStyle}>
                          {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('ja-JP') : '-'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>-</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        )}

        {/* Tip */}
        <div style={styles.tipBox}>
          <div style={{ fontSize: 13, fontWeight: 800, color: CYAN, marginBottom: 6 }}>リーダーとの面談メモに</div>
          <div style={{ fontSize: 13.5, color: '#46546A', lineHeight: 1.7 }}>
            この結果をもとに、次に伸ばすスキルや学習内容を相談しましょう。
          </div>
        </div>
      </div>
    </div>
  );
}

// Table cell styles
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 6px',
  fontSize: 12,
  fontWeight: 700,
  color: '#8893A4',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 6px',
  fontSize: 13,
  color: DEEP_BLUE,
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: 'calc(100vh - 56px)',
    padding: '24px 16px 48px',
  },
  content: {
    maxWidth: 700,
    margin: '0 auto',
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: DEEP_BLUE,
    marginBottom: 24,
  },
  ringSection: {
    marginBottom: 24,
  },
  ringCard: {
    display: 'flex',
    gap: 22,
    alignItems: 'center',
    background: '#fff',
    border: '1px solid #e5eef5',
    borderRadius: 18,
    padding: 24,
    flexWrap: 'wrap' as const,
  },
  ringWrapper: {
    position: 'relative',
    width: 180,
    height: 180,
  },
  ringLabel: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center' as const,
  },
  ringPercent: {
    fontSize: 32,
    fontWeight: 800,
    color: DEEP_BLUE,
  },
  ringSubLabel: {
    fontSize: 11,
    color: '#999',
  },
  statusBadge: {
    marginTop: 12,
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 700,
    color: CYAN,
    background: `${CYAN}15`,
    padding: '3px 12px',
    borderRadius: 10,
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
  gateBadges: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
    marginBottom: 16,
  },
  gateBadge: {
    fontSize: 12,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 8,
  },
  nextList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  nextItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    background: '#f0f6fa',
    borderRadius: 8,
  },
  nextRank: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${SEA_GREEN}, ${CYAN})`,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 13,
    flexShrink: 0,
  },
  nextName: {
    fontWeight: 700,
    fontSize: 14,
    color: DEEP_BLUE,
  },
  nextMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  tipBox: {
    marginTop: 10,
    padding: '18px 20px',
    background: `${CYAN}10`,
    border: `1px solid ${CYAN}25`,
    borderRadius: 16,
  },
};
