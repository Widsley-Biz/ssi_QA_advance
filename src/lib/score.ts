import type { Skill, Answer, Level } from '../types';

/**
 * Calculate weighted score and achievement rate for a set of skills and answers.
 * - score_excluded skills (e.g. JSTQB pass) are excluded from calculation
 * - Unanswered skills count as 0 (included in denominator)
 * - Rate is floored to 2 decimal places
 */
export function calcRate(
  skills: Skill[],
  answers: Answer[],
): { got: number; max: number; rate: number } {
  const scorable = skills.filter(s => !s.score_excluded);
  const answerMap = new Map(answers.map(a => [a.skill_id, a.score]));
  const max = scorable.reduce((sum, s) => sum + s.weight * 5, 0);
  const got = scorable.reduce((sum, s) => sum + s.weight * (answerMap.get(s.id) || 0), 0);
  const rate = max > 0 ? Math.floor((got / max) * 10000) / 100 : 0;
  return { got, max, rate };
}

/**
 * Gate check for a level.
 * All skills must be answered AND all scores must be >= 3.
 */
export function checkGate(
  skills: Skill[],
  answers: Answer[],
): { allAnswered: boolean; allAbove3: boolean; gate: boolean } {
  const scorable = skills.filter(s => !s.score_excluded);
  const answerMap = new Map(answers.map(a => [a.skill_id, a.score]));
  const allAnswered = scorable.every(s => answerMap.has(s.id));
  const allAbove3 = scorable.every(s => (answerMap.get(s.id) || 0) >= 3);
  const gate = allAnswered && allAbove3;
  return { allAnswered, allAbove3, gate };
}

/**
 * Determine reached level for leveled courses.
 * Iterates levels in order; stops at the first failed gate.
 */
export function calcReachedLevel(
  levels: Level[],
  skills: Skill[],
  answers: Answer[],
): string {
  const sortedLevels = [...levels]
    .filter(l => l.kind === 'level')
    .sort((a, b) => a.sort_order - b.sort_order);
  let reached = '未到達';
  for (const level of sortedLevels) {
    const levelSkills = skills.filter(s => s.level_id === level.id);
    if (levelSkills.length === 0) continue;
    const { gate } = checkGate(levelSkills, answers);
    if (gate) {
      reached = level.name;
    } else {
      break;
    }
  }
  return reached;
}

/**
 * Check Academia graduation condition.
 * Requires: JSTQB FL passed AND achievement rate > 80%
 */
export function checkAcademiaGraduation(
  skills: Skill[],
  answers: Answer[],
): { jstqbPassed: boolean; rate: number; graduated: boolean } {
  const answerMap = new Map(answers.map(a => [a.skill_id, a.score]));

  // JSTQB FL pass check (binary question, score 5 = passed)
  const jstqbSkill = skills.find(s => s.score_excluded && s.answer_type === 'binary');
  const jstqbPassed = jstqbSkill ? (answerMap.get(jstqbSkill.id) || 0) === 5 : false;

  // Achievement rate (excluding JSTQB)
  const { rate } = calcRate(skills, answers);

  const graduated = jstqbPassed && rate > 80;
  return { jstqbPassed, rate, graduated };
}

/**
 * Get recommendation for next skills to improve.
 * Prioritizes: low score first, then low weight (= easier difficulty) first.
 */
export function getNextSkills(
  skills: Skill[],
  answers: Answer[],
  count = 5,
): Skill[] {
  const scorable = skills.filter(s => !s.score_excluded);
  const answerMap = new Map(answers.map(a => [a.skill_id, a.score]));
  return scorable
    .filter(s => (answerMap.get(s.id) || 0) < 3)
    .sort((a, b) => {
      const scoreA = answerMap.get(a.id) || 0;
      const scoreB = answerMap.get(b.id) || 0;
      // First by score ascending (lowest first), then by weight ascending (easiest first)
      return (scoreA - scoreB) || (a.weight - b.weight);
    })
    .slice(0, count);
}

/**
 * Build score snapshot for assessment submission.
 */
export function buildScoreSnapshot(
  course: { id: string; type: string },
  levels: Level[],
  skills: Skill[],
  answers: Answer[],
): Record<string, unknown> {
  const courseSkills = skills.filter(s => s.course_id === course.id);
  const courseAnswers = answers.filter(a => courseSkills.some(s => s.id === a.skill_id));
  const { rate } = calcRate(courseSkills, courseAnswers);

  if (course.type === 'single') {
    // Academia
    const { jstqbPassed, graduated } = checkAcademiaGraduation(courseSkills, courseAnswers);
    return {
      rate,
      jstqb_passed: jstqbPassed,
      academia_graduated: graduated,
    };
  } else {
    // Leveled courses
    const courseLevels = levels.filter(l => l.course_id === course.id);
    const reachedLevel = calcReachedLevel(courseLevels, courseSkills, courseAnswers);

    const levelGates: Record<string, boolean> = {};
    const sortedLevels = [...courseLevels]
      .filter(l => l.kind === 'level')
      .sort((a, b) => a.sort_order - b.sort_order);
    for (const level of sortedLevels) {
      const levelSkills = courseSkills.filter(s => s.level_id === level.id);
      if (levelSkills.length === 0) continue;
      const { gate } = checkGate(levelSkills, courseAnswers);
      levelGates[level.name] = gate;
    }

    return {
      rate,
      reached_level: reachedLevel,
      level_gates: levelGates,
    };
  }
}
