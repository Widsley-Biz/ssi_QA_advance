-- ============================================================
-- 試験に複数の「予定(開催回)」を持たせられるようにする
-- ============================================================
-- 背景: 従来は exams.opens_at / closes_at / max_attempts が1試験につき1つしか
--       持てず、同じ社内認定試験を複数のグループに別日程で同時に走らせる
--       ことができなかった(管理画面でも1試験=1予定しか見れない・セットできない)。
--
-- 設計方針(アドバイザーと合意):
--   - 完全に追加のみ。exam_schedules に1件も行が無い試験は、従来通り
--     exams.opens_at / closes_at / max_attempts / exam_targets だけで動く
--     (「レガシー予定」。既存の全試験はこのまま壊れずに動く)。
--   - 試験に exam_schedules 行が1件でもできた時点で、その試験は
--     「複数予定モード」になり、以後は exam_schedules の各行だけを見る
--     (exams側の opens_at/closes_at/max_attempts は参照されなくなる)。
--     モード切替時には、既存のレガシー予定とexam_targetsを
--     exam_schedules の1行目としてコピーし、紐付く未割当のexam_attemptsの
--     schedule_idをその行に向ける(アプリ側のロジックで実施。このSQLでは
--     テーブル定義のみ)。
--   - exam_attempts.schedule_id: NULL = レガシー予定での受験。
--     NULLでなければ、その予定(exam_schedules行)に対する受験回数上限・
--     結果公開タイミングの基準になる。
--   - 予定の削除は、紐づくexam_attemptsが無い場合のみ許可する
--     (アプリ側で保証。受験記録のある予定を消すと受験回数集計や
--     結果公開の基準が失われるため)。
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_schedules (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exam_id      text NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  label        text NOT NULL DEFAULT '',                 -- 管理画面表示用（例:「2026年12月 Aグループ」）
  opens_at     timestamptz,                               -- NULL = 常時公開（開始側）
  closes_at    timestamptz,                               -- NULL = 常時公開・結果は提出後すぐ表示
  max_attempts int CHECK (max_attempts IS NULL OR max_attempts > 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_schedule_targets (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schedule_id bigint NOT NULL REFERENCES exam_schedules(id) ON DELETE CASCADE,
  email       text NOT NULL,
  UNIQUE (schedule_id, email)
);

ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS schedule_id bigint REFERENCES exam_schedules(id);

CREATE INDEX IF NOT EXISTS idx_exam_schedules_exam ON exam_schedules(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedule_targets_schedule ON exam_schedule_targets(schedule_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_schedule ON exam_attempts(schedule_id);
