-- ============================================================
-- Playwrightワークショップ（Playwright × Cursor テスト自動化、全5回）を投入する
-- ============================================================
-- 前提: kind='material' と exams.guide 列は既存の機能（コードリテラシー・実技模擬で
--       使用済み）のため、新規マイグレーションは不要。
--
-- テストを持たない教材のみのコース（kind='material'）。確認テストは
-- 作らないため exam_questions への投入は無い。category列は意図的に
-- 触れない（NULLのまま。kind='material'ならカテゴリ未設定でも「学習」
-- タブに出るフォールバックをフロント側に持たせる設計のため）。
--
-- materials の url はページ画像フォルダのベースURL
-- （gs://widsley-skillcheck-materials/playwright-workshop/<material-id>/ に
--  pdf_slides_to_pages.py でアップロード済み。pages は実際に変換・アップロードした
--  枚数を正としている。Notion記載の枚数（28/40/39/43/47）と一致することを確認済み）。
--
-- dpiは100を採用。スライドはAirCourseのような画像のみのPDFではなく、
-- Chromiumでレンダリングされたベクター文字（埋め込みラスター画像0件。
-- pdfimages -list で確認済み）のため、dpi100でもコードスクリーンショット
-- （HTML/CSSで描画されたターミナル・コードブロック）の文字が潰れないことを
-- スマホ幅相当（約1050実ピクセル=350CSS px×devicePixelRatio3）にリサイズした
-- 上で目視確認済み。dpi150はファイルサイズが約1.8〜2倍になる一方、
-- 可読性の向上はごくわずかだったため採用しなかった。
--
-- 動画教材は id/pages を持たせていないため、ExamList.tsx の既存ロジックで
-- 外部リンク（target="_blank"）にフォールバックする。
--
-- 先頭（sort_order=0）に「はじめにガイド」を1件追加する。materialsは空配列
-- （教材カードを出さないため）。guide(jsonb)に、受講の進め方・練習用アプリの
-- ログイン情報・画面構成の対応表・playwright.config.tsのbaseURL設定例・
-- 全体の流れ（第1〜5回→第3〜5回の後日演習課題→3回合格で社内認定試験の受験資格→
-- 模擬試験で練習→社内認定試験）・第3回だけ提出方法が違う理由・GitHub提出用
-- リポジトリの招待案内・質問先Slack・事前準備（コードリテラシーSession1〜4への
-- 内部リンク）・実技模擬（BookShelfは別サイト）の注意・研修ページ本体（Notion）
-- へのリンクをまとめている。
--
-- 第3回・第4回・第5回のセッション行にも、それぞれ専用のguideを追加する
-- （「はじめにガイド」とは別に、各回の後日演習課題の案内。ExamList.tsx側は
-- guideを持つ教材行すべてにボタンを出す。ボタン文言はguide.button_labelで
-- 回ごとに変える）。
--
-- 練習用アプリ「Comdesk Practice」のログインID・パスワードは、Ryujiの確認により
-- 「流出しても困らない」とのことなのでguide列に直接書いている
-- （user001@widsley.com〜user010@widsley.com／password。研修専用の練習アプリで、
-- 本番環境や個人情報とは無関係）。
-- ============================================================

INSERT INTO exams (
  id, name, description, group_name, kind, pass_score, time_limit_min,
  shuffle_questions, is_published, sort_order, materials, guide
) VALUES
  ('playwright-workshop-guide', 'はじめに（研修の受け方・練習用アプリについて）',
   '受講する前に一度目を通してください。スライド・動画だけでは分からない情報をまとめています。',
   'Playwrightワークショップ', 'material', 0, NULL, true, true, 0,
   '[]'::jsonb,
   jsonb_build_object(
     'intro',
     'このページは、Playwright × Cursor テスト自動化ワークショップ（全5回・初級〜中級）を'
     || '受講するにあたっての案内です。各回のスライド・動画だけでは伝わりにくい情報（練習用アプリの'
     || 'ログイン情報、画面構成、設定ファイルの書き方、後日演習課題との関係など）をここに集約しています。',

     'links', jsonb_build_array(
       jsonb_build_object(
         'label', '練習用アプリ「Comdesk Practice」を開く',
         'url', 'https://widsley-biz.github.io/study-playwright/',
         'note', 'ログインID: user001@widsley.com 〜 user010@widsley.com ／ パスワード: password',
         'primary', true),
       jsonb_build_object(
         'label', '事前準備（Cursor／Nodeのインストール手順, PDF）',
         'url', 'https://drive.google.com/file/d/17ZGg7bGhlEtaOUqP1fUBShLEK_L2AOxM/view',
         'note', '第1回より前に確認しておいてください'),
       jsonb_build_object(
         'label', '提出用リポジトリ（GitHub）を開く',
         'url', 'https://github.com/playwright-training/playwright-training',
         'note', 'GitHubアカウントの作成と、招待の受諾が必要です（第4回で使用）。招待は川上に依頼してください。招待リンクには期限があるので、届いたらすぐ受諾してください'),
       jsonb_build_object(
         'label', '研修ページ本体（Notion）を開く',
         'url', 'https://app.notion.com/p/widsley/playwright-cursor-2026-3c02eae039e481609f48c66aec162d99',
         'note', '後日演習課題の詳細・最新情報はこちらが正です'),
       jsonb_build_object(
         'label', '実技の模擬試験（BookShelf）を見る',
         'url', '/exams/playwright-mock-practical/practical',
         'note', '本編のComdesk Practiceとは別の練習サイトです。混同しないこと'),
       jsonb_build_object(
         'label', '事前準備：Session 1｜HTML基礎',
         'url', '/exams/code-literacy-s1/materials/code-literacy-s1-lecture',
         'note', 'ロケーターが「画面の何を指しているか」が分かります'),
       jsonb_build_object(
         'label', '事前準備：Session 2｜CSS基礎',
         'url', '/exams/code-literacy-s2/materials/code-literacy-s2-lecture',
         'note', 'class / id / label の違いが分かります'),
       jsonb_build_object(
         'label', '事前準備：Session 3｜JavaScript基礎',
         'url', '/exams/code-literacy-s3/materials/code-literacy-s3-lecture',
         'note', 'await と関数の読み方が分かります'),
       jsonb_build_object(
         'label', '事前準備：Session 4｜TypeScript基礎',
         'url', '/exams/code-literacy-s4/materials/code-literacy-s4-lecture',
         'note', '型の読み方（.spec.ts の ts はこれです）')
     ),

     'steps', jsonb_build_array(
       jsonb_build_object('no', 1, 'title', '全体の流れ',
         'body', '第1回〜第5回（動画+スライド）を受講 → 第3回・第4回・第5回にはそれぞれ後日演習課題が'
              || 'あります（提出方法は回によって違います） → 3回分すべて提出・合格して初めて社内認定試験'
              || '（座学・実技とも）の受験資格を得られます → 模擬試験（座学はこのアプリ内、実技は'
              || 'BookShelf）で練習 → 社内認定試験、という流れです。'),
       jsonb_build_object('no', 2, 'title', '動画の見方',
         'body', '第2回以降は手を動かすパートが中心です。ハンズオンの前には動画を一度止めて、'
              || '自分の手でコードを書いてから再生して答え合わせをしてください。飛ばして答えだけ'
              || '見ると身につきません。'),
       jsonb_build_object('no', 3, 'title', 'baseURLは1か所だけ設定する',
         'body', 'playwright.config.ts に練習アプリのURLを設定しておくと、テストコードでは '
              || 'page.goto(''/auth/'') のようにパスだけで書けます。公開先URLが変わっても、'
              || '直すのは設定ファイル1か所だけです。設定例（Notionの研修ページより）:',
         'code', $PWCODE$import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'https://widsley-biz.github.io/study-playwright/',
    trace: 'on-first-retry',
  },
});$PWCODE$)
     ),

     'contents_heading', '練習アプリの画面構成',
     'contents', jsonb_build_array(
       jsonb_build_object('path', '/auth/',           'body', 'ログイン画面（第2回・第3回で使用）'),
       jsonb_build_object('path', '/call/',            'body', '通常コールモード（第2回・第3回で使用）'),
       jsonb_build_object('path', '/announce/',        'body', '情報共有ボード（第4回・第5回で使用）'),
       jsonb_build_object('path', '/keyword-detect/',  'body', 'キーワード設定（第5回で使用）'),
       jsonb_build_object('path', '/users/ ・ /access/', 'body', 'ユーザー管理・アクセス管理（第5回 後日演習課題で使用）')
     ),

     'note',
     '第3回だけ提出方法が違います。Gitをまだ学んでいないため、Google Docに書いてSlackのDMで'
     || '川上へ提出します。第4回でGitを学んだあと、同じコードをそのままプルリクエストで出し直します'
     || '（第4回の課題）。第3回で作ったファイルは消さずに取っておいてください。質問はSlackの '
     || '#playwright-study へどうぞ。',

     'button_label', 'はじめにを読む'
   )
  ),

  ('playwright-workshop-s1', 'Session 1｜環境構築とテスト自動化の考え方',
   'Playwright × Cursor によるテスト自動化を学ぶ全5回ワークショップの第1回。'
   || '初級(第1〜2回)〜中級(第3〜5回)。テストはありません。',
   'Playwrightワークショップ', 'material', 0, NULL, true, true, 1,
   '[{"id": "playwright-workshop-s1-lecture", "label": "第1回 環境構築とテスト自動化の考え方（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/playwright-workshop/playwright-workshop-s1-lecture", "pages": 28}, {"label": "第1回の録画を見る", "url": "https://drive.google.com/file/d/1wfmLswTcL9Afikbjc_9QaBb80lXPRhCe/view"}]'::jsonb,
   NULL),

  ('playwright-workshop-s2', 'Session 2｜codegen・ロケーター・アサーション',
   'Playwright × Cursor によるテスト自動化を学ぶ全5回ワークショップの第2回。'
   || '初級(第1〜2回)〜中級(第3〜5回)。テストはありません。',
   'Playwrightワークショップ', 'material', 0, NULL, true, true, 2,
   '[{"id": "playwright-workshop-s2-lecture", "label": "第2回 codegen・ロケーター・アサーション（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/playwright-workshop/playwright-workshop-s2-lecture", "pages": 40}, {"id": "playwright-workshop-s2-appendix1", "label": "第2回 codegen・ロケーター・アサーション（付録: アサーション早見表）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/playwright-workshop/playwright-workshop-s2-appendix1", "pages": 1}, {"label": "第2回の録画を見る", "url": "https://drive.google.com/file/d/1j6zqXDADNGwZOHz0NLy5WCloGr9sNBWl/view"}]'::jsonb,
   NULL),

  ('playwright-workshop-s3', 'Session 3｜AAAパターンとテスト設計',
   'Playwright × Cursor によるテスト自動化を学ぶ全5回ワークショップの第3回。'
   || '初級(第1〜2回)〜中級(第3〜5回)。テストはありません。後日演習課題あり（提出期限: 第4回の前日まで）。',
   'Playwrightワークショップ', 'material', 0, NULL, true, true, 3,
   '[{"id": "playwright-workshop-s3-lecture", "label": "第3回 AAAパターンとテスト設計（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/playwright-workshop/playwright-workshop-s3-lecture", "pages": 39}, {"label": "第3回の録画を見る", "url": "https://drive.google.com/file/d/1WyYZW_bQqO968f5Qk8ug-Fqr9hI2GvD8/view"}]'::jsonb,
   jsonb_build_object(
     'intro',
     'テーマ：情報共有ボードを自動テスト化しよう。練習アプリ「Comdesk Practice」の情報共有ボード'
     || '（/announce/）を対象に、自動テストの設計と実装を行います。ログインしてボードに到達するまでの'
     || 'コードは課題テンプレートの前半に入っています。ボードに着いてからの各機能'
     || '（①新規投稿 ②編集 ③削除〈確認モーダルあり〉 ④ページネーション〈投稿5件超で複数ページ、'
     || '初期データ12件＝3ページ〉）について、設計と実装をしてください。',

     'links', jsonb_build_array(
       jsonb_build_object(
         'label', '情報共有ボードを開く',
         'url', 'https://widsley-biz.github.io/study-playwright/announce/',
         'note', 'ログインID: user001@widsley.com 〜 user010@widsley.com ／ パスワード: password',
         'primary', true),
       jsonb_build_object(
         'label', '提出用テンプレート（Google Doc）を開く',
         'url', 'https://docs.google.com/document/d/19tlfCt4otKZWLczxgZG92WkPHWHM5Ra62LUypowg_YE/edit',
         'note', '複製して使用してください')
     ),

     'what_we_see_heading', '提出する課題（計5点・ワンセット）',
     'what_we_see', jsonb_build_array(
       '① Step 1で洗い出した観点表 ×1',
       '② Step 3の自然言語でのAAA設計 ×2',
       '③ Step 4のAAAでの実装 ×2',
       '1つのファイルにまとめても、個別でも可'
     ),

     'steps_heading', '課題のステップ',
     'steps', jsonb_build_array(
       jsonb_build_object('no', 1, 'title', 'テスト観点を洗い出す（目標：10個以上）',
         'body', '「正常系」「異常系」「表示・UI」「非機能」の4つの窓を使って、思いつく限りの'
              || 'チェックポイントを書き出してください。ヒント：空欄で投稿したら？削除をキャンセル'
              || 'したら？2ページ目には何が表示される？'),
       jsonb_build_object('no', 2, 'title', '自動化スコープを決める',
         'body', '洗い出した観点の中から、Playwrightで自動化する項目を2つ選んでください。'
              || 'なぜその2つを選んだのか、理由もセットで書いてください'
              || '（例：重要だから、毎回手動でやるのが面倒だから、壊れやすいから）。'),
       jsonb_build_object('no', 3, 'title', 'AAAで構造を設計する（コード化の準備）',
         'body', '選んだ2つを「日本語のAAA」で設計してください。Arrange（準備）：ログイン済みの状態、'
              || '投稿に使うタイトル名（const）など。Act（実行）：どのボタンを押して、何を入力するか。'
              || 'Assert（確認）：何をもって「成功」と判定するか（URL？メッセージ？一覧の文字？）。'),
       jsonb_build_object('no', 4, 'title', 'AAAで構造を実装する（コード化）',
         'body', '設計した日本語のAAAをそのままコード化してください。ボードに到達するまでのコードは'
              || 'テンプレに直書きしてあります。提出前に必ず npx playwright test で実行して、'
              || 'passすることを確認してください。'),
       jsonb_build_object('no', 5, 'title', 'goto()のパス注意',
         'body', '練習アプリは https://widsley-biz.github.io/study-playwright/ とサブパスで公開'
              || 'されています。goto(''/auth/'') のように先頭にスラッシュを付けると baseURL の'
              || 'サブパスが捨てられて404になります。goto(''auth/'') のように先頭のスラッシュを'
              || '付けず、末尾のスラッシュは残してください。設定例:',
         'code', $PWCODE$import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'https://widsley-biz.github.io/study-playwright/',
    trace: 'on-first-retry',
  },
});$PWCODE$)
     ),

     'grading_heading', '提出方法・期限',
     'grading',
     '提出用テンプレートを複製し、各自のマイドライブに保存したうえでSlackのDMで川上へ提出して'
     || 'ください（ファイル共有の権限を川上に追加すること）。ファイル名の頭に自分の名前を入れて'
     || 'ください。提出期限は第4回の前日までです。質問はSlackの #playwright-study へ、担当は川上です。',

     'answers_policy_heading', '第3回だけ提出方法が違う理由',
     'answers_policy',
     '第3回はまだGitを学んでいないため、Docでの提出になります。第4回でGitを学んだあと、'
     || 'ここで書いたコードをそのままプルリクエストで提出してもらいます（第4回の課題）。'
     || 'このファイルは消さずに取っておいてください。宿題未提出でも第4回の受講は可能ですが、'
     || '社内試験は第3〜5回の宿題提出者のみ参加可能です。',

     'note', '全要素のdata-testid一覧は練習アプリのリポジトリのSPEC.mdにあります。',
     'button_label', '第3回 後日演習課題を見る'
   )),

  ('playwright-workshop-s4', 'Session 4｜Git入門',
   'Playwright × Cursor によるテスト自動化を学ぶ全5回ワークショップの第4回。'
   || '初級(第1〜2回)〜中級(第3〜5回)。テストはありません。後日演習課題あり（提出期限: 第5回の前日まで）。',
   'Playwrightワークショップ', 'material', 0, NULL, true, true, 4,
   '[{"id": "playwright-workshop-s4-lecture", "label": "第4回 Git入門（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/playwright-workshop/playwright-workshop-s4-lecture", "pages": 43}, {"label": "第4回の録画を見る", "url": "https://drive.google.com/file/d/1z28yFQk3wtfPnGymY_ZCmP2L1Us4y9Ls/view"}]'::jsonb,
   jsonb_build_object(
     'intro',
     'テーマ：第3回のコードをGitで提出しよう。新しくコードは書きません。Gitの流れ'
     || '（ブランチを切る → add → commit → push → Pull Request）を自分の手で通すことが目的です。'
     || '提出先リポジトリ: git@github.com:playwright-training/playwright-training.git',

     'links', jsonb_build_array(
       jsonb_build_object(
         'label', '提出先リポジトリ（GitHub）を開く',
         'url', 'https://github.com/playwright-training/playwright-training',
         'note', '招待を受諾済みであることが前提です（切れていたらSlackで川上へ）',
         'primary', true)
     ),

     'what_we_see_heading', '今回の課題の目的',
     'what_we_see', jsonb_build_array(
       'mainから自分のブランチを切れる',
       'add → commit → push の流れを自分でできる',
       'プルリクエストを作成できる'
     ),

     'steps_heading', '課題のステップ',
     'steps', jsonb_build_array(
       jsonb_build_object('no', 1, 'title', '始める前に3つ確認',
         'body', '① Gitがインストールされている（ターミナルで git --version が通る）'
              || '② GitHubアカウントを作成済み ③ リポジトリの招待を受諾済み'
              || '（招待リンクは期限付き。切れていたらSlackかDMで川上まで）'),
       jsonb_build_object('no', 2, 'title', 'Step 0：名前とメールを設定する（最初に1回だけ）',
         'body', 'メールはGitHubに登録したものに合わせてください。未設定だと、あとでコミット'
              || 'しようとしたときにエラーで止まります。',
         'code', $PWCODE$git config --global user.name "Taro Tanaka"
git config --global user.email "taro.tanaka@widsley.com"$PWCODE$),
       jsonb_build_object('no', 3, 'title', 'Step 1：リポジトリをクローンする（最初に1回だけ）',
         'body', '普段の作業フォルダの中でクローンしないでください。フォルダが二重になって、'
              || 'あとで「どこにいるのか分からない」状態になります。デスクトップなど分かりやすい'
              || '場所で実行してください。',
         'code', $PWCODE$git clone git@github.com:playwright-training/playwright-training.git
cd playwright-training$PWCODE$),
       jsonb_build_object('no', 4, 'title', 'Step 2：mainを最新にして、自分のブランチを切る',
         'body', '例：taro-tanaka-day3-homework。必ずmainから切ってください。他の人のブランチから'
              || '切ると、その人の変更が混ざります。',
         'code', $PWCODE$git checkout main
git pull origin main
git checkout -b your-name-day3-homework$PWCODE$),
       jsonb_build_object('no', 5, 'title', 'Step 3：課題ファイルを所定の場所に配置する',
         'body', 'homework/day3/自分の名前/announce.spec.ts に、第3回で書いたテストコードを'
              || '配置してください（例：homework/day3/taro-tanaka/announce.spec.ts）。'),
       jsonb_build_object('no', 6, 'title', 'Step 4：テストが動くか確認する',
         'body', '動かないコードは再提出になります。提出前に必ず実行して、passすることを'
              || '確認してください。',
         'code', $PWCODE$npx playwright test homework/day3/your-name/$PWCODE$),
       jsonb_build_object('no', 7, 'title', 'Step 5：コミット・プッシュ',
         'body', '',
         'code', $PWCODE$git status
git add homework/day3/your-name/
git commit -m "Day3課題: 情報共有ボードのテストを提出"
git push origin your-name-day3-homework$PWCODE$),
       jsonb_build_object('no', 8, 'title', 'Step 6：Pull Requestを作成する',
         'body', 'GitHubでリポジトリを開き、黄色いバナーの Compare & pull request をクリック'
              || '（無ければ Pull requests タブ → New pull request）。base: main ← compare: '
              || 'your-name-day3-homework になっているか確認して Create pull request。'
              || 'タイトル例：「Day3課題提出：情報共有ボードのテスト（田中太郎）」')
     ),

     'contents_heading', 'よくあるつまずき',
     'contents', jsonb_build_array(
       jsonb_build_object('path', 'command not found: git', 'body', '原因: Git未インストール → 対処: Gitをインストールする'),
       jsonb_build_object('path', 'no such file or directory', 'body', '原因: クローンした場所と現在地が違う → 対処: pwd（Win: cd）で現在地を確認してcdで移動'),
       jsonb_build_object('path', 'Permission denied (publickey)', 'body', '原因: SSH鍵が未登録 or コピー切れ → 対処: 公開鍵を先頭から末尾まで全部登録し直す'),
       jsonb_build_object('path', 'Please tell me who you are', 'body', '原因: git config未設定 → 対処: Step 0を実行する'),
       jsonb_build_object('path', 'git statusで「変更なし」', 'body', '原因: 保存していない／クローンしたフォルダの外にファイルがある → 対処: 保存する。ファイルの場所を確認する'),
       jsonb_build_object('path', 'リポジトリが見えない', 'body', '原因: 招待の期限切れ → 対処: チャンネルかDMで再招待を依頼')
     ),

     'grading_heading', '提出課題・期限',
     'grading', 'Pull Requestを作成して完了です。提出期限は第5回の前日までです。'
              || '質問はSlackの #playwright-study へ、担当は川上です。',

     'button_label', '第4回 後日演習課題を見る'
   )),

  ('playwright-workshop-s5', 'Session 5｜POM（ページオブジェクトモデル）',
   'Playwright × Cursor によるテスト自動化を学ぶ全5回ワークショップの第5回。'
   || '初級(第1〜2回)〜中級(第3〜5回)。テストはありません。後日演習課題あり（提出期限: 社内試験の前日まで）。',
   'Playwrightワークショップ', 'material', 0, NULL, true, true, 5,
   '[{"id": "playwright-workshop-s5-lecture", "label": "第5回 POM（ページオブジェクトモデル）（本編スライド）", "url": "https://storage.googleapis.com/widsley-skillcheck-materials/playwright-workshop/playwright-workshop-s5-lecture", "pages": 47}, {"label": "第5回の録画を見る", "url": "https://drive.google.com/file/d/1opTPIAZwqgcv9zNme5D8Psy_UVZR33rq/view"}]'::jsonb,
   jsonb_build_object(
     'intro',
     'テーマ：POMを複製して、別の画面用に作り替えよう。第5回で学んだPage Object Model（POM）の'
     || '読み方・使い方・複製から作る方法を使い、研修で使った InformationBoard.ts を参考に、'
     || '別の画面用のPOMを自分で作り、テストを実装して提出します。',

     'links', jsonb_build_array(
       jsonb_build_object(
         'label', '練習用アプリを開く',
         'url', 'https://widsley-biz.github.io/study-playwright/',
         'note', 'ログインID: user001@widsley.com 〜 user010@widsley.com ／ パスワード: password',
         'primary', true)
     ),

     'what_we_see_heading', '今回の課題の目的',
     'what_we_see', jsonb_build_array(
       '既存POMを複製してロケーター・メソッドを書き換えられる',
       '作成したPOMを使ってAAAパターンでテストが書ける',
       'ブランチを作成してPRを出す流れが定着する',
       'テストコードが実際に動くか確認する'
     ),

     'contents_heading', '対象ページを1つ選ぶ',
     'contents', jsonb_build_array(
       jsonb_build_object('path', 'ユーザー管理（/users/）', 'body', 'できる操作：編集のみ（名前・権限・メモ・状態）。難易度：やさしい'),
       jsonb_build_object('path', 'アクセス管理（/access/）', 'body', 'できる操作：通知設定のON/OFF、パスワード変更（バリデーションあり）。難易度：ふつう'),
       jsonb_build_object('path', 'キーワード設定（/keyword-detect/）', 'body', 'できる操作：追加・編集・削除の3つが揃っている。難易度：おすすめ（InformationBoard.tsと形が近い）')
     ),

     'steps_heading', '課題のステップ',
     'steps', jsonb_build_array(
       jsonb_build_object('no', 1, 'title', 'Step 2：InformationBoard.tsを複製してPOMを作成する',
         'body', 'pages/InformationBoard.ts をコピーして homework/day5/自分の名前/〇〇Page.ts として'
              || '保存（例：KeywordDetectPage.ts）。pages/ はみんなで使う配布用のフォルダなので、'
              || '複製したPOMは自分のフォルダに置いてください。クラス名・ロケーター（getByTestId()）・'
              || 'メソッド名をページに合わせて書き換えます（区分のプルダウンだけは fill() ではなく '
              || 'selectOption() を使います）。'),
       jsonb_build_object('no', 2, 'title', 'Step 3：テストを実装する',
         'body', '作成したPOMを使ってAAAパターンでテストを最低1本書いてください。page.goto() は'
              || '先頭スラッシュなし・末尾スラッシュありで書くこと（GitHub Pagesのサブパス配信の'
              || 'ため。先頭に付けるとSite not foundに飛びます）。'),
       jsonb_build_object('no', 3, 'title', 'Step 4：テストが動くか確認する',
         'body', '',
         'code', $PWCODE$npx playwright test homework/day5/your-name/$PWCODE$),
       jsonb_build_object('no', 4, 'title', 'Step 5：ブランチを作成してプッシュする',
         'body', '必ずmainから切ってください。',
         'code', $PWCODE$git checkout main
git pull origin main
git checkout -b your-name-day5-homework

git add homework/day5/your-name/
git commit -m "Day5課題: キーワード設定ページのPOMとテスト提出"
git push origin your-name-day5-homework$PWCODE$),
       jsonb_build_object('no', 5, 'title', 'Step 6：Pull Requestを作成する',
         'body', 'base: main ← compare: your-name-day5-homework になっているか確認して作成'
              || 'してください。POMは<画面>Page.ts、テストは<画面>-<操作>.spec.ts'
              || '（ファイル名に自分の名前は入れません）。')
     ),

     'answers_policy_heading', '必須評価ポイント（これが無いと再提出）',
     'answers_policy',
     'POMが homework/day5/your-name/ に配置されている／テストが実際にpassする'
     || '（npx playwright test）／mainブランチから切っている／Pull Requestが作成されている。',

     'grading_heading', '提出期限',
     'grading', '社内試験の前日までです。宿題未提出でもOKですが、社内試験は第3〜5回の'
              || '宿題提出者のみ参加可能です。質問はSlackの #playwright-study へ、担当は川上です。',

     'button_label', '第5回 後日演習課題を見る'
   ))

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  group_name = EXCLUDED.group_name, kind = EXCLUDED.kind,
  pass_score = EXCLUDED.pass_score, time_limit_min = EXCLUDED.time_limit_min,
  sort_order = EXCLUDED.sort_order, materials = EXCLUDED.materials,
  guide = EXCLUDED.guide;
-- is_publishedはここでは更新しない（既存の運用と同じ。管理画面での公開/非公開
-- 設定が再投入のたびに初期値へ戻ってしまうのを防ぐ）。category列も触らない。

-- 確認用（6行・kind='material'・sort_order=0がガイド行、s3/s4/s5にもguideが入っていること）
SELECT id, kind, sort_order, jsonb_array_length(materials) AS material_count,
       (guide IS NOT NULL) AS has_guide, guide ->> 'button_label' AS guide_button_label
  FROM exams WHERE group_name = 'Playwrightワークショップ' ORDER BY sort_order;
