-- ============================================================
-- 本番適用用（2026-08-20）：模擬試験に「実技」を1件追加する
--
--   Cloud SQL Studio でこのファイルの中身を全部貼って Run するだけ。
--   既存テーブルは列の追加しかしないので、動いている筆記4セットには影響しない。
--   何度流しても同じ結果になる（列も制約もテーブルも IF NOT EXISTS / ON CONFLICT）。
--
--   中身は次の2ファイルを結合したもの:
--     exams_practical.sql       … 列と自己申告テーブルの追加
--     exams_seed_practical.sql  … 実技1件の投入（文言とリンク）
--
--   ローカルのPostgreSQL 17で適用と再実行を確認済み。
--   制約が効くこと（practicalなのにguideが無い／kindが値域外）も実機で確認。
-- ============================================================

\echo '=== 1/2 列と自己申告テーブルを追加 ==='

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS kind  text NOT NULL DEFAULT 'written',
  ADD COLUMN IF NOT EXISTS guide jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_kind_check') THEN
    ALTER TABLE exams ADD CONSTRAINT exams_kind_check
      CHECK (kind IN ('written', 'practical'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_practical_needs_guide') THEN
    ALTER TABLE exams ADD CONSTRAINT exams_practical_needs_guide
      CHECK (kind <> 'practical' OR guide IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN exams.kind  IS 'written=クリックで出題が始まる / practical=説明ページを挟んで外部へ送る';
COMMENT ON COLUMN exams.guide IS '実技のときだけ使う案内。{intro, what_we_see[], steps[], links[], grading, answers_policy}';

CREATE TABLE IF NOT EXISTS exam_practical_submissions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exam_id      text NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pr_url       text NOT NULL DEFAULT '',
  note         text NOT NULL DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, user_id, submitted_at)
);

CREATE INDEX IF NOT EXISTS exam_practical_submissions_user_idx
  ON exam_practical_submissions (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS exam_practical_submissions_exam_idx
  ON exam_practical_submissions (exam_id, submitted_at DESC);

COMMENT ON TABLE exam_practical_submissions IS
  '実技の自己申告。採点はPRレビュー側で行うため点数は持たない';

\echo '=== 2/2 実技1件を投入 ==='

INSERT INTO exams (
  id, name, description, group_name, kind,
  pass_score, time_limit_min, shuffle_questions, is_published, sort_order, guide
) VALUES (
  'playwright-mock-practical',
  '実技模擬（POM・全45問）',
  'GitHubリポジトリの出題ファイルを解いてPRを出す形式の実技練習です。回数制限はありません。',
  'Playwright社内試験',
  'practical',
  0, NULL, false, true, 5,
  jsonb_build_object(
    'intro',
    '本番の実技試験と同じ形式の練習です。練習サイトに対してPlaywrightのテストを書き、'
    || 'GitHubにPull Requestを出すところまでを一人でやり切ります。'
    || '何度やり直しても構いません。',

    'what_we_see', jsonb_build_array(
      '練習サイトの画面から、テストすべき操作を自分で見つけられるか',
      'AAAパターン（Arrange / Act / Assert）で読みやすいテストが書けるか',
      '提供されているPOM（ページオブジェクト）を使い回せるか。必要なら自分で足せるか',
      'ブランチを切ってコミットし、Pull Requestとして提出できるか'
    ),

    'steps', jsonb_build_array(
      jsonb_build_object('no', 1, 'title', 'リポジトリをフォークして手元に落とす',
        'body', 'このあとのリンクからリポジトリを開き、自分のアカウントにフォークしてから clone してください。'
             || 'そのあと npm install を実行します。'),
      jsonb_build_object('no', 2, 'title', '練習サイトを開いて触ってみる',
        'body', '先にテストを書き始めないこと。まず画面を触って、何ができるサイトなのかを掴んでください。'
             || 'ここを飛ばすと「動くけれど意味のないテスト」になります。'),
      jsonb_build_object('no', 3, 'title', '出題ファイルを解く（tests/ の3ファイル・全45問）',
        'body', 'practice1_aaa（AAAパターン）→ practice2_edit_pom（既存POMの修正）→ '
             || 'practice3_new_pom（POMの新規作成）の順に進めると、無理なく難易度が上がります。'),
      jsonb_build_object('no', 4, 'title', 'ブランチを切ってPull Requestを出す',
        'body', 'main に直接コミットしないこと。自分の名前などでブランチを切り、PRの説明に'
             || '「どの問題を解いたか」「詰まった箇所」を書いてください。'),
      jsonb_build_object('no', 5, 'title', 'このページに戻って「PRを提出した」を押す',
        'body', 'PRのURLを貼って記録しておくと、OJT担当者がレビューに入りやすくなります。')
    ),

    'links', jsonb_build_array(
      jsonb_build_object(
        'label', '練習サイトを開く',
        'url', 'https://bookshelf-practice-site.web.app',
        'note', 'テスト対象のサイト。ログイン不要で誰でも触れます',
        'primary', true),
      jsonb_build_object(
        'label', 'GitHubリポジトリを開く',
        'url', 'https://github.com/ryujikawakami-jpg/Simulation_PracticalSkillsSite_POM',
        'note', 'pages/=提供POM　tests/=出題ファイル（全45問）　answers/=模範解答',
        'primary', true)
    ),

    'contents', jsonb_build_array(
      jsonb_build_object('path', 'tests/practice1_aaa.spec.ts',
        'body', 'AAAパターンでテストを書く問題。まずここから'),
      jsonb_build_object('path', 'tests/practice2_edit_pom.spec.ts',
        'body', '既存のPOMを直して使う問題'),
      jsonb_build_object('path', 'tests/practice3_new_pom.spec.ts',
        'body', 'POMを自分で新規作成する問題。いちばん難しい'),
      jsonb_build_object('path', 'pages/',
        'body', '提供されているページオブジェクト。practice1・2ではこれを使う'),
      jsonb_build_object('path', 'answers/',
        'body', '模範解答（POM 4ファイル＋テスト3ファイル）')
    ),

    'grading',
    'このページでは採点しません。提出されたPull Requestを見て、OJT担当者がレビューします。'
    || '本番の社内試験も同じ形式（実技＝GitHub PR）なので、ここで提出の流れに慣れておいてください。',

    'answers_policy',
    'answers/ に模範解答が入っていますが、自分で書いてPull Requestを出したあとに見てください。'
    || '先に見ると「読めば分かる」で終わってしまい、書けるようにはなりません。'
    || '30分考えて手が止まったときは、解答を見るよりOJT担当者に声をかけた方が早く進みます。',

    'note',
    'リポジトリのREADMEに「localhost:8080 で起動」という記述が残っている場合は古い情報です。'
    || '上の練習サイトのURLをそのまま使ってください。'
  )
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  group_name  = EXCLUDED.group_name,
  kind        = EXCLUDED.kind,
  sort_order  = EXCLUDED.sort_order,
  is_published = EXCLUDED.is_published,
  guide       = EXCLUDED.guide;

\echo '=== 確認 ==='
SELECT group_name, sort_order, kind, name FROM exams
 WHERE group_name = 'Playwright社内試験' ORDER BY sort_order;
