import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchSkills, fetchLevels, fetchCourses, fetchLatestAnswers, submitAssessment } from '../lib/data';
import { buildScoreSnapshot } from '../lib/score';
import type { Skill, Level, Course, Answer } from '../types';

// Widsley brand colors
const DEEP_BLUE = '#03202F';
const CYAN = '#3DB7E4';
const SEA_GREEN = '#50DAB0';
const MAGENTA = '#E21776';
const GRADIENT = 'linear-gradient(135deg, #50DAB0, #3DB7E4)';

// Bubble config: score 1 (left/small) to score 5 (right/large)
const bubbleConfig = [
  { score: 1, size: 28, mobileSz: 22, color: CYAN },
  { score: 2, size: 32, mobileSz: 26, color: '#6CBCDA' },
  { score: 3, size: 36, mobileSz: 30, color: '#999' },
  { score: 4, size: 40, mobileSz: 34, color: '#6FCFB8' },
  { score: 5, size: 44, mobileSz: 38, color: SEA_GREEN },
];

export default function QuizFlow() {
  const { course_id } = useParams<{ course_id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Async data state
  const [skills, setSkills] = useState<Skill[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [answerMap, setAnswerMap] = useState<Record<number, number>>({});
  const [hoveredBubble, setHoveredBubble] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Load skills, levels, course, and previous answers
  useEffect(() => {
    if (!course_id || !user) return;
    let cancelled = false;

    (async () => {
      try {
        const [fetchedSkills, fetchedLevels, fetchedCourses, prevAnswers] = await Promise.all([
          fetchSkills(course_id),
          fetchLevels(course_id),
          fetchCourses(),
          fetchLatestAnswers(user.id, course_id),
        ]);

        if (cancelled) return;

        setSkills(fetchedSkills);
        setLevels(fetchedLevels);
        setCourse(fetchedCourses.find(c => c.id === course_id) ?? null);

        // Pre-fill previous answers as initial values
        if (prevAnswers.length > 0) {
          const initial: Record<number, number> = {};
          prevAnswers.forEach((a: Answer) => { initial[a.skill_id] = a.score; });
          setAnswerMap(initial);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [course_id, user]);

  // Sort skills by level sort_order then skill no
  const courseSkills = [...skills].sort((a, b) => {
    const la = levels.find((l) => l.id === a.level_id);
    const lb = levels.find((l) => l.id === b.level_id);
    return (la?.sort_order ?? 0) - (lb?.sort_order ?? 0) || a.no - b.no;
  });

  const total = courseSkills.length;
  const answeredCount = Object.keys(answerMap).length;
  const progress = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  const handleSelect = (skillId: number, score: number) => {
    const newMap = { ...answerMap, [skillId]: score };
    setAnswerMap(newMap);

    // Auto-scroll to next unanswered question
    const skillIndex = courseSkills.findIndex((s) => s.id === skillId);
    const nextIndex = skillIndex + 1;
    if (nextIndex < courseSkills.length && !(courseSkills[nextIndex].id in newMap)) {
      setTimeout(() => {
        questionRefs.current[nextIndex]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 200);
    }
  };

  const handleSubmit = async () => {
    if (!user || !course_id || !course || submitting) return;
    setSubmitting(true);
    try {
      // Build answers array for score snapshot
      const answersArray: Answer[] = Object.entries(answerMap).map(([skillId, score], i) => ({
        id: i,
        assessment_id: 0,
        skill_id: Number(skillId),
        score,
      }));

      const snapshot = buildScoreSnapshot(course, levels, skills, answersArray);
      await submitAssessment(user.id, course_id, answerMap, snapshot);
      navigate(`/course/${course_id}/dashboard`);
    } catch (err) {
      console.error('Submit failed:', err);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: DEEP_BLUE }}>読み込み中...</p>
      </div>
    );
  }

  if (courseSkills.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: DEEP_BLUE }}>スキルが見つかりません</p>
      </div>
    );
  }

  // Group skills by level/category for section headers
  let lastLevelId: number | null = null;

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: '#fff' }}>
      {/* Sticky progress bar */}
      <div style={{
        height: 5,
        background: '#eee',
        position: 'sticky',
        top: 56,
        zIndex: 50,
      }}>
        <div style={{
          height: '100%',
          background: GRADIENT,
          borderRadius: '0 2px 2px 0',
          transition: 'width 0.4s ease',
          width: `${progress}%`,
        }} />
      </div>

      {/* Sticky counter bar */}
      <div style={{
        position: 'sticky',
        top: 61,
        zIndex: 49,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #eee',
        padding: '10px 0',
      }}>
        <div style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#888' }}>
              回答済み <b style={{ color: DEEP_BLUE }}>{answeredCount}</b> / {total}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: CYAN, fontWeight: 600 }}>興味はある</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {bubbleConfig.map((b) => (
                <div key={b.score} style={{
                  width: Math.max(4, b.size / 6),
                  height: Math.max(4, b.size / 6),
                  borderRadius: '50%',
                  background: b.color,
                  opacity: 0.6,
                }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: SEA_GREEN, fontWeight: 600 }}>人に教えられる</span>
          </div>
        </div>
      </div>

      {/* Questions list */}
      <div style={{
        maxWidth: 680,
        margin: '0 auto',
        padding: isMobile ? '16px 16px 60px' : '24px 20px 80px',
      }}>
        {courseSkills.map((skill, idx) => {
          const level = levels.find((l) => l.id === skill.level_id);
          const isAnswered = skill.id in answerMap;
          const selectedScore = answerMap[skill.id] ?? null;

          // Section header when level changes
          let showSectionHeader = false;
          if (skill.level_id !== lastLevelId) {
            showSectionHeader = true;
            lastLevelId = skill.level_id;
          }

          return (
            <div key={skill.id}>
              {/* Section header */}
              {showSectionHeader && (
                <div style={{
                  padding: idx === 0 ? '0 0 16px' : '32px 0 16px',
                  borderBottom: `2px solid ${SEA_GREEN}30`,
                  marginBottom: 20,
                }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                    background: GRADIENT,
                    padding: '5px 14px',
                    borderRadius: 999,
                  }}>
                    {level?.name}
                  </span>
                </div>
              )}

              {/* Question row */}
              <div
                ref={(el) => { questionRefs.current[idx] = el; }}
                style={{
                  position: 'relative',
                  padding: '20px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                {/* Question text (top, left-aligned) */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: CYAN,
                      background: `${CYAN}12`,
                      padding: '2px 8px',
                      borderRadius: 6,
                    }}>
                      {skill.category}
                    </span>
                    <span style={{ fontSize: 12, color: '#bbb' }}>
                      {idx + 1}/{total}
                    </span>
                    {isAnswered && (
                      <span style={{ fontSize: 11, color: SEA_GREEN, fontWeight: 700 }}>✓</span>
                    )}
                    {/* Difficulty display */}
                    {skill.importance != null && skill.importance > 0 && (
                      <span style={{
                        fontSize: 11,
                        color: '#F5A623',
                        letterSpacing: 1,
                      }}>
                        難易度 {'★'.repeat(skill.importance)}
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: isMobile ? 15 : 16,
                    fontWeight: 700,
                    color: DEEP_BLUE,
                    lineHeight: 1.5,
                    marginBottom: 2,
                  }}>
                    {skill.name}
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: '#888',
                    lineHeight: 1.6,
                  }}>
                    {skill.description}
                  </div>
                  {skill.ref_note && (
                    <div style={{ fontSize: 12, color: MAGENTA, marginTop: 2 }}>
                      {skill.ref_note}
                    </div>
                  )}
                </div>

                {/* Answer row */}
                {skill.answer_type === 'binary' ? (
                  /* Binary choice (e.g. JSTQB certification) */
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: isMobile ? 12 : 20,
                  }}>
                    {[
                      { score: 5, label: '合格', color: SEA_GREEN },
                      { score: 1, label: 'まだ', color: CYAN },
                    ].map((opt) => {
                      const isSelected = selectedScore === opt.score;
                      const hoverKey = `${skill.id}-${opt.score}`;
                      const isHovered = hoveredBubble === hoverKey;
                      return (
                        <button
                          key={opt.score}
                          onClick={() => handleSelect(skill.id, opt.score)}
                          onMouseEnter={() => setHoveredBubble(hoverKey)}
                          onMouseLeave={() => setHoveredBubble(null)}
                          style={{
                            padding: isMobile ? '10px 28px' : '12px 40px',
                            fontSize: isMobile ? 14 : 16,
                            fontWeight: 700,
                            color: isSelected ? '#fff' : opt.color,
                            background: isSelected ? opt.color : isHovered ? `${opt.color}15` : 'transparent',
                            border: `2px solid ${isSelected || isHovered ? opt.color : '#ddd'}`,
                            borderRadius: 999,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            outline: 'none',
                            transform: isHovered && !isSelected ? 'scale(1.05)' : 'scale(1)',
                          }}
                          aria-label={opt.label}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Standard 5-bubble scale */
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: isMobile ? 8 : 14,
                  }}>
                    <span style={{
                      fontSize: isMobile ? 10 : 12,
                      color: CYAN,
                      fontWeight: 600,
                      minWidth: isMobile ? 54 : 72,
                      textAlign: 'right',
                      lineHeight: 1.3,
                      flexShrink: 0,
                    }}>
                      興味はある
                    </span>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: isMobile ? 10 : 16,
                    }}>
                      {bubbleConfig.map((b) => {
                        const isSelected = selectedScore === b.score;
                        const hoverKey = `${skill.id}-${b.score}`;
                        const isHovered = hoveredBubble === hoverKey;
                        const sz = isMobile ? b.mobileSz : b.size;

                        return (
                          <button
                            key={b.score}
                            onClick={() => handleSelect(skill.id, b.score)}
                            onMouseEnter={() => setHoveredBubble(hoverKey)}
                            onMouseLeave={() => setHoveredBubble(null)}
                            style={{
                              width: sz,
                              height: sz,
                              borderRadius: '50%',
                              border: `2px solid ${isSelected ? b.color : isHovered ? b.color : '#ddd'}`,
                              background: isSelected
                                ? b.color
                                : isHovered
                                  ? `${b.color}20`
                                  : 'transparent',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              padding: 0,
                              outline: 'none',
                              flexShrink: 0,
                              transform: isHovered && !isSelected ? 'scale(1.1)' : 'scale(1)',
                            }}
                            aria-label={`スコア ${b.score}`}
                          />
                        );
                      })}
                    </div>

                    <span style={{
                      fontSize: isMobile ? 10 : 12,
                      color: SEA_GREEN,
                      fontWeight: 600,
                      minWidth: isMobile ? 54 : 72,
                      textAlign: 'left',
                      lineHeight: 1.3,
                      flexShrink: 0,
                    }}>
                      人に教えられる
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Submit section */}
        <div
          id="quiz-submit"
          style={{
            textAlign: 'center',
            padding: '48px 0 32px',
          }}
        >
          {answeredCount > 0 ? (
            <>
              <div style={{
                fontSize: 14,
                color: '#888',
                marginBottom: 16,
              }}>
                {answeredCount === total
                  ? '全ての質問に回答しました！'
                  : `${answeredCount} / ${total} 問に回答済み（未回答でも提出できます）`}
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: '14px 48px',
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#fff',
                  background: submitting ? '#bbb' : GRADIENT,
                  border: 'none',
                  borderRadius: 999,
                  cursor: submitting ? 'default' : 'pointer',
                  boxShadow: submitting ? 'none' : `0 6px 18px ${CYAN}40`,
                  transition: 'transform 0.15s',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? '送信中...' : '結果を見る →'}
              </button>
            </>
          ) : (
            <div style={{
              fontSize: 14,
              color: '#bbb',
              padding: '20px 0',
            }}>
              1問以上回答すると提出できます
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
