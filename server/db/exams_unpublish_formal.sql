-- ============================================================
-- exams_unpublish_formal.sql  –  正式試験2件を一旦非公開に戻す（2026-11-16）
-- ============================================================
-- jstqb-final-confirmation / playwright-written-prod は、対象者・日程を
-- 何も設定していない状態でis_published=trueだったため、全ユーザーに
-- 公開されてしまっていた（exam_targetsが0件＝全員対象という自習試験の
-- 既定動作が、正式試験にもそのまま適用されてしまったのが原因）。
--
-- 一旦非公開（board以外には出ない）に戻す。/admin/exam-schedule で
-- 対象者・日程を設定したあと、同じ画面の「公開する」で表示できる。
-- ============================================================

UPDATE exams
   SET is_published = false
 WHERE id IN ('jstqb-final-confirmation', 'playwright-written-prod');

SELECT id, name, is_published FROM exams
 WHERE id IN ('jstqb-final-confirmation', 'playwright-written-prod');
