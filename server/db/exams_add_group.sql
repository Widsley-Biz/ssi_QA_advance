-- ============================================================
-- exams_add_group.sql  –  試験にジャンル（グループ）を追加
-- ============================================================
-- 2026-08-19 追加。既に exams テーブルを作成済みのDBに対して実行する。
-- 模擬試験を増やしていくため、一覧を「ジャンル → 試験」の2階層にする。
--   模擬試験 → Playwright社内試験 → セットA〜D
-- ============================================================

ALTER TABLE exams ADD COLUMN IF NOT EXISTS group_name text NOT NULL DEFAULT '';

-- 既存の4セットを「Playwright社内試験」にまとめる
UPDATE exams SET group_name = 'Playwright社内試験'
 WHERE id LIKE 'playwright-mock-written-%';

CREATE INDEX IF NOT EXISTS idx_exams_group ON exams(group_name, sort_order);
