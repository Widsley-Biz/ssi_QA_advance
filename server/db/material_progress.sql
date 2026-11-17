-- ============================================================
-- material_progress.sql  –  教材(スライド)の視聴進捗
-- ============================================================
-- 2026-11-17 追加。既存テーブルは変更しない（追加のみ）。
--
-- exams.materials ([{id,label,url,pages}]) の各教材について、
-- ユーザーがどのページまで見たかを保持する。
--   viewed_pages … 実際に開いたページ番号の集合（重複なし）。
--     進捗率はこの集合の要素数 ÷ materials[].pages で計算する
--     （最高到達ページ方式だと、将来ページジャンプ機能を足した瞬間に
--      1クリックで100%になってしまうため採用しない）。
--   last_page    … 再開位置（次に開いたときにここから表示する）。
--   total_pages はここに持たない。exams.materials[].pages を正とする
--   （クライアント申告値をそのまま保存しない）。
-- ============================================================

CREATE TABLE IF NOT EXISTS material_progress (
  user_id      text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_id      text NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  material_id  text NOT NULL,
  viewed_pages int[] NOT NULL DEFAULT '{}',
  last_page    int NOT NULL DEFAULT 1,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exam_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_material_progress_exam ON material_progress(exam_id, material_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON material_progress TO app_user;
