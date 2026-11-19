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
-- Session 7〜9も投入する。Session 7・8の録画はUninoteの共有範囲を
-- 変更して無認証閲覧可能にしてもらったため、動画教材として外部リンクで
-- 追加できる。Session 9は11/20開催予定でまだ録画が無いため、動画教材は
-- url無し（＝近日公開のテキスト表示。ExamList.tsx側で対応済み）で先に
-- スライド・付録だけ投入する。録画ができ次第、該当行のurlを追記すれば良い。
--
-- Session 8・9は付録①②を共通のPDFから生成しているため、画像は別々の
-- GCSフォルダに複製アップロードしてあるが、中身は同一。
--
-- Session 10（選択制・12/11開催予定、未開催）は今回のスコープ外。
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
   '[{"id": "code-literacy-s6-lecture", "label": "第6回 SQL基礎（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s6-lecture", "pages": 14}, {"id": "code-literacy-s6-appendix1", "label": "第6回 SQL基礎（付録①: SQL実践リファレンス）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s6-appendix1", "pages": 12}, {"id": "code-literacy-s6-appendix2", "label": "第6回 SQL基礎（付録②: SQL発展リファレンス）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s6-appendix2", "pages": 16}, {"label": "第6回の録画を見る", "url": "https://drive.google.com/file/d/16SsUgCEtu6L0qVajbmXFZCey8dhim_ZH/view?usp=sharing"}]'::jsonb),

  ('code-literacy-s7', 'Session 7｜Python基礎',
   'HTML・CSS・JavaScript・SQL・Python・Git・ターミナル・APIを浅く・広く・構造的に学ぶ全10回ワークショップの第7回。テストはありません。',
   'コードリテラシーワークショップ', 'material', 0, NULL, true, true, 7,
   '[{"id": "code-literacy-s7-lecture", "label": "第7回 Python基礎（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s7-lecture", "pages": 12}, {"id": "code-literacy-s7-appendix1", "label": "第7回 Python基礎（付録①: Python実践リファレンス）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s7-appendix1", "pages": 9}, {"id": "code-literacy-s7-appendix2", "label": "第7回 Python基礎（付録②: Python発展リファレンス）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s7-appendix2", "pages": 11}, {"label": "第7回の録画を見る", "url": "https://app.uninote.ai/meetings/14d92cf1-e459-44cd-ac70-e17d48837b7c/shared"}]'::jsonb),

  ('code-literacy-s8', 'Session 8｜API基礎（前半）',
   'HTML・CSS・JavaScript・SQL・Python・Git・ターミナル・APIを浅く・広く・構造的に学ぶ全10回ワークショップの第8回。テストはありません。',
   'コードリテラシーワークショップ', 'material', 0, NULL, true, true, 8,
   '[{"id": "code-literacy-s8-lecture", "label": "第8回 API基礎 前半（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s8-lecture", "pages": 12}, {"id": "code-literacy-s8-appendix1", "label": "第8回 API基礎（付録①: API実践リファレンス）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s8-appendix1", "pages": 10}, {"id": "code-literacy-s8-appendix2", "label": "第8回 API基礎（付録②: API発展リファレンス）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s8-appendix2", "pages": 11}, {"label": "第8回の録画を見る", "url": "https://app.uninote.ai/meetings/8d6226ff-cc8b-4b80-a26e-c5a2b1bae66b/shared"}]'::jsonb),

  ('code-literacy-s9', 'Session 9｜API基礎（後半）& 推しコレクションサイト完成',
   'HTML・CSS・JavaScript・SQL・Python・Git・ターミナル・APIを浅く・広く・構造的に学ぶ全10回ワークショップの第9回。テストはありません。',
   'コードリテラシーワークショップ', 'material', 0, NULL, true, true, 9,
   '[{"id": "code-literacy-s9-lecture", "label": "第9回 API基礎 後半（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s9-lecture", "pages": 13}, {"id": "code-literacy-s9-appendix1", "label": "第9回 API基礎（付録①: API実践リファレンス）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s9-appendix1", "pages": 10}, {"id": "code-literacy-s9-appendix2", "label": "第9回 API基礎（付録②: API発展リファレンス）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/code-literacy/code-literacy-s9-appendix2", "pages": 11}, {"label": "第9回の録画：近日公開"}]'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  group_name = EXCLUDED.group_name, kind = EXCLUDED.kind,
  pass_score = EXCLUDED.pass_score, time_limit_min = EXCLUDED.time_limit_min,
  sort_order = EXCLUDED.sort_order, materials = EXCLUDED.materials;
-- is_publishedはここでは更新しない（既存の運用と同じ。管理画面での公開/非公開
-- 設定が再投入のたびに初期値へ戻ってしまうのを防ぐ）

-- 確認用（9行・kind='material'・materialsが入っていること）
SELECT id, kind, jsonb_array_length(materials) AS material_count
  FROM exams WHERE group_name = 'コードリテラシーワークショップ' ORDER BY sort_order;
