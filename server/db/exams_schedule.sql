-- ============================================================
-- exams_schedule.sql  –  試験の日程・対象者・受験回数制限・参考資料
-- ============================================================
-- 2026-11-16 追加。既に exams テーブルを作成済みのDBに対して実行する。
--
-- 【背景】
--   AirCourse（無料プランが2027/4/1から全ID課金化）の代替として、
--   社内学習アプリをSkillCheckに統合する。既存の自習用試験（いつでも・
--   誰でも・何度でも受験可）に加えて、日程と対象者を絞った「正式試験」を
--   実施できるようにする。
--
-- 【設計方針】
--   1. 追加カラムは全てNULL許容。既存の自習試験は何も設定しなければ
--      今まで通り「常時公開・誰でも・無制限」のまま動く
--   2. 対象者は profiles.id ではなく email で持つ。auth.ts の
--      ensureProfile はログイン時に初めて profiles 行を作るため、
--      一度もログインしていない人を事前に対象者指定できない
--   3. exam_targets に1件も行が無い試験 = 全員に公開（既存動作と同じ）。
--      1件以上あれば、そのemailのみ（boardは常に全件見える）。
--      → 絞り込み済みの試験の対象者を全員削除すると「全員公開」に
--        戻ってしまう点に注意。管理画面側で空保存時に確認を挟むこと
-- ============================================================

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS opens_at     timestamptz,
  ADD COLUMN IF NOT EXISTS closes_at    timestamptz,
  ADD COLUMN IF NOT EXISTS max_attempts int CHECK (max_attempts IS NULL OR max_attempts > 0),
  ADD COLUMN IF NOT EXISTS materials    jsonb;

COMMENT ON COLUMN exams.opens_at     IS 'NULL=常時公開。正式試験の受験開始日時';
COMMENT ON COLUMN exams.closes_at    IS 'NULL=常時公開。正式試験の受験終了日時。設定中は終了まで採点結果を非公開にする';
COMMENT ON COLUMN exams.max_attempts IS 'NULL=無制限。正式試験は1などに設定';
COMMENT ON COLUMN exams.materials    IS 'スライド等の参考資料。[{label,url,note}] 形式（guideのlinksと同形）';

CREATE TABLE IF NOT EXISTS exam_targets (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exam_id text NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  email   text NOT NULL,
  UNIQUE (exam_id, email)
);

CREATE INDEX IF NOT EXISTS idx_exam_targets_exam ON exam_targets(exam_id);

-- app_user がDDL権限を持たず postgres で上のCREATE TABLEを実行した場合は、
-- このGRANTも忘れず実行すること（本番APIはapp_userで接続している）
GRANT SELECT, INSERT, UPDATE, DELETE ON exam_targets TO app_user;
GRANT USAGE, SELECT ON SEQUENCE exam_targets_id_seq TO app_user;
