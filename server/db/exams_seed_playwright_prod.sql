-- ============================================================
-- Playwright座学本番試験 の設問
-- ============================================================
-- AirCourse からエクスポートしたCSVを
--   server/db/import_aircourse_csv.py
-- で変換したもの。手で編集せず、CSVを直してから再生成すること。
-- ============================================================

-- Playwright座学本番試験（14問 / 満点100点 / 合格ライン65点）
DELETE FROM exam_questions WHERE exam_id = 'playwright-written-prod';
INSERT INTO exams (id, name, description, group_name, pass_score, time_limit_min,
                   shuffle_questions, is_published, sort_order) VALUES
  ('playwright-written-prod', 'Playwright座学本番試験',
   '全14問・満点100点。合格ライン65点。受験回数・対象者は別途制限されます。',
   '社内認定試験',
   65, NULL, true, true, 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  group_name = EXCLUDED.group_name, pass_score = EXCLUDED.pass_score,
  time_limit_min = EXCLUDED.time_limit_min, is_published = EXCLUDED.is_published,
  sort_order = EXCLUDED.sort_order;

INSERT INTO exam_questions
  (exam_id, no, category, question, choices, correct_keys, allow_multiple,
   explanation, points) VALUES
  ('playwright-written-prod', 1, 'locator',
   '<p>以下のHTMLに対して、ボタンをクリックする正しいlocatorはどれですか？</p>
<pre><code>&lt;button data-testid=''submit-btn''&gt;送信&lt;/button&gt;</code></pre>',
   '{"a": "page.locator(''button'')", "b": "page.locator(''[data-testid=\"submit-btn\"]'')", "c": "page.locator(''#submit-btn'')", "d": "page.locator(''.submit-btn'')"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>data-testid属性はテスト専用の安定したカスタム属性です。[data-testid="submit-btn"]のように属性セレクタで指定することで、クラスやIDが変わっても壊れにくいlocatorになります。テストコードではdata-testid属性の活用がPlaywrightでも推奨されています。</p>
<p><strong>【Aが不正解の理由】</strong><br>page.locator(''button'')はページ上のすべてのbutton要素にマッチします。ボタンが複数ある場合に厳密モード違反（strict mode violation）エラーになります。</p>
<p><strong>【Cが不正解の理由】</strong><br>#submit-btnはidがsubmit-btnの要素を指すCSSセレクタです。このHTMLにはid属性が存在しないため何もマッチしません。</p>
<p><strong>【Dが不正解の理由】</strong><br>.submit-btnはCSSクラス名がsubmit-btnの要素を指します。このHTMLにはclass属性が存在しないためマッチしません。</p>', 5),
  ('playwright-written-prod', 2, 'locator',
   '<p>以下のHTMLで、入力フィールドを取得する最も推奨されるlocatorはどれですか？</p>
<pre><code>&lt;input type=''text'' placeholder=''ユーザー名を入力'' aria-label=''username'' /&gt;</code></pre>',
   '{"a": "page.locator(''input[type=\"text\"]'')", "b": "page.locator(''input'')", "c": "page.getByLabel(''username'')", "d": "page.locator(''[placeholder=\"ユーザー名を入力\"]'')"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>getByLabel()はaria-label属性やlabel要素のテキストで要素を取得するPlaywright推奨のlocatorです。アクセシビリティ属性を使うため、HTMLの実装変更（プレースホルダーの変更など）に対して堅牢です。</p>
<p><strong>【Aが不正解の理由】</strong><br>input[type="text"]はページ上のすべてのテキスト入力フィールドにマッチします。複数の入力フィールドがある場合は絞り込めません。</p>
<p><strong>【Bが不正解の理由】</strong><br>page.locator(''input'')はすべてのinput要素にマッチするため、チェックボックスやラジオボタンも含んでしまい目的の要素を特定できません。</p>
<p><strong>【Dが不正解の理由】</strong><br>placeholder属性での取得は動作しますが、placeholderテキストはデザインの都合で変更されやすく壊れやすいlocatorです。aria-labelを使うCが推奨度では上です。</p>', 5),
  ('playwright-written-prod', 3, 'locator',
   '<p>以下のHTMLで、「ログイン」というテキストを持つボタンを取得する正しいlocatorはどれですか？</p>
<pre><code>&lt;button class=''btn primary''&gt;ログイン&lt;/button&gt;</code></pre>',
   '{"a": "page.locator(''.btn.primary'')", "b": "page.getByRole(''button'', { name: ''ログイン'' })", "c": "page.locator(''button.primary'')", "d": "page.getByText(''btn primary'')"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>getByRole(''button'', { name: ''ログイン'' })はボタンのroleとアクセシブルな名前（表示テキスト）で意味的に取得します。CSSクラスに依存しないため、リファクタリングでクラス名が変わっても壊れません。Playwrightが最も推奨するlocatorです。</p>
<p><strong>【Aが不正解の理由】</strong><br>.btn.primaryはCSSクラス名への依存です。デザイン変更でクラス名が変わるとテストが壊れます。また複数の要素がこのクラスを持つ場合に絞り込めません。</p>
<p><strong>【Cが不正解の理由】</strong><br>button.primaryも同様にCSSクラス依存で脆いlocatorです。primaryクラスを持つすべてのbuttonにマッチしてしまいます。</p>
<p><strong>【Dが不正解の理由】</strong><br>getByText(''btn primary'')はテキスト内容が「btn primary」の要素を探します。このHTMLのボタンのテキストは「ログイン」であり、「btn primary」はクラス名なので何もマッチしません。</p>', 5),
  ('playwright-written-prod', 4, '変数',
   '<p>以下のコードを実行した後、<code>count</code> の値は何になりますか？</p>
<pre><code>const items = await page.locator(''li'').count();<br>// ページには &lt;li&gt; が5つ存在する<br>const count = items;</code></pre>',
   '{"a": "\"5\"", "b": "5", "c": "[5]", "d": "undefined"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>count()はマッチした要素数をnumber型（整数）で返します。awaitで解決した後のitemsはnumber型の5であり、countにもそのまま5が代入されます。</p>
<p><strong>【Aが不正解の理由】</strong><br>"5"はstring型の文字列です。count()はnumber型を返すため型が異なります。if (count === 5)のような厳密等値比較で意図通りに動作しません。</p>
<p><strong>【Cが不正解の理由】</strong><br>[5]はnumber型を含む配列です。count()は単一のnumber値を返すのであり、配列は返しません。</p>
<p><strong>【Dが不正解の理由】</strong><br>undefinedは存在しない変数や未定義の値です。count()はawait後に必ずnumber型の値を返すためundefinedにはなりません。</p>', 5),
  ('playwright-written-prod', 5, '変数',
   '<p>以下のコードで、<code>title</code> に格納される値はどれですか？</p>
<pre><code>const title = await page.title();<br>// ページのタイトルは "Playwright テスト" である</code></pre>',
   '{"a": "<title>Playwright テスト</title>", "b": "Playwright テスト", "c": "[\"Playwright テスト\"]", "d": "Promise { \"Playwright テスト\" }"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>page.title()はページのtitle要素のテキスト内容を文字列として返します。タグは含まれず、純粋なテキスト「Playwright テスト」だけが返ります。</p>
<p><strong>【Aが不正解の理由】</strong><br>&lt;title&gt;Playwright テスト&lt;/title&gt;のようにHTMLタグを含む文字列を返すのはpage.content()などです。page.title()はタグなしの文字列を返します。</p>
<p><strong>【Cが不正解の理由】</strong><br>["Playwright テスト"]のような配列を返すメソッドはありません。page.title()は単一の文字列を返します。</p>
<p><strong>【Dが不正解の理由】</strong><br>Promise { ... }はawait前の状態です。awaitを付けてPromiseを解決しているため、titleにはPromiseではなく文字列が代入されます。</p>', 5),
  ('playwright-written-prod', 6, '変数',
   '<p>以下のコードで、<code>isVisible</code> に格納される値はどれですか？</p>
<pre><code>await page.locator(''#message'').waitFor({ state: ''hidden'' });<br>const isVisible = await page.locator(''#message'').isVisible();</code></pre>',
   '{"a": "true", "b": "null", "c": "false", "d": "undefined"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>waitFor({ state: ''hidden'' })は#message要素が非表示（hidden）になるまで待機します。その後のisVisible()は要素が存在するが非表示の状態なのでfalseを返します。</p>
<p><strong>【Aが不正解の理由】</strong><br>trueが返るのは要素がビューポートに表示されている場合です。waitFor({ state: ''hidden'' })で非表示を待機しているのでtrueにはなりません。</p>
<p><strong>【Bが不正解の理由】</strong><br>nullを返すケースはありません。isVisible()は常にtrue/falseのboolean値を返します。</p>
<p><strong>【Dが不正解の理由】</strong><br>undefinedを返すケースもありません。isVisible()はboolean型を返す非同期メソッドです。</p>', 5),
  ('playwright-written-prod', 7, 'Git',
   '<p>新しいブランチを作成してリモートにプッシュする正しい手順はどれですか？</p>',
   '{"a": "git push → git branch feature → git checkout feature", "b": "git checkout -b feature → git add . → git commit -m ''feat'' → git push origin feature", "c": "git commit -m ''feat'' → git branch feature → git push origin feature", "d": "git add . → git push origin feature → git checkout -b feature"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>git checkout -b featureでブランチを作成して切り替え、変更をステージング・コミットしてからgit push origin featureでリモートに反映するのが正しい手順です。-bオプションで作成と切り替えを1コマンドで行えます。</p><p><strong>【Aが不正解の理由】</strong><br>git pushをブランチ作成前に実行しています。リモートに送るべき変更もブランチも存在しない状態でpushしても意味がありません。</p><p><strong>【Cが不正解の理由】</strong><br>git commit -m ''feat''をブランチ作成前に実行しています。mainブランチのままコミットしてしまい、featureブランチには変更が含まれません。</p><p><strong>【Dが不正解の理由】</strong><br>git add .とgit push origin featureをブランチ作成（git checkout -b）より先に実行しています。featureブランチが存在しない状態でpushしてもエラーになります。</p>', 5),
  ('playwright-written-prod', 8, 'Git',
   '<p>他のメンバーがリモートに加えた変更をローカルに取り込む正しい手順はどれですか？</p>',
   '{"a": "git push → git merge origin/main", "b": "git fetch origin → git merge origin/main", "c": "git clone → git pull", "d": "git reset → git fetch origin"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>git fetch originでリモートの最新情報をローカルに取得し、git merge origin/mainでローカルブランチにマージします。fetchとmergeを分けることでリモートの変更内容を確認してからマージできる、より安全な方法です。</p><p><strong>【Aが不正解の理由】</strong><br>git pushはローカルの変更をリモートに送る操作です。他のメンバーの変更を取り込む方向とは逆になります。</p><p><strong>【Cが不正解の理由】</strong><br>git cloneはリポジトリ全体を新規複製するコマンドです。既存のローカルリポジトリに変更を取り込む操作ではありません。</p><p><strong>【Dが不正解の理由】</strong><br>git resetは作業ディレクトリやコミット履歴を特定の状態に戻す操作です。リモートの変更を取り込む前にresetを実行すると、ローカルの作業内容が失われる恐れがあります。</p>', 5),
  ('playwright-written-prod', 9, 'Git',
   '<p>作業中の変更を一時退避して別ブランチに切り替える正しい手順はどれですか？</p>',
   '{"a": "git reset --hard → git checkout other-branch", "b": "git commit -m ''wip'' → git checkout other-branch", "c": "git stash → git checkout other-branch", "d": "git add . → git checkout other-branch"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>git stashで作業中の変更（ステージング済み・未ステージング両方）を一時的に退避してから、git checkout other-branchで別ブランチに切り替えます。退避した変更は後でgit stash popで元のブランチに戻せます。</p><p><strong>【Aが不正解の理由】</strong><br>git reset --hardは作業ディレクトリの変更を完全に破棄します。退避ではなく削除になるため、作業中の変更が失われます。</p><p><strong>【Bが不正解の理由】</strong><br>git commit -m ''wip''は未完成の状態でコミットを作る方法です。動作しますが、WIPコミットが履歴に残りコミット管理が煩雑になります。stashを使う方がクリーンです。</p><p><strong>【Dが不正解の理由】</strong><br>git add .だけではステージングするだけで変更は退避されません。未コミットの変更が残った状態でブランチを切り替えると、変更が次のブランチに持ち込まれてしまう場合があります。</p>', 5),
  ('playwright-written-prod', 10, 'コード読解',
   '<p>以下のPlaywrightのコードを読んで、(1)このコードが何をしているか説明し、(2)バグや問題点があれば指摘してください。<code></code></p>
<pre><code>test(''ログインテスト'', async ({ page }) =&gt; {
      await page.goto(''https://example.com/login'');
      await page.locator(''#username'').fill(''testuser'');
      await page.locator(''#password'').fill(''password123'');
      await page.locator(''#login-btn'').click();
      const message = await page.locator(''.success-message'').textContent();
      expect(message).toBe(''ログイン成功'');
    });</code></pre>',
   '{"a": "ログインページに遷移し、ユーザー名とパスワードを入力してログインボタンをクリックし、成功メッセージを確認する。問題点はなし。", "b": "ログインページに遷移し、ユーザー名とパスワードを入力してログインボタンをクリックし、成功メッセージを確認する。問題点は、ログイン後のページ遷移をwaitForURLやwaitForSelectorで待機していないため、.success-messageが表示される前にtextContent()が実行されフレイキーなテストになる可能性がある。", "c": "ログインページに遷移するが、#login-btnというlocatorは存在しないため必ず失敗する。", "d": "textContent()は非同期関数ではないため、awaitを付けているのが間違い。"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>コードの説明は正しいですが、#login-btnをclick()した後にログイン処理（サーバー通信・ページ遷移）の完了を待たずにtextContent()を呼んでいます。.success-messageがまだDOMに存在しない状態でtextContent()が実行されると、nullが返ったりタイムアウトしたりしてテストが不安定になります。await page.waitForURL(''https://example.com/dashboard'')やawait expect(page.locator(''.success-message'')).toBeVisible()を挟むことで安定します。</p>
<p><strong>【Aが不正解の理由】</strong><br>「問題点なし」は誤りです。click()後の非同期待機が不足しており、実行タイミングによって結果が変わるフレイキーなテストになっています。</p>
<p><strong>【Cが不正解の理由】</strong><br>#login-btnはPlaywrightのCSSセレクタとして正しい書式です。テスト対象のHTMLにid="login-btn"を持つ要素が存在すれば正常に動作します。</p>
<p><strong>【Dが不正解の理由】</strong><br>textContent()はPromiseを返す非同期メソッドです。awaitなしで呼ぶとPromiseオブジェクトが返り、expect(Promise).toBe(''ログイン成功'')は常に失敗します。awaitは必須です。</p>', 10),
  ('playwright-written-prod', 11, 'AAA',
   '<p>以下のテストコードをAAA（Arrange / Act / Assert）の観点から分類したとき、正しい対応はどれですか？</p>
<pre><code></code></pre>
<pre><code>test(''商品をカートに追加できる'', async ({ page }) =&gt; { 
　await page.goto(''https://example.com/products''); 　　　　 // (X) 
　await page.locator(''.add-to-cart'').first().click();　　　　　　  // (Y)
　await expect(page.locator(''.cart-count'')).toHaveText(''1''); 　// (Z)
});</code></pre>
<pre><code></code></pre>',
   '{"a": "X=Act、Y=Arrange、Z=Assert", "b": "X=Assert、Y=Act、Z=Arrange", "c": "X=Arrange、Y=Act、Z=Assert", "d": "X=Arrange、Y=Assert、Z=Act"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>AAAの正しい分類は以下の通りです。<br>・Arrange（準備）: page.goto()で商品一覧ページを開き、テストの前提条件を整えます。<br>・Act（実行）: .add-to-cartをclick()して、カートに追加する操作を実行します。<br>・Assert（確認）: expect().toHaveText(''1'')でカート件数が1になったことを検証します。</p>
<p><strong>【Aが不正解の理由】</strong><br>goto()はActではなくArrangeです。操作の前提ページを用意する準備フェーズです。</p>
<p><strong>【Bが不正解の理由】</strong><br>goto()の段階ではまだ何も検証していないためAssertではありません。click()はActです。</p>
<p><strong>【Dが不正解の理由】</strong><br>click()はAssertではなくActです。expect()を含む(Z)がAssertです。</p>', 10),
  ('playwright-written-prod', 12, 'AAA',
   '<p>「検索ボックスに『Playwright』と入力して検索ボタンをクリックし、結果一覧に『Playwright公式ドキュメント』が表示されることを確認する」というシナリオをAAAで整理したとき、Act（操作）に該当するものはどれですか？</p>',
   '{"a": "検索結果に『Playwright公式ドキュメント』が表示されることを確認する", "b": "ブラウザを起動して検索ページを開く", "c": "検索ボックスに『Playwright』と入力して検索ボタンをクリックする", "d": "テスト用のユーザーアカウントを準備する"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>Act（実行）はテスト対象の機能をユーザーが操作するフェーズです。「検索ボックスに入力して検索ボタンをクリックする」は検索機能そのものへの操作であり、Actに該当します。</p><p><strong>【Aが不正解の理由】</strong><br>「表示されることを確認する」は操作後の結果を検証するAssertです。</p><p><strong>【Bが不正解の理由】</strong><br>「ブラウザを起動して検索ページを開く」はテストの前提条件を整えるArrangeです。</p><p><strong>【Dが不正解の理由】</strong><br>「テスト用のユーザーアカウントを準備する」もArrangeに分類されるテストデータのセットアップです。</p>', 10),
  ('playwright-written-prod', 13, '並び替え',
   '<p>以下のコードブロックを、「新規ユーザー登録フォームを送信して完了メッセージを確認する」テストとして正しい順序に並び替えてください。</p>
<pre><code>① await expect(page.locator(''.complete-msg'')).toHaveText(''登録が完了しました'');
② await page.locator(''#email'').fill(''test@example.com'');
③ await page.goto(''https://example.com/register'');
④ await page.locator(''#submit'').click();
⑤ await page.locator(''#username'').fill(''testuser'');</code></pre>',
   '{"a": "③ → ⑤ → ② → ④ → ①", "b": "① → ③ → ⑤ → ② → ④", "c": "③ → ④ → ⑤ → ② → ①", "d": "⑤ → ② → ③ → ④ → ①"}'::jsonb, '{a}', false,
   '<p><strong>【正解：A】</strong><br>正しい操作順序は以下の通りです。<br>③ 登録ページへ移動（Arrange）<br>⑤ ユーザー名を入力（Act）<br>② メールアドレスを入力（Act）<br>④ 送信ボタンをクリック（Act）<br>① 完了メッセージを検証（Assert）<br>ページを開いてからフォームを埋め、送信後に結果を確認するという自然な操作フローです。</p>
<p><strong>【Bが不正解の理由】</strong><br>①のexpect（完了メッセージ確認）をページ移動（③）より先に実行しています。フォームを送信する前に完了メッセージを確認しようとするためテストが失敗します。</p>
<p><strong>【Cが不正解の理由】</strong><br>③ → ④ の順でページ移動直後に送信ボタンをクリックしています。ユーザー名とメールアドレスを入力する前に送信するため、バリデーションエラーになります。</p>
<p><strong>【Dが不正解の理由】</strong><br>⑤ページへの移動（③）より先にfill()を実行しています。ページを開く前に#usernameは存在しないためエラーになります。</p>', 15),
  ('playwright-written-prod', 14, 'POM',
   '<p>以下のPage Object Model（POM）クラスを使って、正しくログイン操作を呼び出しているコードはどれですか？</p>
<pre><code>// LoginPage.js
class LoginPage {
　constructor(page) {
　　this.page = page;
　　this.usernameInput = page.locator(''#username'');
　　this.passwordInput = page.locator(''#password'');
　　this.loginButton = page.locator(''#login-btn'');
　}

　async login(username, password) {
　　await this.usernameInput.fill(username);
　　await this.passwordInput.fill(password);
　　await this.loginButton.click();
　}
}</code></pre>
<pre><code>A. const loginPage = new LoginPage(page); loginPage.login(''user'', ''pass'');
B. const loginPage = LoginPage(page); await loginPage.login(''user'', ''pass'');
C. const loginPage = new LoginPage(page); await loginPage.login(''user'', ''pass'');
D. const loginPage = new LoginPage(); await loginPage.login(''user'', ''pass'');</code></pre>',
   '{"a": "A", "b": "B", "c": "C", "d": "D"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>new LoginPage(page)でインスタンスを正しく生成し、login()はasyncメソッドなのでawaitを付けて呼び出します。awaitにより、fill()とclick()のすべての非同期処理が完了するまで待機できます。</p>
<p><strong>【Aが不正解の理由】</strong><br>login()にawaitがありません。awaitなしだとPromiseが返るだけで処理の完了を待ちません。fill()やclick()の完了前にテストが終了し、ログイン操作が未完了のままになります。</p>
<p><strong>【Bが不正解の理由】</strong><br>newキーワードなしでLoginPage(page)を呼んでいます。JavaScriptのクラスはnewなしでは呼び出せず「Class constructor LoginPage cannot be invoked without ''new''」というTypeErrorになります。</p>
<p><strong>【Dが不正解の理由】</strong><br>new LoginPage()とpageを引数に渡していません。constructorがthis.page = pageとして受け取ることを期待しているため、pageがundefinedになり、page.locator()呼び出し時にエラーになります。</p>', 10);
