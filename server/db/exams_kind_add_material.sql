-- ============================================================
-- exams.kind に 'material' を追加する（2026-11-18）
--
--   'material' = テストを持たない教材のみのコース（スライド・外部リンク等）。
--   コードリテラシーワークショップ向け。既存の'written'/'practical'には
--   影響しない。何度流しても同じ結果になる（制約を一度DROPしてから
--   ADDするだけで、データは一切変更しない）。
-- ============================================================

ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_kind_check;
ALTER TABLE exams ADD CONSTRAINT exams_kind_check
  CHECK (kind IN ('written', 'practical', 'material'));

COMMENT ON COLUMN exams.kind IS
  'written=クリックで出題が始まる / practical=説明ページを挟んで外部へ送る / material=テストの無い教材のみコース';

-- 確認用（'material'行が無ければ空、エラーが出なければ制約は正しく効いている）
SELECT id, kind FROM exams WHERE kind = 'material';
