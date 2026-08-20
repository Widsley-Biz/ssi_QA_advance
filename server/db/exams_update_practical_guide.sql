-- ============================================================
-- 実技模擬の案内文の「OJT担当者」を「講師」に直す（2026-08-20）
--
--   Cloud SQL Studio にこの1本を貼って Run するだけ。
--   guide(jsonb) の文言しか触らないので、列もテーブルも変わらない。
--   これが「文言はSQL 1本で直せる」設計の意図した使い方。
-- ============================================================

UPDATE exams
   SET guide = jsonb_set(
         jsonb_set(
           jsonb_set(guide,
             '{steps,4,body}',
             to_jsonb(replace(guide #>> '{steps,4,body}', 'OJT担当者', '講師'))),
           '{grading}',
           to_jsonb(replace(guide ->> 'grading', 'OJT担当者', '講師'))),
         '{answers_policy}',
         to_jsonb(replace(guide ->> 'answers_policy', 'OJT担当者', '講師')))
 WHERE id = 'playwright-mock-practical'
   AND kind = 'practical';

-- 置換できたか確認（0件になっていれば成功）
SELECT count(*) AS 残っているOJT担当者
  FROM exams
 WHERE kind = 'practical' AND guide::text LIKE '%OJT担当者%';
