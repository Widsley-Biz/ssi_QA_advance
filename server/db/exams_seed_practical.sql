-- ============================================================
-- 実技模擬（Playwright）の1件を投入する（2026-08-20）
--
-- 文言とリンクはこの guide(jsonb) にしか無い。
-- 直すときはこのファイルを書き換えて再実行すればよく、デプロイは要らない。
-- ============================================================

INSERT INTO exams (
  id, name, description, group_name, kind,
  pass_score, time_limit_min, shuffle_questions, is_published, sort_order, guide
) VALUES (
  'playwright-mock-practical',
  '実技模擬（POM・全45問）',
  'GitHubリポジトリの出題ファイルを解いてPRを出す形式の実技練習です。回数制限はありません。',
  'Playwright社内試験',
  'practical',
  0,        -- 点数はSkillCheckでは持たない（採点はPRレビュー）
  NULL,     -- 時間制限なし
  false,
  true,
  5,        -- 筆記セットA〜D（1〜4）の次に置く
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
        'body', 'PRのURLを貼って記録しておくと、講師がレビューに入りやすくなります。')
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
    'このページでは採点しません。提出されたPull Requestを見て、講師がレビューします。'
    || '本番の社内試験も同じ形式（実技＝GitHub PR）なので、ここで提出の流れに慣れておいてください。',

    'answers_policy',
    'answers/ に模範解答が入っていますが、自分で書いてPull Requestを出したあとに見てください。'
    || '先に見ると「読めば分かる」で終わってしまい、書けるようにはなりません。'
    || '30分考えて手が止まったときは、解答を見るより講師に声をかけた方が早く進みます。',

    'note',
    'リポジトリのREADMEに「localhost:8080 で起動」という記述が残っている場合は古い情報です。'
    || '上の練習サイトのURLをそのまま使ってください。'
  )
)
ON CONFLICT (id) DO UPDATE SET
  name              = EXCLUDED.name,
  description       = EXCLUDED.description,
  group_name        = EXCLUDED.group_name,
  kind              = EXCLUDED.kind,
  sort_order        = EXCLUDED.sort_order,
  is_published      = EXCLUDED.is_published,
  guide             = EXCLUDED.guide;
