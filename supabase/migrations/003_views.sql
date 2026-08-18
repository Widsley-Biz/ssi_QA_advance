-- ============================================================
-- 003_views.sql  –  Aggregate views
-- ============================================================

-- --------------------------------------------------------
-- v_assessment_score
--   Per assessment: weighted score and rate (0-100%)
--   Excludes skills marked score_excluded = true
-- --------------------------------------------------------
CREATE OR REPLACE VIEW v_assessment_score AS
SELECT
  a.id            AS assessment_id,
  a.user_id,
  a.course_id,
  a.submitted_at,
  SUM(ans.score * s.weight)              AS weighted_score,
  SUM(
    CASE s.answer_type
      WHEN 'scale5' THEN 5.0 * s.weight
      WHEN 'binary'  THEN 1.0 * s.weight
    END
  )                                       AS max_possible,
  ROUND(
    SUM(ans.score * s.weight)
    / NULLIF(
        SUM(
          CASE s.answer_type
            WHEN 'scale5' THEN 5.0 * s.weight
            WHEN 'binary'  THEN 1.0 * s.weight
          END
        ), 0
      ) * 100
  , 1)                                    AS rate
FROM assessments a
JOIN answers ans ON ans.assessment_id = a.id
JOIN skills  s   ON s.id = ans.skill_id
WHERE s.score_excluded = false
GROUP BY a.id, a.user_id, a.course_id, a.submitted_at;

-- --------------------------------------------------------
-- v_level_gate
--   Per assessment x level: whether the gate is passed
--   Gate condition: every skill in the level scored >= 3
-- --------------------------------------------------------
CREATE OR REPLACE VIEW v_level_gate AS
SELECT
  a.id            AS assessment_id,
  a.user_id,
  a.course_id,
  l.id            AS level_id,
  l.name          AS level_name,
  l.sort_order    AS level_sort,
  COUNT(*)                              AS skill_count,
  COUNT(*) FILTER (WHERE ans.score >= 3) AS passed_count,
  (COUNT(*) = COUNT(*) FILTER (WHERE ans.score >= 3)) AS gate_passed
FROM assessments a
JOIN answers ans ON ans.assessment_id = a.id
JOIN skills  s   ON s.id = ans.skill_id
JOIN levels  l   ON l.id = s.level_id
WHERE s.score_excluded = false
GROUP BY a.id, a.user_id, a.course_id, l.id, l.name, l.sort_order;

-- --------------------------------------------------------
-- v_team_summary
--   Per team x course: member count, average rate
--   Uses the latest assessment per user per course
-- --------------------------------------------------------
CREATE OR REPLACE VIEW v_team_summary AS
WITH latest_assessment AS (
  SELECT DISTINCT ON (user_id, course_id)
    id AS assessment_id,
    user_id,
    course_id,
    submitted_at
  FROM assessments
  ORDER BY user_id, course_id, submitted_at DESC
)
SELECT
  p.team_id,
  t.name           AS team_name,
  la.course_id,
  COUNT(DISTINCT la.user_id)  AS member_count,
  ROUND(AVG(vs.rate), 1)     AS avg_rate
FROM latest_assessment la
JOIN profiles p           ON p.id = la.user_id
JOIN teams    t           ON t.id = p.team_id
LEFT JOIN v_assessment_score vs ON vs.assessment_id = la.assessment_id
WHERE p.team_id IS NOT NULL
GROUP BY p.team_id, t.name, la.course_id;
