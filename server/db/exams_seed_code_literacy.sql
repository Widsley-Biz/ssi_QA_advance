-- ============================================================
-- コードリテラシーワークショップ Session 1〜6 を投入する
-- ============================================================
-- 前提: このファイルより先に exams_kind_add_material.sql を適用しておくこと
--       （exams_kind_check制約に'material'を追加するマイグレーション。
--        未適用のままこのファイルを流すと、kind='material'のINSERTが
--        制約違反で失敗する）。
--
-- テストを持たない教材のみのコース（kind='material'）。確認テストは
-- 作らないため exam_questions への投入は無い。
--
-- materials の url はページ画像フォルダのベースURL
-- （gs://widsley-skillcheck-materials/code-literacy/<material-id>/ に
--  pdf_slides_to_pages.py でアップロードする想定。このファイルを流す前に
--  アップロードを済ませておくこと）。
-- id/pages を両方持つ教材だけがアプリ内ビューア＋進捗管理の対象になる。
-- 動画教材は id/pages を持たせていないため、ExamList.tsx の既存ロジックで
-- 外部リンク（target="_blank"）にフォールバックする。
--
-- Session 7以降（録画がUninoteのみでDriveバックアップが無いSession 7・8、
-- 未開催のSession 9・10）は今回のスコープ外。動画を入手でき次第、同じ
-- 形式で追加する。
-- ============================================================

INSERT INTO exams (id, name, description, group_name, kind, pass_score, time_limit_min,
                   shuffle_questions, is_published, sort_order, materials) VALUES
  ('code-literacy-s1', 'Session 1｜HTML基礎',
   'HTML・CSS・JavaScript・SQL・Python・Git・ターミナル・APIを浅く・広く・構造的に学ぶ全10回ワークショップの第1回。テストはありません。',
   'コードリテラシーワークショップ', 'material', 0, NULL, true, true, 1,
   '[{"id": "code-literacy-s1-lecture", "label": "第1回 HTML基礎（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s1-lecture", "pages": 16}, {"id": "code-literacy-s1-appendix1", "label": "第1回 HTML基礎（付録: HTMLタグ・属性リファレンスガイド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s1-appendix1", "pages": 17}, {"label": "第1回の録画を見る", "url": "https://drive.google.com/file/d/1VyCDl_3kU45N6V8QtODSdLXdFAkMxGuQ/view?usp=sharing"}]'::jsonb),

  ('code-literacy-s2', 'Session 2｜CSS基礎',
   'HTML・CSS・JavaScript・SQL・Python・Git・ターミナル・APIを浅く・広く・構造的に学ぶ全10回ワークショップの第2回。テストはありません。',
   'コードリテラシーワークショップ', 'material', 0, NULL, true, true, 2,
   '[{"id": "code-literacy-s2-lecture", "label": "第2回 CSS基礎（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s2-lecture", "pages": 16}, {"id": "code-literacy-s2-appendix1", "label": "第2回 CSS基礎（付録: CSSリファレンスガイド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s2-appendix1", "pages": 22}, {"label": "第2回の録画を見る", "url": "https://drive.google.com/file/d/159HTxizKShyYObYYuAB3Px1NAd9D-R6w/view?usp=sharing"}]'::jsonb),

  ('code-literacy-s3', 'Session 3｜JavaScript基礎',
   'HTML・CSS・JavaScript・SQL・Python・Git・ターミナル・APIを浅く・広く・構造的に学ぶ全10回ワークショップの第3回。テストはありません。',
   'コードリテラシーワークショップ', 'material', 0, NULL, true, true, 3,
   '[{"id": "code-literacy-s3-lecture", "label": "第3回 JavaScript基礎（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s3-lecture", "pages": 16}, {"id": "code-literacy-s3-appendix1", "label": "第3回 JavaScript基礎（付録: JavaScriptリファレンスガイド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s3-appendix1", "pages": 14}, {"label": "第3回の録画を見る", "url": "https://drive.google.com/file/d/1_fKdvQbSZKTNHTTWPxY__TnmdyTAqQwZ/view?usp=sharing"}]'::jsonb),

  ('code-literacy-s4', 'Session 4｜TypeScript基礎',
   'HTML・CSS・JavaScript・SQL・Python・Git・ターミナル・APIを浅く・広く・構造的に学ぶ全10回ワークショップの第4回。テストはありません。',
   'コードリテラシーワークショップ', 'material', 0, NULL, true, true, 4,
   '[{"id": "code-literacy-s4-lecture", "label": "第4回 TypeScript基礎（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s4-lecture", "pages": 16}, {"id": "code-literacy-s4-appendix1", "label": "第4回 TypeScript基礎（付録: TypeScriptリファレンスガイド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s4-appendix1", "pages": 13}, {"label": "第4回の録画を見る", "url": "https://drive.google.com/file/d/1KlH_9VGQDlvobHW6B54xVh7uJyhQieVb/view?usp=sharing"}]'::jsonb),

  ('code-literacy-s5', 'Session 5｜Git & ターミナル基礎',
   'HTML・CSS・JavaScript・SQL・Python・Git・ターミナル・APIを浅く・広く・構造的に学ぶ全10回ワークショップの第5回。テストはありません。',
   'コードリテラシーワークショップ', 'material', 0, NULL, true, true, 5,
   '[{"id": "code-literacy-s5-lecture", "label": "第5回 Git & ターミナル基礎（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s5-lecture", "pages": 15}, {"id": "code-literacy-s5-appendix1", "label": "第5回 Git & ターミナル基礎（付録: Git & ターミナル リファレンスガイド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s5-appendix1", "pages": 13}, {"label": "第5回の録画を見る", "url": "https://drive.google.com/file/d/1dpvlhx4S7Ea4CPAp0xy9ufd4LBrl6znw/view?usp=sharing"}]'::jsonb),

  ('code-literacy-s6', 'Session 6｜SQL基礎',
   'HTML・CSS・JavaScript・SQL・Python・Git・ターミナル・APIを浅く・広く・構造的に学ぶ全10回ワークショップの第6回。テストはありません。',
   'コードリテラシーワークショップ', 'material', 0, NULL, true, true, 6,
   '[{"id": "code-literacy-s6-lecture", "label": "第6回 SQL基礎（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s6-lecture", "pages": 14}, {"id": "code-literacy-s6-appendix1", "label": "第6回 SQL基礎（付録①: SQL実践リファレンス）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s6-appendix1", "pages": 12}, {"id": "code-literacy-s6-appendix2", "label": "第6回 SQL基礎（付録②: SQL発展リファレンス）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s6-appendix2", "pages": 16}, {"label": "第6回の録画を見る", "url": "https://drive.google.com/file/d/16SsUgCEtu6L0qVajbmXFZCey8dhim_ZH/view?usp=sharing"}]'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  group_name = EXCLUDED.group_name, kind = EXCLUDED.kind,
  pass_score = EXCLUDED.pass_score, time_limit_min = EXCLUDED.time_limit_min,
  sort_order = EXCLUDED.sort_order, materials = EXCLUDED.materials;
-- is_publishedはここでは更新しない（既存の運用と同じ。管理画面での公開/非公開
-- 設定が再投入のたびに初期値へ戻ってしまうのを防ぐ）

-- 確認用（6行・kind='material'・materialsが入っていること）
SELECT id, kind, jsonb_array_length(materials) AS material_count
  FROM exams WHERE group_name = 'コードリテラシーワークショップ' ORDER BY sort_order;
