-- ============================================================
-- seed.sql  –  Widsley SkillCheck master data (4 courses)
-- ============================================================
-- Run AFTER 001_tables.sql migration.
-- Uses OVERRIDING SYSTEM VALUE for levels (IDENTITY columns)
-- so we can use deterministic IDs for foreign-key references.
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- 1. Courses
-- ════════════════════════════════════════════════════════════
INSERT INTO courses (id, name, type, description, goal, sort_order) VALUES
  ('academia',   'Academia（共通ベース）', 'single',
   'SSI事業部の全社員が最初に取り組む共通ベースコース。QAの基礎知識と実務スキルを身につける',
   'JSTQB Foundation Level合格＋スキル達成率80%超でAcademia卒業（Entry昇格）', 1),
  ('automation', 'テスト自動化', 'leveled',
   '市場価値が非常に高く、今後も上昇傾向のあるソフトウェアの品質保証の中でも「テストの自動化」に特化したエンジニアを目指すコース',
   '品質を軸に、技術のスペシャリスト・組織のリーダー・インフラ領域へとする自動化の幅が広げられるようなプロフェッショナルを目指す', 2),
  ('management', 'マネジメント', 'leveled',
   'テスト実行や不具合検出の視点から脱却し、経営・開発・ビジネス全体の視点から「最適な品質投資」を設計・推進できるマネジメントスキルの獲得を目指すコース',
   '個々の案件先での実行者からチームのマネジメントへシフトし、さらには社内のQA部門全体の戦略の立案、組織づくりができる人を目指す', 3),
  ('security',   'セキュリティ', 'leveled',
   'サイバー攻撃や脆弱性リスクへの関心が高まる中、QA領域の中でも「セキュリティ品質」に特化した専門性を高めるコース',
   '認証・認可・入力チェック・APIなどのリスクを攻撃者視点で評価し、テスト設計・レビュー・改善提案まで実践できるセキュリティQA人材を目指す', 4);

-- ════════════════════════════════════════════════════════════
-- 2. Levels
-- ════════════════════════════════════════════════════════════

-- Academia categories (101-105)
INSERT INTO levels (id, course_id, name, sort_order, kind) OVERRIDING SYSTEM VALUE VALUES
  (101, 'academia', '土台',     1, 'category'),
  (102, 'academia', 'QA知識',   2, 'category'),
  (103, 'academia', 'QA実務',   3, 'category'),
  (104, 'academia', '案件経験', 4, 'category'),
  (105, 'academia', 'ゴール',   5, 'category');

-- Automation levels (201-204)
INSERT INTO levels (id, course_id, name, sort_order, kind) OVERRIDING SYSTEM VALUE VALUES
  (201, 'automation', 'Entry',        1, 'level'),
  (202, 'automation', 'Associate',    2, 'level'),
  (203, 'automation', 'Professional', 3, 'level'),
  (204, 'automation', 'Expert',       4, 'level');

-- Management levels (301-304)
INSERT INTO levels (id, course_id, name, sort_order, kind) OVERRIDING SYSTEM VALUE VALUES
  (301, 'management', 'Entry',        1, 'level'),
  (302, 'management', 'Associate',    2, 'level'),
  (303, 'management', 'Professional', 3, 'level'),
  (304, 'management', 'Expert',       4, 'level');

-- Security levels (401-403) — NO Entry level
INSERT INTO levels (id, course_id, name, sort_order, kind) OVERRIDING SYSTEM VALUE VALUES
  (401, 'security', 'Associate',    1, 'level'),
  (402, 'security', 'Professional', 2, 'level'),
  (403, 'security', 'Expert',       3, 'level');

-- Reset sequence to avoid collision with future inserts
SELECT setval(pg_get_serial_sequence('levels', 'id'), (SELECT MAX(id) FROM levels));

-- ════════════════════════════════════════════════════════════
-- 3. Skills
-- ════════════════════════════════════════════════════════════

-- ----------------------------------------------------------
-- 3-1. Academia（共通ベース）— 21 skills  (IDs 1-21)
-- ----------------------------------------------------------
INSERT INTO skills (id, course_id, level_id, no, category, name, description, weight, importance, ref_note, answer_type, score_excluded)
OVERRIDING SYSTEM VALUE VALUES
  -- 土台 (4)
  ( 1, 'academia', 101,  1, '土台', 'ビジネスマナー・社会人基礎',
    '挨拶・身だしなみ・時間管理など社会人としての基本姿勢を実践できる',
    1.0, NULL, '', 'scale5', false),
  ( 2, 'academia', 101,  2, '土台', 'ITリテラシー',
    'OS・ブラウザ・端末・ファイル操作などPCの基本操作ができる',
    1.0, NULL, '', 'scale5', false),
  ( 3, 'academia', 101,  3, '土台', '学習習慣',
    '分からない用語を自分で調べ、メモに残して学ぶ習慣がある',
    1.0, NULL, '', 'scale5', false),
  ( 4, 'academia', 101,  4, '土台', 'ドキュメント読解',
    '仕様書・手順書を読み、不明点を質問して理解できる',
    1.0, NULL, '', 'scale5', false),

  -- QA知識 (7)
  ( 5, 'academia', 102,  5, 'QA知識', 'テストの基礎',
    'テストの目的・7原則・テストプロセスの基本を理解している',
    2.0, NULL, '第1章 テストの基礎', 'scale5', false),
  ( 6, 'academia', 102,  6, 'QA知識', 'SDLCとテスト',
    '開発モデルとテストレベル・テストタイプの関係を理解している',
    1.5, NULL, '第2章 SDLC全体を通してのテスト', 'scale5', false),
  ( 7, 'academia', 102,  7, 'QA知識', '静的テスト',
    'レビューの種類と静的テストの考え方を理解している',
    1.0, NULL, '第3章 静的テスト', 'scale5', false),
  ( 8, 'academia', 102,  8, 'QA知識', 'テスト技法(ブラックボックス)',
    '同値分割・境界値分析・デシジョンテーブル等の技法と、それを使ったテスト設計の考え方を理解している',
    2.5, NULL, '第4章 テスト分析と設計', 'scale5', false),
  ( 9, 'academia', 102,  9, 'QA知識', 'テスト技法(ホワイトボックス/経験)',
    '命令網羅・分岐網羅や経験ベース技法の考え方を理解している',
    1.5, NULL, '第4章 テスト分析と設計', 'scale5', false),
  (10, 'academia', 102, 10, 'QA知識', 'テストマネジメント基礎',
    'テスト計画・進捗・リスク・欠陥マネジメントの基本概念を理解している',
    1.5, NULL, '第5章 テストマネジメント', 'scale5', false),
  (11, 'academia', 102, 11, 'QA知識', 'テストツール基礎',
    'テスト支援ツールの分類・利点・リスクを理解している',
    1.0, NULL, '第6章 テストツール', 'scale5', false),

  -- QA実務 (4)
  (12, 'academia', 103, 12, 'QA実務', 'テスト実施(指導下)',
    'OJTで学んだ手順に沿ってテストを実施し、合否を記録できる（指導下）',
    1.5, NULL, '', 'scale5', false),
  (13, 'academia', 103, 13, 'QA実務', 'テスト設計理解(OJT)',
    'OJTでテスト観点・テストケースの作られ方を理解し、設計の意図を読み取れる',
    1.5, NULL, '', 'scale5', false),
  (14, 'academia', 103, 14, 'QA実務', 'エビデンス取得(指導下)',
    '指示に沿ってスクリーンショット・ログ等のエビデンスを取得できる',
    1.0, NULL, '', 'scale5', false),
  (15, 'academia', 103, 15, 'QA実務', '不具合の検知と報告(初歩)',
    '想定と異なる挙動に気づき、再現手順を添えて報告できる',
    1.5, NULL, '', 'scale5', false),

  -- 案件経験 (4)
  (16, 'academia', 104, 16, '案件経験', 'チケット・タスク管理(初歩)',
    'Jira等のチケット・タスク管理ツールで、自分の担当作業の状況を確認・更新できる',
    0.5, NULL, '', 'scale5', false),
  (17, 'academia', 104, 17, '案件経験', '案件での報連相',
    '案件先で進捗・つまずきを適切なタイミングで報告・相談できる',
    1.0, NULL, '', 'scale5', false),
  (18, 'academia', 104, 18, '案件経験', 'チームでの遂行',
    '割り当てられた作業を期限を意識してチームの一員として遂行できる',
    1.0, NULL, '', 'scale5', false),
  (19, 'academia', 104, 19, '案件経験', 'IT知識の実地獲得',
    '案件を通じて対象システム・業務ドメインの知識を増やしている',
    1.0, NULL, '', 'scale5', false),

  -- ゴール (2) — skill 21 is binary/score_excluded
  (20, 'academia', 105, 20, 'ゴール', 'JSTQB FL 受験準備',
    'シラバス全6章を学習し、模擬試験で合格水準(65%目安)に達している',
    2.0, NULL, '全章', 'scale5', false),
  (21, 'academia', 105, 21, 'ゴール', 'JSTQB FL 合格',
    'JSTQB Foundation Level に合格する（＝Entry昇格の要件）',
    2.0, NULL, '全章', 'binary', true);

-- ----------------------------------------------------------
-- 3-2. テスト自動化 — 35 skills  (IDs 22-56)
-- ----------------------------------------------------------
INSERT INTO skills (id, course_id, level_id, no, category, name, description, weight, importance, ref_note, answer_type, score_excluded)
OVERRIDING SYSTEM VALUE VALUES
  -- Entry (5)
  (22, 'automation', 201,  1, 'IT基礎',     'PC/IT基本操作',
    '拡張子・ディレクトリ構造・CLI操作を理解して操作ができる',
    2.0, 3, NULL, 'scale5', false),
  (23, 'automation', 201,  2, 'IT基礎',     '学習姿勢',
    'IT用語を調べながら理解し業務に活用することができる',
    1.5, 2, NULL, 'scale5', false),
  (24, 'automation', 201,  3, 'テスト実行', 'テスト実施',
    'テスト仕様書に従って操作し合否判定を行うことができる',
    1.0, 1, NULL, 'scale5', false),
  (25, 'automation', 201,  4, 'テスト実行', 'バグ報告',
    '再現手順・期待値・実測値を整理して報告することができる',
    3.0, 5, NULL, 'scale5', false),
  (26, 'automation', 201,  5, 'テスト実行', '開発者ツールの初歩',
    'DevToolsを用いてエラーの有無を確認することができる',
    2.5, 4, NULL, 'scale5', false),

  -- Associate (8)
  (27, 'automation', 202,  6, '自動化ツール', 'ノーコードツール活用',
    'ツールを使って操作を記録し自動テストを作成することができる',
    0.5, 1, NULL, 'scale5', false),
  (28, 'automation', 202,  7, 'Playwright',   '環境構築・基本操作',
    '環境構築を行いテストの実行とコード生成を行うことができる',
    1.2, 3, NULL, 'scale5', false),
  (29, 'automation', 202,  8, 'Playwright',   'ロケーター選定',
    '適切なセレクターを選定し安定したテストを作成することができる',
    2.0, 5, NULL, 'scale5', false),
  (30, 'automation', 202,  9, 'Playwright',   'アサーション',
    '非同期処理に対応した検証を実装することができる',
    1.8, 4, NULL, 'scale5', false),
  (31, 'automation', 202, 10, 'Git',          '基本操作',
    'ブランチ運用やPR作成およびコンフリクト解消を行うことができる',
    1.5, 4, NULL, 'scale5', false),
  (32, 'automation', 202, 11, 'スクリプト',   'ツール',
    'SQL等を用いたテストデータの構築ができる',
    1.0, 2, NULL, 'scale5', false),
  (33, 'automation', 202, 12, 'Cursor',       '基本操作',
    'AIを活用してコードの生成や修正を行うことができる',
    0.8, 1, NULL, 'scale5', false),
  (34, 'automation', 202, 13, 'Cursor',       'Context指定',
    'コンテキストを指定して精度の高いコード生成を行うことができる',
    1.2, 3, NULL, 'scale5', false),

  -- Professional (17)
  (35, 'automation', 203, 14, 'Playwright',   '並列化・分離',
    '並列実行や状態管理を活用して効率的にテストを実行することができる',
    0.5, 2, NULL, 'scale5', false),
  (36, 'automation', 203, 15, 'Playwright',   'API Testing',
    'APIを利用してデータの検証や前処理を行うことができる',
    0.5, 2, NULL, 'scale5', false),
  (37, 'automation', 203, 16, 'Playwright',   'テスト設計(POM)',
    'Page Object Modelを用いて保守性の高いテスト設計を行うことができる',
    1.0, 3, NULL, 'scale5', false),
  (38, 'automation', 203, 17, 'Playwright',   '安定化',
    'テストの不安定要因を特定し改善することができる',
    1.0, 3, NULL, 'scale5', false),
  (39, 'automation', 203, 18, 'Playwright',   '戦略・運用',
    '自動化対象を判断し効率的な運用を行うことができる',
    1.0, 3, NULL, 'scale5', false),
  (40, 'automation', 203, 19, 'Git',          'CI/CD',
    'GitHub Actionsを用いてテスト自動実行を設定することができる',
    1.0, 3, NULL, 'scale5', false),
  (41, 'automation', 203, 20, 'Git',          'Artifacts',
    'テスト結果の成果物を保存し確認することができる',
    0.3, 1, NULL, 'scale5', false),
  (42, 'automation', 203, 21, 'Git',          'レビュー',
    'コードレビューを通して品質を向上させることができる',
    0.3, 1, NULL, 'scale5', false),
  (43, 'automation', 203, 22, 'Cursor',       'Composer',
    '複数ファイルにまたがる修正をAIで行うことができる',
    0.5, 2, NULL, 'scale5', false),
  (44, 'automation', 203, 23, 'Cursor',       'デバッグ',
    'AIを活用してエラー原因の特定と修正を行うことができる',
    0.5, 2, NULL, 'scale5', false),
  (45, 'automation', 203, 24, 'Cursor',       '品質判断',
    'AI生成コードの妥当性を判断し修正することができる',
    0.5, 3, NULL, 'scale5', false),
  (46, 'automation', 203, 25, 'スクリプト',   'プログラミング基礎',
    '条件分岐やループを用いた処理を実装することができる',
    0.3, 1, NULL, 'scale5', false),
  (47, 'automation', 203, 26, 'スクリプト',   'APIテスト',
    'APIツールを用いてデータのやり取りを検証することができる',
    0.3, 1, NULL, 'scale5', false),
  (48, 'automation', 203, 27, 'スクリプト',   'エラー分析',
    'コードを読み解きエラー原因を特定することができる',
    0.3, 1, NULL, 'scale5', false),
  (49, 'automation', 203, 28, 'スクリプト',   'DB操作',
    'SQLを用いてデータの取得や登録を行うことができる',
    0.5, 2, NULL, 'scale5', false),
  (50, 'automation', 203, 29, '自動化設計',   'CI/CD理解',
    'CI/CDパイプラインへのテスト統合の理解ができる',
    0.5, 2, NULL, 'scale5', false),
  (51, 'automation', 203, 30, '自動化設計',   'ROI導入',
    '自動化フレームワークの選定とROI算出ができる',
    1.0, 3, NULL, 'scale5', false),

  -- Expert (5)
  (52, 'automation', 204, 31, 'Playwright',   'カスタムレポーター',
    'レポートや通知の仕組みをカスタマイズすることができる',
    1.0, 1, NULL, 'scale5', false),
  (53, 'automation', 204, 32, '自動化設計',   'ツール選定',
    'プロジェクトに適したツールを選定することができる',
    2.0, 2, NULL, 'scale5', false),
  (54, 'automation', 204, 33, '自動化設計',   '保守性設計',
    '変更に強い構造でテストを設計することができる',
    3.0, 5, NULL, 'scale5', false),
  (55, 'automation', 204, 34, '自動化設計',   'CI/CD導入',
    'CI/CD環境を構築しテスト自動化を実現することができる',
    1.5, 3, NULL, 'scale5', false),
  (56, 'automation', 204, 35, '自動化設計',   'ROI判断',
    '自動化の費用対効果を評価し最適化することができる',
    2.5, 4, NULL, 'scale5', false);

-- ----------------------------------------------------------
-- 3-3. マネジメント — 41 skills  (IDs 57-97)
-- ----------------------------------------------------------
INSERT INTO skills (id, course_id, level_id, no, category, name, description, weight, importance, ref_note, answer_type, score_excluded)
OVERRIDING SYSTEM VALUE VALUES
  -- Entry (10)
  (57, 'management', 301,  1, 'テクニカル', 'テスト実行能力',
    'テスト実行の正確性と注意力を維持することができる',
    1.5, 5, NULL, 'scale5', false),
  (58, 'management', 301,  2, 'テクニカル', '不具合言語化',
    '不具合再現手順を論理的に言語化することができる',
    1.5, 5, NULL, 'scale5', false),
  (59, 'management', 301,  3, 'テクニカル', '証拠収集',
    '適切な証拠（エビデンス）を収集することができる',
    1.0, 3, NULL, 'scale5', false),
  (60, 'management', 301,  4, 'ツール',     'テスト管理ツール基本操作',
    'Jira等のテスト管理ツールの基本操作を行うことができる',
    0.5, 1, NULL, 'scale5', false),
  (61, 'management', 301,  5, '知識',       'テスト技法基礎',
    'テスト技法の基礎知識（同値分割・境界値等）を理解している',
    0.75, 2, NULL, 'scale5', false),
  (62, 'management', 301,  6, '知識',       'ITリテラシー',
    'OS・デバイス・ITリテラシーの基礎を理解している',
    0.5, 1, NULL, 'scale5', false),
  (63, 'management', 301,  7, 'ソフト',     '報連相',
    '迅速かつ正確な報告・連絡・相談をすることができる',
    1.25, 4, NULL, 'scale5', false),
  (64, 'management', 301,  8, 'ソフト',     'ドキュメント読解',
    '仕様書・ドキュメントを正確に読解することができる',
    1.0, 3, NULL, 'scale5', false),
  (65, 'management', 301,  9, '管理',       'タスク時間管理',
    '割り当てられたタスクの時間管理をすることができる',
    0.75, 2, NULL, 'scale5', false),
  (66, 'management', 301, 10, '姿勢',       '確認徹底',
    '疑問点を放置しない確認の徹底をすることができる',
    1.25, 4, NULL, 'scale5', false),

  -- Associate (10)
  (67, 'management', 302, 11, 'テクニカル', '高度なテスト設計技法',
    '高度なテスト設計技法（状態遷移・デシジョンテーブル等）を適用できる',
    1.5, 5, NULL, 'scale5', false),
  (68, 'management', 302, 12, 'テクニカル', 'テスト観点抽出',
    'テスト観点の抽出と構造化（マインドマップ等）ができる',
    1.5, 5, NULL, 'scale5', false),
  (69, 'management', 302, 13, 'テクニカル', '根本原因推測',
    '不具合の根本原因の推測・仮説立案ができる',
    1.25, 4, NULL, 'scale5', false),
  (70, 'management', 302, 14, 'ツール',     '自動テストスクリプト実行',
    '自動テストスクリプトの実行とメンテナンスができる',
    0.5, 1, NULL, 'scale5', false),
  (71, 'management', 302, 15, 'ツール',     'テストデータ構築（SQL）',
    'SQL等を用いたテストデータの構築ができる',
    0.5, 1, NULL, 'scale5', false),
  (72, 'management', 302, 16, '知識',       '非機能テスト基礎',
    '非機能テスト（性能・セキュリティ等）の基礎を理解している',
    0.75, 2, NULL, 'scale5', false),
  (73, 'management', 302, 17, 'ソフト',     '開発者連携',
    '開発者との技術的なコミュニケーションができる',
    1.25, 4, NULL, 'scale5', false),
  (74, 'management', 302, 18, 'ソフト',     'テストケースレビュー',
    '他者のテストケースに対するレビューができる',
    1.0, 3, NULL, 'scale5', false),
  (75, 'management', 302, 19, 'ドキュメント', 'テスト仕様書作成',
    '再現性の高いテスト仕様書の作成ができる',
    1.0, 3, NULL, 'scale5', false),
  (76, 'management', 302, 20, '思考',       '論理的思考（MECE）',
    '重複・漏れのない論理的思考（MECE）ができる',
    0.75, 2, NULL, 'scale5', false),

  -- Professional (11)
  (77, 'management', 303, 21, '管理',       'テスト計画策定・リソース配分',
    'テスト計画書の策定とリソース配分ができる',
    1.5, 5, NULL, 'scale5', false),
  (78, 'management', 303, 22, '管理',       'リスクベースドテスト',
    'リスクベースドテストによる優先順位付けができる',
    1.25, 4, NULL, 'scale5', false),
  (79, 'management', 303, 23, 'テクニカル', 'テストアーキテクチャ設計',
    'テストアーキテクチャ（全体戦略）の設計ができる',
    0.75, 2, NULL, 'scale5', false),
  (80, 'management', 303, 24, 'ツール',     '自動化ROI説明',
    '自動化フレームワークとROIの説明ができる',
    0.75, 2, NULL, 'scale5', false),
  (81, 'management', 303, 25, '分析',       '品質メトリクス分析',
    'メトリクス（バグ曲線等）による品質分析ができる',
    1.25, 4, NULL, 'scale5', false),
  (82, 'management', 303, 26, '改善',       '開発プロセス改善',
    '開発プロセス全体の改善提案（QAエンジニアリング）ができる',
    0.75, 2, NULL, 'scale5', false),
  (83, 'management', 303, 27, '管理',       'ベンダー・タスク管理',
    'ベンダー管理およびチームメンバーへのタスク割当ができる',
    0.75, 2, NULL, 'scale5', false),
  (84, 'management', 303, 28, 'ソフト',     'ステークホルダー調整',
    'ステークホルダーとの交渉・調整（リリース判定等）ができる',
    1.0, 3, NULL, 'scale5', false),
  (85, 'management', 303, 29, '知識',       'CI/CDテスト統合理解',
    'CI/CDパイプラインへのテスト統合の理解がある',
    0.5, 1, NULL, 'scale5', false),
  (86, 'management', 303, 30, '思考',       'バグ傾向分析と再発防止策',
    'バグの傾向分析から再発防止策を導く力がある',
    1.0, 3, NULL, 'scale5', false),
  (87, 'management', 303, 31, 'ツール',     'SQLデータ操作',
    'SQLを用いてデータの取得や登録を行うことができる',
    0.5, 1, NULL, 'scale5', false),

  -- Expert (10)
  (88, 'management', 304, 32, '経営',       '品質戦略・ガバナンス構築',
    '品質戦略の策定と組織的なガバナンス構築ができる',
    1.0, 3, NULL, 'scale5', false),
  (89, 'management', 304, 33, '管理',       'QAチーム評価・育成計画',
    'QAチームの評価・育成計画を策定できる',
    1.5, 5, NULL, 'scale5', false),
  (90, 'management', 304, 34, '財務',       '品質コスト可視化・最適化',
    '品質コスト（CoQ）の可視化と最適化ができる',
    1.5, 5, NULL, 'scale5', false),
  (91, 'management', 304, 35, '経営',       'ビジネス価値バランス判断',
    'ビジネス価値（UX・コスト・納期）のバランス判断ができる',
    1.25, 4, NULL, 'scale5', false),
  (92, 'management', 304, 36, '財務',       'QA部門予算管理',
    'QA部門の予算管理（ツール・外注費）ができる',
    1.0, 3, NULL, 'scale5', false),
  (93, 'management', 304, 37, 'ソフト',     'チェンジマネジメント',
    'チェンジマネジメント（新手法の導入と定着）ができる',
    0.75, 2, NULL, 'scale5', false),
  (94, 'management', 304, 38, 'ソフト',     '期待値コントロール',
    '経営層や顧客との期待値コントロールができる',
    1.0, 3, NULL, 'scale5', false),
  (95, 'management', 304, 39, 'ツール',     'CI/CD環境構築・自動化実現',
    'CI/CD環境を構築しテスト自動化を実現することができる',
    0.5, 1, NULL, 'scale5', false),
  (96, 'management', 304, 40, '管理',       '自動化費用対効果評価',
    '自動化の費用対効果を評価し最適化することができる',
    0.75, 2, NULL, 'scale5', false),
  (97, 'management', 304, 41, '知識',       '法規制・業界標準リスク管理',
    '法規制・業界標準に基づくリスク管理ができる',
    0.75, 2, NULL, 'scale5', false);

-- ----------------------------------------------------------
-- 3-4. セキュリティ — 30 skills  (IDs 98-127)
-- ----------------------------------------------------------
INSERT INTO skills (id, course_id, level_id, no, category, name, description, weight, importance, ref_note, answer_type, score_excluded)
OVERRIDING SYSTEM VALUE VALUES
  -- Associate (10)
  (98,  'security', 401,  1, 'アプリケーション', 'OWASP理解',
    'OWASP Top10など代表的なWeb脆弱性を正しく理解・説明できる',
    1.0, 5, NULL, 'scale5', false),
  (99,  'security', 401,  2, 'アプリケーション', '入力攻撃',
    '入力値攻撃（SQLi等）の仕組みを再現できる',
    1.0, 4, NULL, 'scale5', false),
  (100, 'security', 401,  3, '認証',             '認証攻撃',
    '不正ログインが発生する原因を分析、説明できる',
    0.8, 3, NULL, 'scale5', false),
  (101, 'security', 401,  4, '認証',             '認可理解',
    '認可不備により他ユーザー情報へアクセスできる問題を適切に説明・検証できる',
    0.8, 2, NULL, 'scale5', false),
  (102, 'security', 401,  5, 'データ保護',       '情報漏えい',
    '情報漏えいが発生する原因やリスクを分析できる',
    1.0, 4, NULL, 'scale5', false),
  (103, 'security', 401,  6, 'データ保護',       'パスワード管理',
    '安全なパスワード管理の問題点や対策を説明できる',
    0.8, 2, NULL, 'scale5', false),
  (104, 'security', 401,  7, 'クラウド',         '権限設定',
    '過剰な権限設定によるリスクを特定・説明できる',
    1.2, 3, NULL, 'scale5', false),
  (105, 'security', 401,  8, 'セキュリティ運用', '脆弱性再現',
    '指摘された脆弱性を必要に応じて再現・検証できる',
    1.4, 5, NULL, 'scale5', false),
  (106, 'security', 401,  9, 'セキュリティ運用', 'インシデント初動',
    'セキュリティインシデント発生時の初動対応を説明できる',
    1.4, 5, NULL, 'scale5', false),
  (107, 'security', 401, 10, '文化形成',         'セキュリティ対策',
    '安全なパスワード管理、権限の扱い、怪しい入力やファイルへの注意など、基本的なセキュリティ対策を実践できる',
    0.6, 1, NULL, 'scale5', false),

  -- Professional (10)
  (108, 'security', 402, 11, 'アプリケーション', '攻撃シナリオ',
    '攻撃がどのような手順で進行するかを説明・分析できる',
    0.8, 5, NULL, 'scale5', false),
  (109, 'security', 402, 12, 'アプリケーション', '脆弱性連鎖',
    '複数の脆弱性が組み合わさる攻撃シナリオを必要に応じて分析できる',
    1.4, 4, NULL, 'scale5', false),
  (110, 'security', 402, 13, '認証',             '認証設計レビュー',
    '認証方式・パスワード管理・セッション管理の観点で、設計上の問題点を指摘できる',
    1.2, 3, NULL, 'scale5', false),
  (111, 'security', 402, 14, 'データ保護',       '被害範囲',
    '情報漏えいが発生した場合の影響範囲を正しく把握・分析できる',
    0.8, 3, NULL, 'scale5', false),
  (112, 'security', 402, 15, 'クラウド',         '設定不備リスク',
    'クラウド設定ミスによるセキュリティリスクを特定できる',
    1.2, 4, NULL, 'scale5', false),
  (113, 'security', 402, 16, 'クラウド',         '権限設計レビュー',
    '権限設計の問題点や過剰権限に対するレビューを実行できる',
    0.8, 2, NULL, 'scale5', false),
  (114, 'security', 402, 17, 'セキュリティ運用', 'APIリスク',
    'APIの認証・認可・入力値・エラー処理の観点で、想定されるセキュリティ問題を説明できる',
    0.6, 5, NULL, 'scale5', false),
  (115, 'security', 402, 18, 'セキュリティ運用', 'リスク説明',
    '開発チームにセキュリティリスクを適切に説明できる',
    1.0, 2, NULL, 'scale5', false),
  (116, 'security', 402, 19, 'セキュリティ運用', '優先順位',
    '修正すべきセキュリティ課題の優先順位を適切に判断できる',
    1.2, 1, NULL, 'scale5', false),
  (117, 'security', 402, 20, '文化形成',         'セキュリティ啓発',
    '開発チームに必要なセキュリティ対策をわかりやすく伝えられる',
    1.0, 3, NULL, 'scale5', false),

  -- Expert (10)
  (118, 'security', 403, 21, 'アプリケーション', 'セキュア設計レビュー',
    '既存施策に対するアプリケーション設計をレビューし改善提案ができる',
    1.2, 4, NULL, 'scale5', false),
  (119, 'security', 403, 22, 'アプリケーション', '脅威モデリング',
    '新規機能や変更機能の脅威を洗い出し、対策方針を含めてレビューを遂行できる',
    1.0, 3, NULL, 'scale5', false),
  (120, 'security', 403, 23, '認証',             '認証設計レビュー',
    '既存施策に対する安全な認証設計のための問題点や改善方針を提案できる',
    0.8, 1, NULL, 'scale5', false),
  (121, 'security', 403, 24, '認証',             'アクセス制御',
    '画面やAPIのアクセス制御設計を見て、権限設定の漏れや不適切な権限付与を指摘できる',
    1.2, 2, NULL, 'scale5', false),
  (122, 'security', 403, 25, 'データ保護',       'データ保護',
    '安全なデータ保護の仕組みを正しく設計できる',
    0.6, 1, NULL, 'scale5', false),
  (123, 'security', 403, 26, 'クラウド',         'セキュア構成レビュー',
    'クラウド構成のセキュリティ問題全般をレビューできる',
    1.0, 2, NULL, 'scale5', false),
  (124, 'security', 403, 27, 'セキュリティ運用', '防御戦略',
    '攻撃を防ぐための防御戦略をチーム施策として提案できる',
    0.8, 3, NULL, 'scale5', false),
  (125, 'security', 403, 28, 'セキュリティ運用', 'セキュリティレビュー',
    '設計レビューでセキュリティ問題を適切に発見できる',
    1.2, 5, NULL, 'scale5', false),
  (126, 'security', 403, 29, '文化形成',         'セキュリティ教育',
    '対象者の役割に応じて、教えるべきセキュリティルール・事例を整理し、適切に教育内容を設計できる',
    0.8, 4, NULL, 'scale5', false),
  (127, 'security', 403, 30, '文化形成',         '組織改善推進',
    'セキュリティ上の課題を整理し、改善策の立案・関係者との合意形成・実行フォローまで推進できる',
    1.4, 5, NULL, 'scale5', false);

-- Reset skills sequence
SELECT setval(pg_get_serial_sequence('skills', 'id'), (SELECT MAX(id) FROM skills));

COMMIT;
