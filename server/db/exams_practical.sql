-- ============================================================
-- 模擬試験に「実技」を追加する（2026-08-20）
--
-- 筆記（written）はクリックすると出題が始まるが、実技（practical）は
-- 説明ページを1枚挟んで、GitHubリポジトリと練習サイトへ送り出す。
-- 採点はPRレビュー側で行うため、ここでは点数を持たない。
-- 代わりに「PRを提出した」という自己申告だけを記録する。
--
-- 既存テーブルは変更しない（列の追加のみ）。何度流しても同じ結果になる。
-- ============================================================

-- ---- exams に種別と実技用の案内を持たせる ----
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS kind  text NOT NULL DEFAULT 'written',
  ADD COLUMN IF NOT EXISTS guide jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_kind_check') THEN
    ALTER TABLE exams ADD CONSTRAINT exams_kind_check
      CHECK (kind IN ('written', 'practical'));
  END IF;
  -- 実技なのに案内が無いと、説明ページが空になって受講者が迷子になる
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_practical_needs_guide') THEN
    ALTER TABLE exams ADD CONSTRAINT exams_practical_needs_guide
      CHECK (kind <> 'practical' OR guide IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN exams.kind  IS 'written=クリックで出題が始まる / practical=説明ページを挟んで外部へ送る';
COMMENT ON COLUMN exams.guide IS '実技のときだけ使う案内。{intro, what_we_see[], steps[], links[], grading, answers_policy}';

-- ---- 実技の自己申告（点数は持たない） ----
CREATE TABLE IF NOT EXISTS exam_practical_submissions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exam_id      text NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pr_url       text NOT NULL DEFAULT '',
  note         text NOT NULL DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  -- 同じ試験を出し直すこともあるので1人1行に絞らない。
  -- ただし「連打で同じ秒に何行も入る」のは防ぐ
  UNIQUE (exam_id, user_id, submitted_at)
);

CREATE INDEX IF NOT EXISTS exam_practical_submissions_user_idx
  ON exam_practical_submissions (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS exam_practical_submissions_exam_idx
  ON exam_practical_submissions (exam_id, submitted_at DESC);

COMMENT ON TABLE exam_practical_submissions IS
  '実技の自己申告。採点はPRレビュー側で行うため点数は持たない';
