-- ============================================================
-- 011_exam_playwright.sql  –  Playwright模擬筆記の設問
-- ============================================================
-- AirCourse からエクスポートしたCSVを
--   supabase/tools/import_aircourse_csv.py
-- で変換したもの。手で編集せず、CSVを直してから再生成すること。
-- ============================================================

-- Playwright社内試験 模擬筆記 セットA（14問 / 満点100点 / 合格ライン65点）
DELETE FROM exam_questions WHERE exam_id = 'playwright-mock-written-a';
INSERT INTO exams (id, name, description, pass_score, time_limit_min,
                   shuffle_questions, is_published, sort_order) VALUES
  ('playwright-mock-written-a', 'Playwright社内試験 模擬筆記 セットA',
   '全14問・満点100点。合格ライン65点。何度でも受け直せます。',
   65, NULL, true, true, 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  pass_score = EXCLUDED.pass_score, is_published = EXCLUDED.is_published,
  sort_order = EXCLUDED.sort_order;

INSERT INTO exam_questions
  (exam_id, no, category, question, choices, correct_keys, allow_multiple,
   explanation, points) VALUES
  ('playwright-mock-written-a', 1, 'locator',
   '<p>以下のHTMLで、チェックボックスを取得する最も推奨されるlocatorはどれですか？</p>
<pre><code>&lt;input type="checkbox" aria-label="利用規約に同意する" /&gt;</code></pre>',
   '{"a": "page.locator(''input[type=\"checkbox\"]'')", "b": "page.locator(''checkbox'')", "c": "page.getByLabel(''利用規約に同意する'')", "d": "page.locator(''[aria-label]'')"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>getByLabel() はaria-label属性やlabel要素に紐づく要素をアクセシビリティの名前で取得します。Playwrightが最も推奨するlocatorで、HTMLの実装が変わっても壊れにくい安定したテストが書けます。</p>
<p><strong>【Aが不正解の理由】</strong><br>CSSセレクタのtype属性でも動作しますが、同ページに複数のチェックボックスがあると意図しない要素を取得する可能性があり、推奨度は低いです。</p>
<p><strong>【Bが不正解の理由】</strong><br>''checkbox''というCSSセレクタは存在しないためエラーになります。正しくはinput[type="checkbox"]のように属性セレクタで指定する必要があります。</p>
<p><strong>【Dが不正解の理由】</strong><br>[aria-label]はaria-label属性を持つすべての要素にマッチしてしまい、目的のチェックボックスに絞り込めません。</p>', 5),
  ('playwright-mock-written-a', 2, 'locator',
   '<p>以下のHTMLで、2番目の&lt;li&gt;要素を取得する正しいlocatorはどれですか？</p>
<pre><code>&lt;ul&gt;<br>  &lt;li&gt;Apple&lt;/li&gt;<br>  &lt;li&gt;Banana&lt;/li&gt;<br>  &lt;li&gt;Cherry&lt;/li&gt;<br>&lt;/ul&gt;</code></pre>',
   '{"a": "page.locator(''li'').get(1)", "b": "page.locator(''li'').nth(1)", "c": "page.locator(''li[2]'')", "d": "page.locator(''li'').index(1)"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>nth() はPlaywrightのLocatorに存在するメソッドで、インデックスは0始まりです。nth(0)が1番目、nth(1)が2番目の要素を取得します。</p>
<p><strong>【Aが不正解の理由】</strong><br>get() はPlaywrightのLocatorに存在しないメソッドです。呼び出すとTypeErrorになります。</p>
<p><strong>【Cが不正解の理由】</strong><br>li[2]はCSS属性セレクタの書き方で「2という属性を持つli」を指します。2番目の要素を取得するCSSセレクタはli:nth-child(2)と書く必要があります。</p>
<p><strong>【Dが不正解の理由】</strong><br>index() はPlaywrightのLocatorに存在しないメソッドです。呼び出すとTypeErrorになります。</p>', 5),
  ('playwright-mock-written-a', 3, 'locator',
   '<p>以下のHTMLで、「削除」ボタンのみを正確に取得するlocatorはどれですか？</p>
<pre><code>&lt;button&gt;編集&lt;/button&gt;<br>&lt;button&gt;削除&lt;/button&gt;</code></pre>',
   '{"a": "page.locator(''button.danger'')", "b": "page.locator(''.btn'')", "c": "page.locator(''button'').last()", "d": "page.getByRole(''button'', { name: ''削除'' })"}'::jsonb, '{d}', false,
   '<p><strong>【正解：D】</strong><br>getByRole() でrole=''button''かつname=''削除''を指定することで、ボタンの表示テキストをもとに意味的に取得できます。CSSクラスに依存しないためリファクタリングに強く、Playwrightが推奨するlocatorです。</p>
<p><strong>【Aが不正解の理由】</strong><br>button.dangerも「削除」ボタンのみを取得できますが、CSSクラス名に依存しているためデザイン変更でクラス名が変わるとテストが壊れます。推奨度がDより低いです。</p>
<p><strong>【Bが不正解の理由】</strong><br>.btnは「編集」と「削除」の両方のボタンにマッチするため、どちらのボタンかを特定できません。</p>
<p><strong>【Cが不正解の理由】</strong><br>last()は現時点ではDOMの最後のbuttonである「削除」を返しますが、後からボタンが追加されるとDOM順序が変わり意図しない要素を取得する可能性がある脆いlocatorです。</p>', 5),
  ('playwright-mock-written-a', 4, '変数',
   '<p>以下のコードで <code>text</code> に格納される値はどれですか？</p>
<pre><code>// &lt;h1&gt;ようこそ&lt;/h1&gt; がページに存在する<br>const text = await page.locator(''h1'').innerText();</code></pre>',
   '{"a": "<h1>ようこそ</h1>", "b": "[\"ようこそ\"]", "c": "ようこそ", "d": "null"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>innerText() はHTML要素の内側のテキスト内容を文字列として返します。タグは含まれず、純粋なテキストのみが返ります。</p>
<p><strong>【Aが不正解の理由】</strong><br>&lt;h1&gt;ようこそ&lt;/h1&gt; のようにHTMLタグを含む文字列を返すのはinnerHTML()やouterHTML()です。innerText()はタグを除いたテキストのみを返します。</p>
<p><strong>【Bが不正解の理由】</strong><br>["ようこそ"]のような配列を返すメソッドはありません。複数要素のテキストをまとめて取得したい場合はallInnerTexts()を使いますが、それも配列型になります。</p>
<p><strong>【Dが不正解の理由】</strong><br>nullが返るのは要素が見つからない場合ですが、h1要素はページに存在するため問題なく文字列が返ります。</p>', 5),
  ('playwright-mock-written-a', 5, '変数',
   '<p>以下のコードで <code>checked</code> に格納される値はどれですか？</p>
<pre><code>// チェックボックスはチェックされた状態<br>const checked = await page.locator(''#agree'').isChecked();</code></pre>',
   '{"a": "\"true\"", "b": "1", "c": "true", "d": "\"checked\""}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>isChecked() はJavaScriptのboolean型である true または false を返します。チェックされている場合はtrue（クォートなし）が返ります。</p>
<p><strong>【Aが不正解の理由】</strong><br>"true"はstring型の文字列です。isChecked()はboolean型を返すため、型が異なります。if (checked === true) のような厳密等値比較でfalseになってしまいます。</p>
<p><strong>【Bが不正解の理由】</strong><br>1はnumber型です。isChecked()はboolean型を返すため不正解です。</p>
<p><strong>【Dが不正解の理由】</strong><br>"checked"はstring型の文字列です。HTMLのchecked属性の値ではなく、JavaScriptのboolean値が返ります。</p>', 5),
  ('playwright-mock-written-a', 6, '変数',
   '<p>以下のコードで <code>val</code> に格納される値はどれですか？</p>
<pre><code>// &lt;input id="name" value="Taro" /&gt; がページに存在する<br>const val = await page.locator(''#name'').inputValue();</code></pre>',
   '{"a": "undefined", "b": "Taro", "c": "{ value: \"Taro\" }", "d": "<input value=\"Taro\">"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>inputValue() はinput要素のvalue属性の値を文字列として返します。この場合は"Taro"という文字列が得られます。</p>
<p><strong>【Aが不正解の理由】</strong><br>undefinedが返るのは存在しない変数や未定義の値を参照した場合です。要素が存在しvalue属性も設定されているため、undefinedにはなりません。</p>
<p><strong>【Cが不正解の理由】</strong><br>{ value: "Taro" } のようなオブジェクト形式は返りません。inputValue()はシンプルな文字列を返します。</p>
<p><strong>【Dが不正解の理由】</strong><br>&lt;input value="Taro"&gt; のようなHTML文字列を返すのはouterHTML()です。inputValue()はvalue属性の値のみを返します。</p>', 5),
  ('playwright-mock-written-a', 7, 'Git',
   '<p>コミット履歴を確認してから、直前のコミットメッセージだけを修正する正しい手順はどれですか？</p>',
   '{"a": "git log → git reset HEAD~1 → git commit -m \"新メッセージ\"", "b": "git log → git commit --amend -m \"新メッセージ\"", "c": "git status → git commit -m \"新メッセージ\"", "d": "git log → git rebase -i HEAD~2"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>git log でコミット履歴を確認し、git commit --amend -m "新メッセージ" で直前のコミットメッセージを上書き修正できます。ファイルの変更は保持したままメッセージだけを変更できる最もシンプルな方法です。</p><p><strong>【Aが不正解の理由】</strong><br>git reset HEAD~1 は直前のコミット自体を取り消してステージング前の状態に戻す操作です。その後に git commit -m で再コミットできますが、メッセージだけを修正するという目的には手順が多く、--amendを使う方が適切です。</p><p><strong>【Cが不正解の理由】</strong><br>git status は現在の作業ツリーの状態を確認するコマンドで、コミット履歴は確認できません。また、git commit -m だけでは直前のコミットを修正するのではなく新しいコミットが作られます。</p><p><strong>【Dが不正解の理由】</strong><br>git rebase -i HEAD~2 は過去2件のコミットを対話的に編集できますが、1件だけのメッセージ修正には操作が複雑で過剰です。--amendの方がシンプルです。</p>', 5),
  ('playwright-mock-written-a', 8, 'Git',
   '<p>リモートリポジトリのURLを確認してから、originのURLを新しいものに変更する正しい手順はどれですか？</p>',
   '{"a": "git remote → git remote set-url origin <新URL>", "b": "git clone <新URL> → git push origin main", "c": "git remote -v → git remote add origin <新URL>", "d": "git remote -v → git remote set-url origin <新URL>"}'::jsonb, '{d}', false,
   '<p><strong>【正解：D】</strong><br>git remote -v で現在登録されているリモートURLを一覧表示して確認し、git remote set-url origin &lt;新URL&gt; でoriginのURLを上書き変更します。</p><p><strong>【Aが不正解の理由】</strong><br>git remote（-vなし）はリモート名の一覧だけを表示しURLが表示されません。URLを確認するには -v オプションが必要です。</p><p><strong>【Bが不正解の理由】</strong><br>git clone は新しいリポジトリをローカルに複製するコマンドです。既存リポジトリのoriginURLを変更する操作ではありません。</p><p><strong>【Cが不正解の理由】</strong><br>git remote add origin は新しいリモート「origin」を追加するコマンドです。originがすでに存在する場合は「error: remote origin already exists」とエラーになります。変更には set-url を使います。</p>', 5),
  ('playwright-mock-written-a', 9, 'Git',
   '<p>featureブランチの作業をmainブランチに統合して、リモートに反映する正しい手順はどれですか？</p>',
   '{"a": "git checkout feature → git merge main → git push origin main", "b": "git checkout main → git merge feature → git push origin main", "c": "git push origin feature → git checkout main → git merge feature", "d": "git checkout main → git push origin main → git merge feature"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>mainブランチに切り替えてからfeatureブランチをマージし、その結果をリモートにpushするのが正しい手順です。マージ先のブランチ（main）にいることを確認してからmergeを実行することがポイントです。</p><p><strong>【Aが不正解の理由】</strong><br>featureブランチのまま git merge main を実行すると、mainの変更をfeatureに取り込む操作になります。mainへの統合ではなく逆方向のマージになってしまいます。</p><p><strong>【Cが不正解の理由】</strong><br>featureをリモートにpushしてからローカルでmainにマージしても、そのマージ結果がリモートのmainには反映されません。最後に git push origin main が必要です。</p><p><strong>【Dが不正解の理由】</strong><br>pushの前にmergeが完了していないため、マージ前の古い状態のmainをpushしてしまいます。merge → push の順序が正しいです。</p>', 5),
  ('playwright-mock-written-a', 10, 'コード読解',
   '<p>以下のコードを読んで、(1)何をしているか説明し、(2)問題点があれば指摘してください。</p>
<pre><code>test(''商品検索テスト'', async ({ page }) =&gt; {<br>  await page.goto(''https://example.com/shop'');<br>  await page.getByPlaceholder(''商品を検索'').fill(''Playwright本'');<br>  await page.getByRole(''button'', { name: ''検索'' }).click();<br>  const results = page.locator(''.product-item'');<br>  expect(await results.count()).toBeGreaterThan(0);<br>});</code></pre>',
   '{"a": "ショップページで商品を検索し、結果が1件以上あることを確認する。問題点はなし。", "b": "ショップページで商品を検索し、結果が1件以上あることを確認する。問題点は、検索ボタンをクリック後に結果が表示されるまでの待機処理がないため、count()が0を返しテストが不安定になる可能性がある。waitForや結果要素の表示待機を入れるべき。", "c": "fill()は非同期関数ではないためawaitは不要。それ以外は正しい。", "d": "getByPlaceholderはPlaywrightに存在しないメソッドのためエラーになる。"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>コードは「商品検索テスト」として正しい目的の処理を行っていますが、click()の直後に非同期の検索結果表示を待たずcount()を呼んでいます。ネットワーク遅延やDOMレンダリングの遅延によって.product-itemがまだ存在しない状態でcount()が実行され、0件と判定されてテストが失敗することがあります。await expect(page.locator(''.product-item'').first()).toBeVisible() などの待機処理を入れることで安定したテストになります。</p>
<p><strong>【Aが不正解の理由】</strong><br>動作説明は正しいですが「問題点なし」は誤りです。非同期処理の待機が抜けているため、実行環境や通信速度によってテスト結果が変わるフレイキー（不安定）なテストになっています。</p>
<p><strong>【Cが不正解の理由】</strong><br>fill()はPromiseを返す非同期メソッドです。awaitなしで呼び出すとfill処理の完了を待たずに次の行が実行されるため、awaitは必須です。</p>
<p><strong>【Dが不正解の理由】</strong><br>getByPlaceholder()はPlaywrightの正規のLocatorメソッドとして存在します。placeholder属性の値で要素を取得できます。</p>', 10),
  ('playwright-mock-written-a', 11, 'AAA',
   '<p>以下のコードのAAA分類として正しいものはどれですか？</p>
<pre><code>test(''パスワード変更'', async ({ page }) =&gt; {<br>  await page.goto(''https://example.com/settings'');       // (X)<br>  await page.locator(''#new-password'').fill(''NewPass!1''); // (Y)<br>  await page.locator(''#save-btn'').click();               // (Y)<br>  await expect(page.locator(''.toast'')).toHaveText(''変更しました''); // (Z)<br>});</code></pre>',
   '{"a": "X=Act、Y=Assert、Z=Arrange", "b": "X=Arrange、Y=Act、Z=Assert", "c": "X=Assert、Y=Arrange、Z=Act", "d": "X=Arrange、Y=Assert、Z=Act"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>AAAパターン（Arrange-Act-Assert）の正しい分類は以下の通りです。<br>・Arrange（準備）: page.goto() でテスト対象のページを開き、テストの前提条件を整えます。<br>・Act（実行）: fill() と click() でパスワードを入力して保存ボタンを押す操作を行います。<br>・Assert（確認）: expect().toHaveText() でトースト通知のメッセージを検証します。</p>
<p><strong>【Aが不正解の理由】</strong><br>goto()はページを「準備」するArrangeです。Actではありません。AAAの順序がX=Arrange → Y=Act → Z=Assertになっていないため不正解です。</p>
<p><strong>【Cが不正解の理由】</strong><br>goto()の段階ではまだ何も検証していないためAssertではありません。fill()とclick()はユーザー操作の実行なのでActです。</p>
<p><strong>【Dが不正解の理由】</strong><br>fill()とclick()はAssertではなくActです。expect()が含まれる(Z)がAssertです。</p>', 10),
  ('playwright-mock-written-a', 12, 'AAA',
   '<p>「会員登録ページを開き、フォームに情報を入力して送信する。登録完了メッセージが表示されることを確認する」というシナリオで、Assert（確認）に該当するのはどれですか？</p>',
   '{"a": "会員登録ページを開く", "b": "フォームに氏名・メールアドレス・パスワードを入力する", "c": "送信ボタンをクリックする", "d": "登録完了メッセージが表示されることを確認する"}'::jsonb, '{d}', false,
   '<p><strong>【正解：D】</strong><br>AAAパターンのAssert（確認）は「テストの操作によって期待通りの結果が得られたかを検証する」ステップです。「登録完了メッセージが表示されることを確認する」は結果の検証に当たるため、Assertです。</p><p><strong>【Aが不正解の理由】</strong><br>「会員登録ページを開く」はテストの前提環境を整えるArrange（準備）に該当します。</p><p><strong>【Bが不正解の理由】</strong><br>「フォームに情報を入力する」はテスト対象に対してユーザー操作を行うAct（実行）の一部に該当します。</p><p><strong>【Cが不正解の理由】</strong><br>「送信ボタンをクリックする」もAct（実行）です。フォーム入力と送信はセットでActを構成します。</p>', 10),
  ('playwright-mock-written-a', 13, 'コード並び替え',
   '<p>以下を「ログアウトして、ログアウト後のリダイレクト先を確認する」テストとして正しい順に並び替えてください。</p>
<pre><code>① await expect(page).toHaveURL(''https://example.com/login'');</code></pre>
<pre><code>② await page.goto(''https://example.com/dashboard'');</code></pre>
<pre><code>③ await page.getByRole(''button'', { name: ''ログアウト'' }).click();</code></pre>
<pre><code>④ await page.locator(''#user-menu'').click();</code></pre>
<pre><code>⑤ await page.waitForURL(''https://example.com/login'');</code></pre>',
   '{"a": "② → ③ → ④ → ⑤ → ①", "b": "② → ④ → ③ → ⑤ → ①", "c": "④ → ② → ③ → ① → ⑤", "d": "① → ② → ④ → ③ → ⑤"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>正しい操作順序は次の通りです。<br>② ダッシュボードに移動（前提ページの準備）<br>④ ユーザーメニューを開く（ログアウトボタンが表示される）<br>③ ログアウトボタンをクリック（操作の実行）<br>⑤ ログインページへのリダイレクトを待機（非同期のURL遷移を待つ）<br>① URLがログインページであることを検証（結果の確認）<br>waitForURL()で遷移完了を待ってからtoHaveURL()で検証するのが安定したテストの書き方です。</p>
<p><strong>【Aが不正解の理由】</strong><br>② → ③ の順だとユーザーメニュー（④）を開く前にログアウトボタンをクリックしようとします。ログアウトボタンはメニューを開かないと表示されないため、③はメニューオープン（④）の後でなければなりません。</p>
<p><strong>【Cが不正解の理由】</strong><br>④ ユーザーメニューのクリックをダッシュボードへの移動（②）より先に実行しています。ページを開く前にメニューをクリックしようとするため要素が存在せずエラーになります。</p>
<p><strong>【Dが不正解の理由】</strong><br>① のexpect（URLの検証）をログアウト操作より先に実行しています。まだダッシュボードにいる状態でログインページのURLを検証するためテストが失敗します。</p>', 15),
  ('playwright-mock-written-a', 14, 'POM',
   '<p>以下のPOMクラスを使って正しく動作するコードはどれですか？</p>
<pre><code>// SearchPage.js<br>class SearchPage {<br>  constructor(page) {<br>    this.page = page;<br>    this.searchInput = page.getByPlaceholder(''検索キーワード'');<br>    this.searchButton = page.getByRole(''button'', { name: ''検索'' });<br>  }<br> <br> async search(keyword) {<br>    await this.searchInput.fill(keyword);<br>    await this.searchButton.click();<br>  }<br>}</code></pre>',
   '{"a": "const searchPage = new SearchPage(page); searchPage.search(''Playwright'');", "b": "const searchPage = new SearchPage(page); await searchPage.search(''Playwright'');", "c": "const searchPage = SearchPage(page); await searchPage.search(''Playwright'');", "d": "await SearchPage.search(page, ''Playwright'');"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>new SearchPage(page) でインスタンスを正しく生成し、search()はasyncメソッドなので await を付けて呼び出します。awaitを付けることでfill()とclick()の非同期処理が完了するまで待機できます。</p>
<p><strong>【Aが不正解の理由】</strong><br>search()はasyncメソッドですがawaitなしで呼び出しています。awaitなしだとPromiseが返るだけで処理の完了を待たずに次の行が実行されるため、検索操作が完了する前にテストが終了する可能性があります。</p>
<p><strong>【Cが不正解の理由】</strong><br>newキーワードなしでSearchPage(page)を呼び出しています。JavaScriptのクラスはnewなしでコンストラクタを呼ぶと「Class constructor SearchPage cannot be invoked without ''new''」というTypeErrorになります。</p>
<p><strong>【Dが不正解の理由】</strong><br>SearchPage.search()のようにクラス名から直接メソッドを呼び出そうとしています。search()はstaticメソッドではなくインスタンスメソッドなので、必ずnewでインスタンスを生成してから呼び出す必要があります。</p>', 10);

-- Playwright社内試験 模擬筆記 セットB（14問 / 満点100点 / 合格ライン65点）
DELETE FROM exam_questions WHERE exam_id = 'playwright-mock-written-b';
INSERT INTO exams (id, name, description, pass_score, time_limit_min,
                   shuffle_questions, is_published, sort_order) VALUES
  ('playwright-mock-written-b', 'Playwright社内試験 模擬筆記 セットB',
   '全14問・満点100点。合格ライン65点。何度でも受け直せます。',
   65, NULL, true, true, 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  pass_score = EXCLUDED.pass_score, is_published = EXCLUDED.is_published,
  sort_order = EXCLUDED.sort_order;

INSERT INTO exam_questions
  (exam_id, no, category, question, choices, correct_keys, allow_multiple,
   explanation, points) VALUES
  ('playwright-mock-written-b', 1, 'locator',
   '<p>以下のHTMLで、セレクトボックスの選択肢「東京」を選ぶ正しいコードはどれですか？</p>
<pre><code>&lt;select id="city"&gt;<br>  &lt;option value="tokyo"&gt;東京&lt;/option&gt;<br>  &lt;option value="osaka"&gt;大阪&lt;/option&gt;<br>&lt;/select&gt;</code></pre>',
   '{"a": "await page.locator(''#city'').click(''東京'')", "b": "await page.locator(''#city'').selectOption(''東京'')", "c": "await page.locator(''#city'').selectOption({ label: ''東京'' })", "d": "await page.locator(''option[value=\"tokyo\"]'').click()"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>selectOption()はvalue・label・indexのいずれかでオプションを指定できます。{ label: ''東京'' }は表示テキストで選択するため、valueが変わっても壊れにくい安定した書き方です。</p>
<p><strong>【Aが不正解の理由】</strong><br>click()は引数に文字列を受け取りません。click()はクリック操作のみで、セレクトボックスの選択には使用できません。</p>
<p><strong>【Bが不正解の理由】</strong><br>selectOption(''東京'')と文字列だけを渡すとvalue=''東京''での検索になります。このHTMLではvalue=''tokyo''のため一致せず選択に失敗します。{ label: ''東京'' }とlabelオプション付きで指定する必要があります。</p>
<p><strong>【Dが不正解の理由】</strong><br>option要素を直接click()するとセレクトボックスのchangeイベントが正しく発火しない場合があります。selectOption()を使うのが推奨されます。</p>', 5),
  ('playwright-mock-written-b', 2, 'locator',
   '<p>以下のHTMLで、テキストが「送信」のボタンが複数ある場合に最初の1つだけを取得するlocatorはどれですか？</p>
<pre><code>&lt;button&gt;送信&lt;/button&gt;<br>&lt;button&gt;送信&lt;/button&gt;</code></pre>',
   '{"a": "page.getByRole(''button'', { name: ''送信'' })", "b": "page.locator(''button'').first()", "c": "page.getByRole(''button'', { name: ''送信'' }).first()", "d": "page.locator(''button:first'')"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>getByRole()でrole・nameにより意味的に絞り込んだうえで、first()で最初の1件を取得します。意味的な特定とDOM順序の組み合わせで、目的の要素を確実に取得できます。</p>
<p><strong>【Aが不正解の理由】</strong><br>getByRole()のみだと「送信」ボタンが2件ヒットしたままのLocatorが返ります。そのままclick()などを呼ぶと「厳密モード違反（strict mode violation）」エラーになります。</p>
<p><strong>【Bが不正解の理由】</strong><br>button要素全体の最初の1件を取得するため、ページに他のbuttonがあれば意図しない要素を取得する可能性があります。名前による絞り込みがなく不安定です。</p>
<p><strong>【Dが不正解の理由】</strong><br>button:firstというCSSセレクタは存在しません。正しくはbutton:first-child等ですが、Playwrightでは.first()メソッドを使うのが推奨です。</p>', 5),
  ('playwright-mock-written-b', 3, 'locator',
   '<p>以下のHTMLで、リンクテキスト「詳細を見る」のリンクを取得する最も意味的に適切なlocatorはどれですか？</p>
<pre><code>&lt;a href="/detail/1"&gt;詳細を見る&lt;/a&gt;</code></pre>',
   '{"a": "page.locator(''a[href=\"/detail/1\"]'')", "b": "page.getByRole(''link'', { name: ''詳細を見る'' })", "c": "page.getByText(''詳細を見る'')", "d": "page.locator(''.link'')"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>getByRole(''link'', { name: ''詳細を見る'' })はa要素のroleとリンクテキストで意味的に取得します。URLが変わっても壊れず、アクセシビリティの観点でも最も推奨されるlocatorです。</p>
<p><strong>【Aが不正解の理由】</strong><br>href属性値でも取得できますが、URLが/detail/2に変更されるとテストが壊れます。URLに依存した脆いlocatorです。</p>
<p><strong>【Cが不正解の理由】</strong><br>getByText()はテキストを持つあらゆる要素にマッチするため、同じテキストを持つdivやspanなども取得してしまう可能性があります。リンクであることを保証できません。</p>
<p><strong>【Dが不正解の理由】</strong><br>.linkというCSSクラスはこのHTMLには存在しません。また存在したとしてもクラス名依存のlocatorはリファクタリングで壊れやすいです。</p>', 5),
  ('playwright-mock-written-b', 4, '変数',
   '<p>以下のコードで <code>url</code> に格納される値はどれですか？</p>
<pre><code>await page.goto(''https://example.com/about'');<br>const url = page.url();</code></pre>',
   '{"a": "Promise { \"https://example.com/about\" }", "b": "{ href: \"https://example.com/about\" }", "c": "https://example.com/about", "d": "undefined"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>page.url()はawaitなしで呼び出せる同期メソッドです。現在のページのURLを文字列としてそのまま返します。</p>
<p><strong>【Aが不正解の理由】</strong><br>page.url()は同期メソッドなのでPromiseを返しません。awaitが必要なのはpage.goto()などの非同期メソッドです。</p>
<p><strong>【Bが不正解の理由】</strong><br>{ href: ... }のようなオブジェクト形式は返しません。ブラウザのwindow.locationオブジェクトのような形式ですが、page.url()はシンプルな文字列を返します。</p>
<p><strong>【Dが不正解の理由】</strong><br>page.goto()でページへ正常に遷移した後にpage.url()を呼べば必ず文字列のURLが返ります。undefinedにはなりません。</p>', 5),
  ('playwright-mock-written-b', 5, '変数',
   '<p>以下のコードで <code>attr</code> に格納される値はどれですか？</p>
<pre><code>// &lt;a id="link" href="/home"&gt;トップ&lt;/a&gt; がページに存在する<br></code><br>const attr = await page.locator(''#link'').getAttribute(''href'');</pre>',
   '{"a": "null", "b": "/home", "c": "\"#link\"", "d": "トップ"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>getAttribute(''href'')は指定した属性名の値を文字列で返します。このa要素のhref属性は''/home''なので、その値がそのまま返ります。</p>
<p><strong>【Aが不正解の理由】</strong><br>nullが返るのは指定した属性が要素に存在しない場合です。href属性は存在するため文字列が返ります。</p>
<p><strong>【Cが不正解の理由】</strong><br>"#link"はid属性の値です。getAttribute(''href'')なのでhref属性の値が返ります。idを取得したい場合はgetAttribute(''id'')を使います。</p>
<p><strong>【Dが不正解の理由】</strong><br>「トップ」はa要素のテキスト内容です。getAttribute()は属性値を返すのであり、テキスト内容を返すinnerText()とは異なります。</p>', 5),
  ('playwright-mock-written-b', 6, '変数',
   '<p>以下のコードで <code>enabled</code> に格納される値はどれですか？</p>
<pre><code>// &lt;button id="btn" disabled&gt;送信&lt;/button&gt; がページに存在する<br>const enabled = await page.locator(''#btn'').isEnabled();</code></pre>',
   '{"a": "true", "b": "\"disabled\"", "c": "null", "d": "false"}'::jsonb, '{d}', false,
   '<p><strong>【正解：D】</strong><br>isEnabled()はボタンが操作可能かどうかをboolean型で返します。disabled属性が付いているボタンは無効状態なのでfalseが返ります。</p>
<p><strong>【Aが不正解の理由】</strong><br>trueが返るのはボタンが有効（disabled属性なし）の場合です。このボタンはdisabled属性があるため無効状態です。</p>
<p><strong>【Bが不正解の理由】</strong><br>"disabled"はHTML属性名の文字列です。isEnabled()はboolean型を返すのであり、属性名の文字列は返しません。</p>
<p><strong>【Cが不正解の理由】</strong><br>nullが返るケースはありません。isEnabled()は常にtrue/falseのboolean値を返します。</p>', 5),
  ('playwright-mock-written-b', 7, 'Git',
   '<p>間違えてmainブランチに直接コミットしてしまった。そのコミットを取り消して変更内容はステージングに残す正しい手順はどれですか？</p>',
   '{"a": "git revert HEAD", "b": "git reset --hard HEAD~1", "c": "git reset --soft HEAD~1", "d": "git checkout HEAD~1"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>git reset --soft HEAD~1 はコミットを取り消しますが、変更内容はステージング済み（インデックス）の状態のまま保持します。別ブランチに移動してから再コミットしたい場合に最適な手順です。</p><p><strong>【Aが不正解の理由】</strong><br>git revert HEADは直前のコミットを「打ち消すコミット」を新たに作成します。コミットを削除するのではなく追加するため、履歴にrevertコミットが残ります。変更をステージングに戻す操作ではありません。</p><p><strong>【Bが不正解の理由】</strong><br>git reset --hard HEAD~1 はコミットを取り消すだけでなく、作業ディレクトリの変更内容も完全に破棄します。変更をステージングに残したい場合には使えません。</p><p><strong>【Dが不正解の理由】</strong><br>git checkout HEAD~1 は1つ前のコミットの状態に「detached HEAD」で移動するだけです。コミットの取り消しもステージングへの復元も行いません。</p>', 5),
  ('playwright-mock-written-b', 8, 'Git',
   '<p>リモートの main ブランチをローカルに取得して、ローカル main を最新化する正しい手順はどれですか？</p>',
   '{"a": "git fetch origin main → git rebase origin/main", "b": "git pull origin main", "c": "git clone origin main", "d": "git checkout origin/main"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>git pull origin main はリモートのmainブランチをfetchしてローカルのmainにマージする操作を1コマンドで行います。ローカルを最新化する最もシンプルな手順です。</p><p><strong>【Aが不正解の理由】</strong><br>git fetch + git rebase の組み合わせも最新化できますが、rebaseはコミット履歴を書き換えるため通常のpullより複雑です。チームのワークフロー次第では使いますが、シンプルな最新化にはpullが適切です。</p><p><strong>【Cが不正解の理由】</strong><br>git clone はリモートリポジトリを新規にローカルへ複製するコマンドです。既存のローカルリポジトリを更新する操作ではありません。</p><p><strong>【Dが不正解の理由】</strong><br>git checkout origin/main はリモート追跡ブランチをdetached HEADで参照するだけです。ローカルのmainブランチ自体を最新化する操作ではありません。</p>', 5),
  ('playwright-mock-written-b', 9, 'Git',
   '<p>stashに退避した変更を確認してから、最新のstashを元のブランチに戻す正しい手順はどれですか？</p>',
   '{"a": "git stash show → git stash apply", "b": "git stash list → git stash pop", "c": "git stash view → git stash restore", "d": "git stash log → git stash drop"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>git stash list でstashの一覧（stash@{0}, stash@{1}...）を確認し、git stash pop で最新のstash（stash@{0}）を適用しつつstashから削除します。確認して復元・削除まで完結する最もシンプルな手順です。</p><p><strong>【Aが不正解の理由】</strong><br>git stash show は最新stashの変更差分を表示しますが一覧は表示しません。またgit stash apply は適用後もstashに変更が残り続けます。popと違い自動削除されないため、不要なstashが蓄積します。</p><p><strong>【Cが不正解の理由】</strong><br>git stash view およびgit stash restore はgitに存在しないコマンドです。実行するとエラーになります。</p><p><strong>【Dが不正解の理由】</strong><br>git stash log はgitに存在しないコマンドです。またgit stash drop は変更を適用せずにstashから削除するコマンドで、変更内容を捨てることになります。</p>', 5),
  ('playwright-mock-written-b', 10, 'コード読解',
   '<p>以下のコードを読んで、(1)何をしているか説明し、(2)問題点があれば指摘してください。</p>
<pre><code>test(''お気に入り追加テスト'', async ({ page }) =&gt; {<br>  await page.goto(''https://example.com/items/1'');<br>  await page.locator(''.favorite-btn'').click();<br>  await page.goto(''https://example.com/favorites'');<br>  const count = await page.locator(''.fav-item'').count();<br>  expect(count).toBe(1);<br>});</code></pre>',
   '{"a": "商品ページでお気に入りボタンをクリックし、お気に入りページに遷移して件数を確認する。問題なし。", "b": "商品ページでお気に入りボタンをクリックし、お気に入りページに遷移して件数を確認する。問題点は、お気に入りボタンクリック後の処理（サーバー反映）を待たずにページ遷移しており、お気に入りが反映される前に次のページを開く可能性がある。waitForResponseやwaitForSelectorで反映を待つべき。", "c": ".favorite-btnというlocatorは不正なため、クリック処理がエラーになる。", "d": "count()は同期メソッドなのでawaitは不要。それ以外は正しい。"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>動作の説明は正しいですが、click()の直後に非同期のAPIリクエスト（お気に入り登録）の完了を待たずにpage.goto()でページ遷移しています。サーバーへの反映が未完了の状態でお気に入りページを開くと0件と判定されテストが失敗する場合があります。page.waitForResponse()やwaitForSelector()で反映完了を待ってからgoto()するのが安定したテストの書き方です。</p>
<p><strong>【Aが不正解の理由】</strong><br>「問題なし」は誤りです。非同期処理の完了待機が抜けているため、実行タイミングによって結果が変わるフレイキーなテストになっています。</p>
<p><strong>【Cが不正解の理由】</strong><br>.favorite-btnはCSSクラスセレクタとして正しい書式です。エラーにはなりません。</p>
<p><strong>【Dが不正解の理由】</strong><br>count()はPromiseを返す非同期メソッドです。awaitなしで呼ぶと数値ではなくPromiseオブジェクトが返り、toBe(1)のアサーションが常に失敗します。</p>', 10),
  ('playwright-mock-written-b', 11, 'AAA',
   '<p>以下のコードのAAA分類として正しいものはどれですか？</p>
<pre><code>test(''ファイルアップロード'', async ({ page }) =&gt; {<br>  await page.goto(''https://example.com/upload'');                      // (X)<br>  await page.locator(''#file-input'').setInputFiles(''test.png'');        // (Y)<br>  await page.getByRole(''button'', { name: ''アップロード'' }).click(); 　  // (Y)<br>  await expect(page.locator(''.upload-success'')).toBeVisible();        // (Z)<br>});</code></pre>',
   '{"a": "X=Assert、Y=Act、Z=Arrange", "b": "X=Act、Y=Arrange、Z=Assert", "c": "X=Arrange、Y=Act、Z=Assert", "d": "X=Arrange、Y=Assert、Z=Act"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>AAAの正しい分類は以下の通りです。<br>・Arrange（準備）: page.goto() でアップロードページを開き、前提条件を整えます。<br>・Act（実行）: setInputFiles() でファイルを選択し、click() でアップロードを実行します。<br>・Assert（確認）: expect().toBeVisible() でアップロード成功メッセージを検証します。</p>
<p><strong>【Aが不正解の理由】</strong><br>goto()はページの準備であるArrangeです。Assertではありません。AAAの順序がAssert→Act→Arrangeになっており、論理的に逆転しています。</p>
<p><strong>【Bが不正解の理由】</strong><br>goto()はActではなくArrangeです。setInputFiles()はユーザー操作の実行であるActです。分類が全体的にずれています。</p>
<p><strong>【Dが不正解の理由】</strong><br>setInputFiles()とclick()はAssertではなくActです。expect()を含む(Z)がAssertです。</p>', 10),
  ('playwright-mock-written-b', 12, 'AAA',
   '<p>「ユーザー一覧ページを開き、フィルターで『管理者』を選択する。一覧に管理者ユーザーだけが表示されることを確認する」というシナリオで、Arrange（準備）に該当するのはどれですか？</p>',
   '{"a": "フィルターで『管理者』を選択する", "b": "管理者ユーザーだけが表示されることを確認する", "c": "ユーザー一覧ページを開く", "d": "検索ボタンをクリックする"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>Arrange（準備）はテストを実行するための前提条件・環境を整えるフェーズです。「ユーザー一覧ページを開く」はテスト対象ページへのナビゲーションであり、操作の前提を整えるArrangeに該当します。</p><p><strong>【Aが不正解の理由】</strong><br>「フィルターで管理者を選択する」はユーザーがUIを操作するActです。前提条件の準備ではありません。</p><p><strong>【Bが不正解の理由】</strong><br>「管理者ユーザーだけが表示されることを確認する」は結果を検証するAssertです。</p><p><strong>【Dが不正解の理由】</strong><br>「検索ボタンをクリックする」は操作の実行であるActです。このシナリオでは記述されていませんが、あったとしてもActに分類されます。</p>', 10),
  ('playwright-mock-written-b', 13, 'コード並び替え',
   '<p>以下を「テキストエリアに文章を入力してプレビューに反映されることを確認する」テストとして正しい順に並び替えてください。</p>
<pre><code>① await expect(page.locator(''#preview'')).toContainText(''テスト投稿です'');<br>② await page.locator(''#preview-btn'').click();<br>③ await page.goto(''https://example.com/post/new'');<br>④ await page.locator(''#content'').fill(''テスト投稿です'');<br>⑤ await page.locator(''#preview'').waitFor({ state: ''visible'' });</code></pre>',
   '{"a": "③ → ④ → ② → ⑤ → ①", "b": "③ → ② → ④ → ⑤ → ①", "c": "④ → ③ → ② → ① → ⑤", "d": "③ → ④ → ⑤ → ② → ①"}'::jsonb, '{a}', false,
   '<p><strong>【正解：A】</strong><br>正しい操作順序は以下の通りです。<br>③ 投稿作成ページへ移動（Arrange）<br>④ テキストエリアに本文を入力（Act）<br>② プレビューボタンをクリック（Act）<br>⑤ プレビューエリアが表示されるまで待機（プレビュー描画の完了を待つ）<br>① プレビューに入力内容が含まれることを検証（Assert）<br>waitFor()でDOM表示を待ってからアサーションすることで安定したテストになります。</p>
<p><strong>【Bが不正解の理由】</strong><br>③ → ② の順ではテキストを入力する前にプレビューボタンをクリックしています。内容が空のままプレビューされるため、その後④でfill()しても反映されません。</p>
<p><strong>【Cが不正解の理由】</strong><br>④ ページ移動（③）より前にfill()を実行しています。ページを開く前にテキストエリアは存在しないためエラーになります。</p>
<p><strong>【Dが不正解の理由】</strong><br>③ → ④ → ⑤ の順ではプレビューボタンをクリック（②）する前にwaitFor()を呼んでいます。プレビュー表示のトリガーを実行していないためwaitFor()がタイムアウトします。</p>', 15),
  ('playwright-mock-written-b', 14, 'POM',
   '<p>以下のPOMクラスを使って正しく動作するコードはどれですか？</p>
<pre><code>// CartPage.js<br>class CartPage {<br>  constructor(page) {<br>    this.page = page;<br>    this.cartItems = page.locator(''.cart-item'');  <br>    this.checkoutButton = page.getByRole(''button'', { name: ''購入手続きへ'' });<br>  }<br><br>  async getItemCount() {<br>    return await this.cartItems.count();<br>  }<br><br>  async checkout() {<br>    await this.checkoutButton.click();<br>  }<br>}</code></pre>',
   '{"a": "test(''カートテスト'', async ({ page }) => {\n　const cart = new CartPage(page);\n　const count = cart.getItemCount();\n　expect(count).toBe(2);\n});", "b": "test(''カートテスト'', async ({ page }) => {\n  const cart = CartPage(page);\n  const count = await cart.getItemCount();\n  expect(count).toBe(2);\n});", "c": "test(''カートテスト'', async ({ page }) => {\n  const cart = new CartPage(page);\n  const count = await cart.getItemCount();\n  expect(count).toBe(2);\n});", "d": "test(''カートテスト'', async ({ page }) => {\n  const cart = new CartPage();\n  const count = await cart.getItemCount();\n  expect(count).toBe(2);\n});"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>new CartPage(page)でインスタンスを正しく生成し、getItemCount()はasyncメソッドなのでawaitを付けて呼び出します。countは数値として返るのでtoBe(2)で正しく検証できます。</p>
<p><strong>【Aが不正解の理由】</strong><br>getItemCount()にawaitがありません。awaitなしだとPromiseオブジェクトが返り、expect(Promise).toBe(2)は常に失敗します。</p>
<p><strong>【Bが不正解の理由】</strong><br>newキーワードなしでCartPage(page)を呼んでいます。クラスはnewなしでは呼び出せず「Cannot call a class as a function」というTypeErrorになります。</p>
<p><strong>【Dが不正解の理由】</strong><br>new CartPage()とpageを引数に渡していません。constructorでthis.page = pageを参照するためpageがundefinedになり、page.locator()呼び出し時にエラーになります。</p>', 10);

-- Playwright社内試験 模擬筆記 セットC（14問 / 満点100点 / 合格ライン65点）
DELETE FROM exam_questions WHERE exam_id = 'playwright-mock-written-c';
INSERT INTO exams (id, name, description, pass_score, time_limit_min,
                   shuffle_questions, is_published, sort_order) VALUES
  ('playwright-mock-written-c', 'Playwright社内試験 模擬筆記 セットC',
   '全14問・満点100点。合格ライン65点。何度でも受け直せます。',
   65, NULL, true, true, 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  pass_score = EXCLUDED.pass_score, is_published = EXCLUDED.is_published,
  sort_order = EXCLUDED.sort_order;

INSERT INTO exam_questions
  (exam_id, no, category, question, choices, correct_keys, allow_multiple,
   explanation, points) VALUES
  ('playwright-mock-written-c', 1, 'locator',
   '<p>以下のHTMLで、モーダル内の「閉じる」ボタンのみを取得する正しいlocatorはどれですか？</p>
<pre><code>&lt;div&gt;<br>  &lt;button&gt;閉じる&lt;/button&gt;<br>&lt;/div&gt;<br>&lt;button&gt;閉じる&lt;/button&gt;</code></pre>',
   '{"a": "page.getByRole(''button'', { name: ''閉じる'' }).first()", "b": "page.locator(''.modal'').getByRole(''button'', { name: ''閉じる'' })", "c": "page.locator(''.modal button'')", "d": "page.locator(''button'').nth(0)"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>page.locator(''.modal'')でモーダルコンテナに絞り込んでから.getByRole()を使うことで、スコープを限定して意味的に目的のボタンを取得できます。Playwrightが推奨するlocatorのチェーンの使い方です。</p>
<p><strong>【Aが不正解の理由】</strong><br>first()は現在のDOM順で最初の要素を返しますが、モーダルのボタンがDOM上で最初とは限りません。将来的にDOMの順序が変わると壊れる脆いlocatorです。</p>
<p><strong>【Cが不正解の理由】</strong><br>.modal buttonというCSSセレクタもモーダル内のボタンを取得できますが、ボタンのrole・nameによる意味的な特定がないため、モーダル内に複数ボタンが追加されると壊れやすいです。Bの方がより堅牢です。</p>
<p><strong>【Dが不正解の理由】</strong><br>button要素全体のnth(0)を取得するため、ページ内の全buttonの中でDOM順序が最初のものを取得します。モーダルのボタンが必ず0番目とは限りません。</p>', 5),
  ('playwright-mock-written-c', 2, 'locator',
   '<p>以下のHTMLで、テーブルの2行目2列目のセルを取得する正しいlocatorはどれですか？</p>
<pre><code>&lt;table&gt;<br>  &lt;tr&gt;&lt;td&gt;A1&lt;/td&gt;&lt;td&gt;A2&lt;/td&gt;&lt;/tr&gt;<br>  &lt;tr&gt;&lt;td&gt;B1&lt;/td&gt;&lt;td&gt;B2&lt;/td&gt;&lt;/tr&gt;<br>&lt;/table&gt;</code></pre>',
   '{"a": "page.locator(''tr'').nth(1).locator(''td'').nth(1)", "b": "page.locator(''td[row=2][col=2]'')", "c": "page.locator(''table > tr:2 > td:2'')", "d": "page.locator(''tr:nth-child(2) td:nth-child(2)'')"}'::jsonb, '{a,d}', true,
   '<p><strong>【正解：AまたはD（両方正解）】</strong><br>AはPlaywrightのLocatorチェーンを使い、tr要素の2番目（インデックス1）からtd要素の2番目を取得する書き方です。直感的でPlaywrightらしい書き方です。<br>Dはtr:nth-child(2) td:nth-child(2)というCSSセレクタで、CSSの擬似クラスによる2行目2列目の指定です。nth-childは1始まりなので(2)が2番目を意味します。どちらも正しく動作します。</p>
<p><strong>【Bが不正解の理由】</strong><br>td[row=2][col=2]はrow・col属性を持つtd要素を指定するCSSセレクタです。このHTMLにはrow・col属性は存在しないため何も取得できません。</p>
<p><strong>【Cが不正解の理由】</strong><br>table &gt; tr:2 &gt; td:2 というCSSセレクタの書き方は存在しません。CSSで番号指定する場合は:nth-child(2)の形式が正しいです。</p>', 5),
  ('playwright-mock-written-c', 3, 'locator',
   '<p>以下のHTMLで data-status="active" を持つ要素のみを取得する正しいlocatorはどれですか？</p>
<pre><code>&lt;div data-status="active"&gt;有効&lt;/div&gt;<br>&lt;div data-status="inactive"&gt;無効&lt;/div&gt;</code></pre>',
   '{"a": "page.locator(''div.active'')", "b": "page.locator(''[data-status]'')", "c": "page.locator(''[data-status=\"active\"]'')", "d": "page.locator(''div:has-text(\"有効\")'')"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>[data-status="active"]はdata-status属性の値が"active"に完全一致する要素を取得するCSSセレクタです。data属性の値で絞り込む正しい方法です。</p>
<p><strong>【Aが不正解の理由】</strong><br>div.activeはCSSクラス名が"active"のdivを指します。このHTMLにはclass属性がないため何も取得できません。data属性とclass属性は別物です。</p>
<p><strong>【Bが不正解の理由】</strong><br>[data-status]はdata-status属性を持つすべての要素にマッチします。activeとinactiveの両方が取得されてしまい、activeのみに絞り込めません。</p>
<p><strong>【Dが不正解の理由】</strong><br>div:has-text("有効")はテキスト内容で絞り込む擬似クラスです。「有効」というテキストで絞り込めますが、将来テキストが変更されると壊れます。data属性という明示的な状態情報があるのでCを使う方が安定しています。</p>', 5),
  ('playwright-mock-written-c', 4, '変数',
   '<p>以下のコードで <code>texts</code> に格納される値の型はどれですか？</p>
<pre><code>const texts = await page.locator(''li'').allInnerTexts();</code></pre>',
   '{"a": "string", "b": "string[]（文字列の配列）", "c": "Promise<string[]>", "d": "number"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>allInnerTexts()はマッチしたすべての要素のinnerTextを配列にまとめて返します。awaitで解決した後の型はstring[]（文字列の配列）です。例えば[''Apple'', ''Banana'', ''Cherry'']のような配列になります。</p>
<p><strong>【Aが不正解の理由】</strong><br>string（単一の文字列）を返すのはinnerText()です。allInnerTexts()は複数要素を対象とするため配列で返します。</p>
<p><strong>【Cが不正解の理由】</strong><br>Promise&lt;string[]&gt;はawait前の型です。awaitで解決した後のtextsの型はstring[]です。</p>
<p><strong>【Dが不正解の理由】</strong><br>numberを返すメソッドはcount()などです。allInnerTexts()はテキスト文字列の配列を返します。</p>', 5),
  ('playwright-mock-written-c', 5, '変数',
   '<p>以下のコードで <code>box</code> に格納される値はどれですか？</p>
<pre><code>// #btn が画面内に存在する<br></code><br>const box = await page.locator(''#btn'').boundingBox();</pre>',
   '{"a": "null", "b": "true", "c": "{ x: number, y: number, width: number, height: number } の形式のオブジェクト", "d": "string"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>boundingBox()は要素のビューポート上の位置とサイズを{ x, y, width, height }の形式のオブジェクトで返します。要素のピクセル座標やサイズを取得したい場合に使います。</p>
<p><strong>【Aが不正解の理由】</strong><br>nullが返るのは要素がビューポート外にあるか、表示されていない場合です。問題文では#btnが画面内に存在するのでオブジェクトが返ります。</p>
<p><strong>【Bが不正解の理由】</strong><br>trueのようなboolean値を返すのはisVisible()やisEnabled()などです。boundingBox()は座標情報のオブジェクトを返します。</p>
<p><strong>【Dが不正解の理由】</strong><br>stringを返すメソッドはinnerText()やgetAttribute()などです。boundingBox()はオブジェクトを返します。</p>', 5),
  ('playwright-mock-written-c', 6, '変数',
   '<p>以下のコードで <code>html</code> に格納される値はどれですか？</p>
<pre><code>// &lt;p id="msg"&gt;&lt;strong&gt;重要&lt;/strong&gt;なお知らせ&lt;/p&gt; がページに存在する<br>const html = await page.locator(''#msg'').innerHTML();</code></pre>',
   '{"a": "重要なお知らせ", "b": "<p id=\"msg\"><strong>重要</strong>なお知らせ</p>", "c": "<strong>重要</strong>なお知らせ", "d": "重要"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>innerHTML()は要素の内側のHTMLを文字列として返します。対象要素（#msg）のpタグ自体は含まれず、その内側にある&lt;strong&gt;重要&lt;/strong&gt;なお知らせというHTMLが返ります。</p>
<p><strong>【Aが不正解の理由】</strong><br>「重要なお知らせ」というテキストのみを返すのはinnerText()です。innerHTML()はHTMLタグを含む内側の文字列を返します。</p>
<p><strong>【Bが不正解の理由】</strong><br>&lt;p id="msg"&gt;...&lt;/p&gt;のように要素自身のタグを含む外側のHTMLを返すのはouterHTML()です。innerHTML()は要素の内側のHTMLのみです。</p>
<p><strong>【Dが不正解の理由】</strong><br>「重要」はstrongタグのテキスト内容のみです。innerHTML()はstrong要素のタグも含む内側全体を返します。</p>', 5),
  ('playwright-mock-written-c', 7, 'Git',
   '<p>特定のコミット（SHA: abc1234）の内容だけを現在のブランチに取り込む正しい操作はどれですか？</p>',
   '{"a": "git merge abc1234", "b": "git cherry-pick abc1234", "c": "git rebase abc1234", "d": "git checkout abc1234"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>git cherry-pickは指定したコミットSHAの変更内容だけを現在のブランチに適用します。「あのブランチの特定のバグ修正だけを取り込みたい」といった場面で使われます。</p><p><strong>【Aが不正解の理由】</strong><br>git merge abc1234はそのコミットまでの全変更をマージします。指定コミット単体だけでなく、そこに至るすべての変更が対象になります。</p><p><strong>【Cが不正解の理由】</strong><br>git rebase abc1234は現在のブランチの起点をabc1234に変更する操作です。特定コミットの内容だけを取り込む操作ではありません。</p><p><strong>【Dが不正解の理由】</strong><br>git checkout abc1234はそのコミット時点の状態に「detached HEAD」で移動するだけです。変更を現在のブランチに取り込む操作ではありません。</p>', 5),
  ('playwright-mock-written-c', 8, 'Git',
   '<p>誤ってステージングした特定のファイルだけをアンステージする正しい操作はどれですか？</p>',
   '{"a": "git reset HEAD <ファイル名>", "b": "git checkout <ファイル名>", "c": "git stash <ファイル名>", "d": "git revert <ファイル名>"}'::jsonb, '{a}', false,
   '<p><strong>【正解：A】</strong><br>git reset HEAD &lt;ファイル名&gt;は指定したファイルだけをステージング（インデックス）から取り除きます。作業ディレクトリの変更内容は保持したままアンステージできます。</p><p><strong>【Bが不正解の理由】</strong><br>git checkout &lt;ファイル名&gt;はアンステージではなく、作業ディレクトリのファイルをHEAD（最後のコミット）の内容に戻す操作です。未コミットの変更が失われてしまいます。</p><p><strong>【Cが不正解の理由】</strong><br>git stashはステージング・非ステージング含む全変更を一時退避する操作です。特定ファイルのアンステージではありません。</p><p><strong>【Dが不正解の理由】</strong><br>git revertはコミットを打ち消す新しいコミットを作成する操作で、ファイル名は引数に取りません。アンステージには使用できません。</p>', 5),
  ('playwright-mock-written-c', 9, 'Git',
   '<p>ローカルブランチの一覧を確認してから、不要なローカルブランチを削除する正しい手順はどれですか？</p>',
   '{"a": "git branch → git branch -D <ブランチ名>", "b": "git log → git branch --delete <ブランチ名>", "c": "git branch -a → git remote remove <ブランチ名>", "d": "git status → git branch -d <ブランチ名>"}'::jsonb, '{a}', false,
   '<p><strong>【正解：A】</strong><br>git branchでローカルブランチの一覧を確認し、git branch -D &lt;ブランチ名&gt;で強制削除します。-D（大文字）は未マージでも強制削除できるオプションです。不要なブランチを確実に削除できます。</p><p><strong>【Bが不正解の理由】</strong><br>git logはコミット履歴を表示するコマンドでブランチ一覧は表示できません。また、git branch --deleteは-dの正式名称で動作しますが、一覧確認の手順が誤っています。</p><p><strong>【Cが不正解の理由】</strong><br>git branch -aはローカル＋リモート追跡ブランチの一覧を表示します。確認には使えますが、git remote removeはリモートURL自体を削除するコマンドでブランチ削除ではありません。</p><p><strong>【Dが不正解の理由】</strong><br>git statusは現在のブランチの変更状態を表示しますがブランチ一覧は表示しません。また-d（小文字）は未マージのブランチは削除できずエラーになります。</p>', 5),
  ('playwright-mock-written-c', 10, 'コード読解',
   '<p>以下のコードを読んで、(1)何をしているか説明し、(2)問題点があれば指摘してください。</p>
<pre><code>test(''通知設定の切り替えテスト'', async ({ page }) =&gt; {<br>  await page.goto(''https://example.com/settings/notification'');<br>  const toggle = page.locator(''#notify-toggle'');<br>  await toggle.click();<br>  await toggle.click();<br>  await expect(toggle).toHaveAttribute(''aria-checked'', ''false'');<br>});</code></pre>',
   '{"a": "通知トグルを2回クリックして、最終的にOFFになっていることを確認する。問題なし。", "b": "通知トグルを2回クリックして、最終的にOFFになっていることを確認する。問題点は、各クリック後の状態変化をDOMが反映するまで待機しておらず、2回目クリック時点でトグルの状態が不定になる可能性がある。クリックの間にwaitForやexpectによる状態確認を挟むべき。", "c": "toHaveAttributeはPlaywrightには存在しないメソッドのため、最後のアサーションがエラーになる。", "d": "page.locator()にawaitがついていないためエラーになる。"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>コードの説明は正しいですが、1回目のclick()後にaria-checkedがtrueに更新されるDOMの変化を待たずに2回目のclick()を実行しています。トグルの状態遷移がアニメーションや非同期処理を伴う場合、2回目のクリックが1回目の状態変化前に走り、結果が不定になります。1回目のクリック後にexpect(toggle).toHaveAttribute(''aria-checked'', ''true'')で状態変化を確認してから2回目をクリックするのが安定した書き方です。</p>
<p><strong>【Aが不正解の理由】</strong><br>「問題なし」は誤りです。クリック間の待機処理が不足しており、環境によって2回目のクリックが反映前に実行される可能性があります。</p>
<p><strong>【Cが不正解の理由】</strong><br>toHaveAttribute()はPlaywrightのexpectに存在するマッチャーです。エラーにはなりません。</p>
<p><strong>【Dが不正解の理由】</strong><br>page.locator()はLocatorオブジェクトを返す同期メソッドです。awaitは不要であり、awaitなしで正しく動作します。</p>', 10),
  ('playwright-mock-written-c', 11, 'AAA',
   '<p>以下のコードのAAA分類として正しいものはどれですか？</p>
<pre><code>test(''金額フィルター'', async ({ page }) =&gt; {</code><br>await page.goto(''https://example.com/products'');  // (X)<br>await page.locator(''#max-price'').fill(''5000'');  // (Y)<br>await page.getByRole(''button'', { name: ''絞り込む'' }).click(); 　　　　　　　 // (Y)<br>await expect(page.locator(''.product-price'').first()).toContainText(''¥''); // (Z)<br>});</pre>',
   '{"a": "X=Arrange、Y=Act、Z=Assert", "b": "X=Act、Y=Assert、Z=Arrange", "c": "X=Assert、Y=Arrange、Z=Act", "d": "X=Arrange、Y=Assert、Z=Act"}'::jsonb, '{a}', false,
   '<p><strong>【正解：A】</strong><br>AAAの正しい分類は以下の通りです。<br>・Arrange（準備）: page.goto()で商品一覧ページを開き、テストの前提条件を整えます。<br>・Act（実行）: fill()で金額を入力し、click()で絞り込みを実行します。<br>・Assert（確認）: expect().toContainText()で価格表示に¥が含まれることを検証します。</p>
<p><strong>【Bが不正解の理由】</strong><br>goto()はActではなくArrangeです。分類全体がずれており論理的な順序になっていません。</p>
<p><strong>【Cが不正解の理由】</strong><br>goto()の段階ではまだ何も検証していないためAssertではありません。fill()とclick()はActです。</p>
<p><strong>【Dが不正解の理由】</strong><br>fill()とclick()はAssertではなくActです。expect()を含む(Z)がAssertです。</p>', 10),
  ('playwright-mock-written-c', 12, 'AAA',
   '<p>「マイページを開き、プロフィール編集ボタンをクリックして名前を変更し保存する。マイページに戻って変更後の名前が表示されることを確認する」というシナリオで、Act（操作）に該当するものをすべて含む選択肢はどれですか？</p>',
   '{"a": "マイページを開くこと", "b": "プロフィール編集ボタンをクリックし、名前を変更して保存ボタンを押すこと", "c": "変更後の名前がマイページに表示されていることを確認すること", "d": "テスト用ユーザーアカウントを用意すること"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>Act（実行）はテスト対象機能をユーザーが操作するフェーズです。「プロフィール編集ボタンをクリックする→名前を変更する→保存ボタンを押す」の一連の操作がActに該当します。</p><p><strong>【Aが不正解の理由】</strong><br>「マイページを開く」はテストの前提環境を整えるArrangeです。テスト対象の操作ではありません。</p><p><strong>【Cが不正解の理由】</strong><br>「変更後の名前が表示されることを確認する」は結果を検証するAssertです。</p><p><strong>【Dが不正解の理由】</strong><br>「テスト用ユーザーアカウントを用意する」はテスト実行前の準備であるArrangeに分類されます（テストデータのセットアップ）。</p>', 10),
  ('playwright-mock-written-c', 13, 'コード並び替え',
   '<p>以下を「数量を変更してカート合計金額が更新されることを確認する」テストとして正しい順に並び替えてください。</p>
<pre><code>① await expect(page.locator(''#total-price'')).not.toHaveText(initialPrice);<br>② await page.goto(''https://example.com/cart'');<br>③ const initialPrice = await page.locator(''#total-price'').innerText();<br>④ await page.locator(''#quantity'').selectOption(''3'');<br>⑤ await page.locator(''#update-cart'').click();</code></pre>',
   '{"a": "② → ③ → ④ → ⑤ → ①", "b": "③ → ② → ④ → ⑤ → ①", "c": "② → ④ → ③ → ⑤ → ①", "d": "② → ③ → ⑤ → ④ → ①"}'::jsonb, '{a}', false,
   '<p><strong>【正解：A】</strong><br>正しい操作順序は以下の通りです。<br>② カートページへ移動（Arrange）<br>③ 変更前の合計金額を取得（比較基準として保存）<br>④ 数量を3に変更（Act）<br>⑤ カート更新ボタンをクリック（Act）<br>① 合計金額が変更前と異なることを検証（Assert）<br>③で変更前の値を先に保存しておくことで、①の比較アサーションが成立します。</p>
<p><strong>【Bが不正解の理由】</strong><br>③ページへの移動（②）より先にinnerText()を呼んでいます。ページを開く前に#total-priceは存在しないためエラーになります。</p>
<p><strong>【Cが不正解の理由】</strong><br>② → ④ の順では、初期金額（③）を保存する前に数量を変更しています。③で取得するのは変更後の金額になるため、①の比較が意味を持ちません。</p>
<p><strong>【Dが不正解の理由】</strong><br>③で初期金額を保存した後、⑤カート更新を数量変更（④）より先に実行しています。数量を変えずに更新しても金額は変わらないため①のアサーションが失敗します。</p>', 15),
  ('playwright-mock-written-c', 14, 'POM',
   '<p>以下のPOMを使って、ページ見出しを取得して検証する正しいコードはどれですか？</p>
<pre><code>// DashboardPage.js<br>class DashboardPage {<br>  constructor(page) {<br>    this.page = page;<br>    this.heading = page.locator(''h1'');<br>  }<br><br>  async getHeadingText() {<br>    return await this.heading.innerText(); <br>  }<br>}</code></pre>',
   '{"a": "test(''見出し確認'', async ({ page }) => {\n　const dashboard = new DashboardPage(page);\n　await page.goto(''https://example.com/dashboard'');\n　const text = dashboard.getHeadingText();\n　expect(text).toBe(''ダッシュボード'');\n});", "b": "test(''見出し確認'', async ({ page }) => {\n　await page.goto(''https://example.com/dashboard'');\n　const dashboard = new DashboardPage(page);\n　const text = await dashboard.getHeadingText();\n　expect(text).toBe(''ダッシュボード'');\n});", "c": "test(''見出し確認'', async ({ page }) => {\n　await page.goto(''https://example.com/dashboard'');\n　const dashboard = DashboardPage(page);\n　const text = await dashboard.getHeadingText();\n　expect(text).toBe(''ダッシュボード'');\n});", "d": "test(''見出し確認'', async ({ page }) => {\n　await page.goto(''https://example.com/dashboard'');\n　const text = await DashboardPage.getHeadingText(page);\n　expect(text).toBe(''ダッシュボード'');\n});"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>goto()でページを開いてからnew DashboardPage(page)でインスタンスを生成し、getHeadingText()にawaitを付けて呼び出します。ページ遷移後にインスタンスを作ることでh1要素を正しく参照できます。</p>
<p><strong>【Aが不正解の理由】</strong><br>getHeadingText()にawaitがありません。awaitなしだとPromiseが返り、expect(Promise).toBe(''ダッシュボード'')は常に失敗します。</p>
<p><strong>【Cが不正解の理由】</strong><br>newキーワードなしでDashboardPage(page)を呼んでいます。クラスはnewなしでは呼び出せずTypeErrorになります。</p>
<p><strong>【Dが不正解の理由】</strong><br>DashboardPage.getHeadingText(page)はstaticメソッドの呼び出し形式です。getHeadingText()はインスタンスメソッドなので、必ずnewでインスタンスを作ってから呼ぶ必要があります。</p>', 10);

-- Playwright社内試験 模擬筆記 セットD（14問 / 満点100点 / 合格ライン65点）
DELETE FROM exam_questions WHERE exam_id = 'playwright-mock-written-d';
INSERT INTO exams (id, name, description, pass_score, time_limit_min,
                   shuffle_questions, is_published, sort_order) VALUES
  ('playwright-mock-written-d', 'Playwright社内試験 模擬筆記 セットD',
   '全14問・満点100点。合格ライン65点。何度でも受け直せます。',
   65, NULL, true, true, 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  pass_score = EXCLUDED.pass_score, is_published = EXCLUDED.is_published,
  sort_order = EXCLUDED.sort_order;

INSERT INTO exam_questions
  (exam_id, no, category, question, choices, correct_keys, allow_multiple,
   explanation, points) VALUES
  ('playwright-mock-written-d', 1, 'locator',
   '<p>以下のHTMLで、disabled な入力フィールドを取得する正しいlocatorはどれですか？</p>
<pre><code>&lt;input type="text" id="readonly-name" disabled value="山田太郎" /&gt;</code></pre>',
   '{"a": "page.locator(''input.disabled'')", "b": "page.locator(''input[disabled]'')", "c": "page.locator(''#readonly-name'')", "d": "page.locator(''input:not([enabled])'')"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>idで取得するpage.locator(''#readonly-name'')は最も確実で明確なlocatorです。disabledかどうかに関わらずidは要素を一意に特定できるため、設計変更の影響を受けにくい安定した書き方です。</p>
<p><strong>【Aが不正解の理由】</strong><br>input.disabledはCSSクラス名がdisabledのinputを指します。HTML属性のdisabledとCSSクラスのdisabledは別物です。このHTMLにはclassが指定されていないためマッチしません。</p>
<p><strong>【Bが不正解の理由】</strong><br>input[disabled]はdisabled属性を持つinputを取得できますが、ページに複数のdisabledなinputがある場合は絞り込めません。idがある場合はidを使う方が確実です。</p>
<p><strong>【Dが不正解の理由】</strong><br>input:not([enabled])という書き方は誤りです。enabled属性はHTMLに存在しません。disabled属性の有無で判定するにはinput[disabled]または:disabled擬似クラスを使います。</p>', 5),
  ('playwright-mock-written-d', 2, 'locator',
   '<p>以下のHTMLで、role="alert" を持つ要素を取得する最も意味的に適切なlocatorはどれですか？</p>
<pre><code>&lt;div role="alert"&gt;入力が正しくありません&lt;/div&gt;</code></pre>',
   '{"a": "page.locator(''.error-msg'')", "b": "page.locator(''[role=\"alert\"]'')", "c": "page.getByRole(''alert'')", "d": "page.getByText(''入力が正しくありません'')"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>getByRole(''alert'')はWAI-ARIAのrole属性の意味でアクセシビリティ的に要素を取得します。Playwrightが推奨する最も意味的なlocatorです。</p>
<p><strong>【Aが不正解の理由】</strong><br>.error-msgはCSSクラス名への依存です。デザインリファクタリングでクラス名が変わると壊れます。また複数のエラーメッセージ要素がある場合に絞り込めません。</p>
<p><strong>【Bが不正解の理由】</strong><br>[role="alert"]でも動作しますが、CSSセレクタによる属性値の直接指定です。getByRole()はARIAロールのセマンティクスに基づいた取得で、より意味的・推奨度が高いです。</p>
<p><strong>【Dが不正解の理由】</strong><br>getByText()はテキスト内容での取得です。エラーメッセージのテキストが変わるとテストが壊れます。role属性による取得の方が変更に強いです。</p>', 5),
  ('playwright-mock-written-d', 3, 'locator',
   '<p>以下のHTMLで、3つある「削除」ボタンのうち、親要素のidが item-2 のものを取得する正しいlocatorはどれですか？</p>
<pre><code>&lt;div id="item-1"&gt;&lt;button&gt;削除&lt;/button&gt;&lt;/div&gt;<br>&lt;div id="item-2"&gt;&lt;button&gt;削除&lt;/button&gt;&lt;/div&gt;<br>&lt;div id="item-3"&gt;&lt;button&gt;削除&lt;/button&gt;&lt;/div&gt;</code></pre>',
   '{"a": "page.locator(''#item-2 button'')", "b": "page.locator(''button'').nth(1)", "c": "page.getByRole(''button'', { name: ''削除'' }).nth(1)", "d": "page.locator(''button#item-2'')"}'::jsonb, '{a}', false,
   '<p><strong>【正解：A】</strong><br>#item-2 buttonは「id=item-2の要素の子孫にあるbutton」を取得するCSSセレクタです。親要素のidで文脈を特定してからボタンを取得する明確で安定したlocatorです。</p>
<p><strong>【Bが不正解の理由】</strong><br>button要素全体のnth(1)は「全buttonの中でDOM順2番目」を取得します。item-2のボタンがDOMで2番目に並んでいる保証はなく、item-1とitem-2の間に別のbuttonが追加されると壊れます。</p>
<p><strong>【Cが不正解の理由】</strong><br>getByRole()でname=''削除''の絞り込みをしてもnth(1)はDOM順に依存します。Bと同様に順序変更で壊れる可能性があります。</p>
<p><strong>【Dが不正解の理由】</strong><br>button#item-2は「id=item-2のbutton要素」を指します。このHTMLではidはbutton要素ではなくdiv要素についているため、何もマッチしません。</p>', 5),
  ('playwright-mock-written-d', 4, '変数',
   '<p>以下のコードで <code>exists</code> に格納される値はどれですか？</p>
<pre><code>// #banner はページに存在しない<br>const exists = await page.locator(''#banner'').isVisible();</code></pre>',
   '{"a": "true", "b": "Error（例外が発生する）", "c": "null", "d": "false"}'::jsonb, '{d}', false,
   '<p><strong>【正解：D】</strong><br>isVisible()は要素が存在しない場合でも例外を投げずfalseを返します。これはPlaywrightのisVisible()の特徴で、要素の存在チェックとして安全に使えます。</p>
<p><strong>【Aが不正解の理由】</strong><br>trueが返るのは要素が存在してビューポートに表示されている場合です。#bannerは存在しないためtrueにはなりません。</p>
<p><strong>【Bが不正解の理由】</strong><br>isVisible()は要素が存在しない場合でも例外を発生させません。要素の存在チェックを安全に行えるのがisVisible()の利点です。存在しない要素でエラーになるのはclick()などの操作メソッドです。</p>
<p><strong>【Cが不正解の理由】</strong><br>nullを返すケースはありません。isVisible()は常にtrue/falseのboolean値を返します。</p>', 5),
  ('playwright-mock-written-d', 5, '変数',
   '<p>以下のコードで <code>src</code> に格納される値はどれですか？</p>
<pre><code>// &lt;img id="logo" src="/images/logo.png" alt="ロゴ" /&gt;<br></code><br>const src = await page.locator(''#logo'').getAttribute(''src'');</pre>',
   '{"a": "null", "b": "/images/logo.png", "c": "ロゴ", "d": "img#logo"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>getAttribute(''src'')はsrc属性の値をそのまま文字列で返します。このimg要素のsrcは''/images/logo.png''なので、その値が返ります。</p>
<p><strong>【Aが不正解の理由】</strong><br>nullが返るのはsrc属性が存在しない場合です。img要素にsrc属性は存在するので文字列が返ります。</p>
<p><strong>【Cが不正解の理由】</strong><br>「ロゴ」はalt属性の値です。getAttribute(''src'')はsrc属性の値を返すのであり、alt属性は返しません。</p>
<p><strong>【Dが不正解の理由】</strong><br>img#logoはCSSセレクタの記述です。getAttribute()は指定した属性の値を返すのであり、要素のセレクタ文字列を返すことはありません。</p>', 5),
  ('playwright-mock-written-d', 6, '変数',
   '<p>以下のコードで <code>items</code> に格納される値はどれですか？</p>
<pre><code>// ページに &lt;li&gt; が0個の場合<br>const items = await page.locator(''li'').all();</code></pre>',
   '{"a": "null", "b": "undefined", "c": "[]（空の配列）", "d": "エラーが発生する"}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>all()はマッチする要素のLocator配列を返します。要素が0件の場合でも例外を投げず[]（空の配列）を返します。要素の存在有無を安全に確認できます。</p>
<p><strong>【Aが不正解の理由】</strong><br>nullは返りません。all()は要素が0件でも必ず配列を返します。</p>
<p><strong>【Bが不正解の理由】</strong><br>undefinedは返りません。all()は常に配列型の値を返します。</p>
<p><strong>【Dが不正解の理由】</strong><br>all()は要素が存在しない場合でもエラーを発生させません。空の配列を返して正常終了します。</p>', 5),
  ('playwright-mock-written-d', 7, 'Git',
   '<p>他のメンバーが作成したリモートブランチ feature/login をローカルにチェックアウトする正しい手順はどれですか？</p>',
   '{"a": "git fetch origin → git checkout feature/login", "b": "git pull origin feature/login → git checkout feature/login", "c": "git clone feature/login", "d": "git branch feature/login → git checkout feature/login"}'::jsonb, '{a}', false,
   '<p><strong>【正解：A】</strong><br>git fetch originでリモートの最新情報（ブランチ情報を含む）をローカルに取得してから、git checkout feature/loginでそのブランチを作成・切り替えます。fetchにより追跡情報が更新されるため、checkoutが正しく機能します。</p><p><strong>【Bが不正解の理由】</strong><br>git pull origin feature/loginはリモートの変更をフェッチ＆マージしますが、現在のブランチへのマージが発生するため意図と異なります。feature/loginブランチに切り替えるにはその後checkoutが必要で、手順が冗長になります。</p><p><strong>【Cが不正解の理由】</strong><br>git cloneはリポジトリ全体を新規にダウンロードするコマンドです。ブランチ名を引数に取ることはできません。</p><p><strong>【Dが不正解の理由】</strong><br>git branch feature/loginは空のローカルブランチを新規作成します。リモートのfeature/loginの内容は取得されないため、中身のない空ブランチになってしまいます。</p>', 5),
  ('playwright-mock-written-d', 8, 'Git',
   '<p>現在の変更を確認してから、変更をステージングして「fix: ボタン修正」というコミットメッセージでコミットする正しい手順はどれですか？</p>',
   '{"a": "git status → git commit -m \"fix: ボタン修正\" → git add .", "b": "git diff → git commit -am \"fix: ボタン修正\"", "c": "git status → git add . → git commit -m \"fix: ボタン修正\"", "d": "git status → git stash → git commit -m \"fix: ボタン修正\""}'::jsonb, '{c}', false,
   '<p><strong>【正解：C】</strong><br>git statusで変更ファイルを確認し、git add .で全変更をステージングしてから、git commit -m "fix: ボタン修正"でコミットするのが標準的な手順です。</p><p><strong>【Aが不正解の理由】</strong><br>commit -mをadd .より前に実行しています。ステージングされる前にコミットしようとするため、変更がコミットに含まれません。add → commitの順序が正しいです。</p><p><strong>【Bが不正解の理由】</strong><br>git diff は変更内容の差分を表示しますが、変更概要の確認にはgit statusの方が一般的です。また-aオプションは既追跡ファイルのみ自動ステージングするため、新規ファイルはステージングされません。</p><p><strong>【Dが不正解の理由】</strong><br>git stashは変更を退避する操作です。stash後にcommitしても変更内容はstashに退避されており、コミットには含まれません。目的と正反対の操作になります。</p>', 5),
  ('playwright-mock-written-d', 9, 'Git',
   '<p>リモートに存在しなくなったブランチの追跡情報をローカルから削除する正しいコマンドはどれですか？</p>',
   '{"a": "git branch -d origin/<ブランチ名>", "b": "git remote prune origin", "c": "git fetch --delete origin", "d": "git pull --prune"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>git remote prune originはリモート（origin）に存在しなくなったブランチのローカル追跡情報（origin/xxx）をまとめて削除します。チームでブランチのマージ・削除が頻繁に行われる場合に定期的に実行することで、ローカルのブランチリストをクリーンに保てます。</p><p><strong>【Aが不正解の理由】</strong><br>git branch -dはローカルブランチを削除するコマンドです。origin/xxx形式のリモート追跡ブランチには使用できず、エラーになります。</p><p><strong>【Cが不正解の理由】</strong><br>git fetch --deleteというオプションは存在しません。正しくはgit fetch --prune（またはgit fetch -p）でfetch時に削除済みリモートブランチの追跡情報を同時に削除できます。</p><p><strong>【Dが不正解の理由】</strong><br>git pull --pruneは追跡情報の削除をしながらpullする方法です。ただし現在のブランチへのmergeも伴うため、追跡情報の削除のみを目的とする場合にはgit remote prune originが適切です。</p>', 5),
  ('playwright-mock-written-d', 10, 'コード読解',
   '<p>以下のコードを読んで、(1)何をしているか説明し、(2)問題点があれば指摘してください。</p>
<pre><code>test(''ページネーションテスト'', async ({ page }) =&gt; {</code><br>await page.goto(''https://example.com/list'');<br>const nextBtn = page.locator(''.pagination-next'');<br>await nextBtn.click();<br>await nextBtn.click();<br>const currentPage = await page.locator(''.page-indicator'').textContent();<br>expect(currentPage).toBe(''3'');<br>});</pre>',
   '{"a": "リスト画面で「次へ」ボタンを2回クリックして3ページ目にいることを確認する。問題点は、各クリック後にページ遷移・DOM更新が完了するまで待機する処理がないため、次のクリックが反映前に走り、ページ番号のアサーションが不安定になる可能性がある。", "b": "リスト画面で「次へ」ボタンを2回クリックして3ページ目にいることを確認する。問題点はなし。", "c": ".pagination-nextというlocatorは一般的に存在しないため、テストは常に失敗する。", "d": "textContent()は数値を返さないため、toBe(''3'')ではなくtoBe(3)と書かないとテストが失敗する。"}'::jsonb, '{a}', false,
   '<p><strong>【正解：A】</strong><br>コードの説明は正しいですが、1回目のclick()後にページ遷移やDOM更新（ページ番号の変化）が完了するのを待たずに2回目のclick()が実行されます。ページング処理が非同期の場合、1ページ目の状態のまま2回目のクリックが行われ、2ページ目で止まってしまう可能性があります。各クリック後にpage-indicatorの更新を待つawait expect(page.locator(''.page-indicator'')).toHaveText(''2'')などを挟むことで安定します。</p>
<p><strong>【Bが不正解の理由】</strong><br>「問題なし」は誤りです。非同期のDOM更新待機が不足しており、環境によっては2ページ目で止まるフレイキーなテストになります。</p>
<p><strong>【Cが不正解の理由】</strong><br>.pagination-nextは任意のCSSクラス名であり、テスト対象のHTMLに存在すれば問題なく動作します。Playwright自体はCSSクラス名を制限しません。</p>
<p><strong>【Dが不正解の理由】</strong><br>textContent()はstring型を返します。toBe(''3'')は文字列''3''との比較なので型は一致しており、3ページ目にいれば正しくパスします。数値3との比較にすると逆に型不一致で失敗します。</p>', 10),
  ('playwright-mock-written-d', 11, 'AAA',
   '<p>以下のコードのAAA分類として正しいものはどれですか？</p>
<pre><code>test(''コメント削除'', async ({ page }) =&gt; {<br>  await page.goto(''https://example.com/post/1'');            // (X)<br>  await page.locator(''.comment-delete'').first().click();    // (Y)<br>  await page.getByRole(''button'', { name: ''確認'' }).click(); // (Y)<br>  await expect(page.locator(''.comment'')).toHaveCount(0);    // (Z)<br>});</code></pre>',
   '{"a": "X=Arrange、Y=Act、Z=Assert", "b": "X=Assert、Y=Arrange、Z=Act", "c": "X=Act、Y=Assert、Z=Arrange", "d": "X=Arrange、Y=Assert、Z=Act"}'::jsonb, '{a}', false,
   '<p><strong>【正解：A】</strong><br>AAAの正しい分類は以下の通りです。<br>・Arrange（準備）: page.goto()で投稿ページを開き、削除操作の前提を整えます。<br>・Act（実行）: comment-deleteボタンをクリックし、確認ダイアログで「確認」をクリックして削除を実行します。<br>・Assert（確認）: expect().toHaveCount(0)でコメントが0件になったことを検証します。</p>
<p><strong>【Bが不正解の理由】</strong><br>goto()はAssertではなくArrangeです。AAAの論理的な順序が逆転しています。</p>
<p><strong>【Cが不正解の理由】</strong><br>goto()はActではなくArrangeです。click()はAssertではなくActです。分類が全体的にずれています。</p>
<p><strong>【Dが不正解の理由】</strong><br>click()の操作はAssertではなくActです。expect()を含む(Z)がAssertです。</p>', 10),
  ('playwright-mock-written-d', 12, 'AAA',
   '<p>「レポートページを開き、CSVダウンロードボタンをクリックする。ファイルがダウンロードされることを確認する」というシナリオをAAAで整理したとき、各フェーズの対応として正しいものはどれですか？</p>',
   '{"a": "Arrange=レポートページを開く　Act=CSVダウンロードボタンをクリックする　Assert=ファイルがダウンロードされることを確認する", "b": "Arrange=CSVダウンロードボタンをクリックする　Act=ファイルがダウンロードされることを確認する　Assert=レポートページを開く", "c": "Arrange=ファイルがダウンロードされることを確認する　Act=レポートページを開く　Assert=CSVダウンロードボタンをクリックする", "d": "Arrange=レポートページを開く　Act=ファイルがダウンロードされることを確認する　Assert=CSVダウンロードボタンをクリックする"}'::jsonb, '{a}', false,
   '<p><strong>【正解：A】</strong><br>AAAの正しい対応は以下の通りです。<br>・Arrange（準備）: レポートページを開く → ダウンロード操作の前提ページを準備。<br>・Act（実行）: CSVダウンロードボタンをクリックする → テスト対象の機能を実行。<br>・Assert（確認）: ファイルがダウンロードされることを確認する → 期待結果を検証。</p><p><strong>【Bが不正解の理由】</strong><br>ボタンのクリックはActであってArrangeではありません。AAAの順序がすべてずれています。</p><p><strong>【Cが不正解の理由】</strong><br>「確認する」はAssertであってArrangeではありません。AAAが逆順になっています。</p><p><strong>【Dが不正解の理由】</strong><br>「確認する」はAssertであってActではありません。ボタンのクリックがActです。ActとAssertが入れ替わっています。</p>', 10),
  ('playwright-mock-written-d', 13, 'コード並び替え',
   '<p>以下を「メールアドレスを変更して確認メッセージが表示されることを確認する」テストとして正しい順に並び替えてください。</p>
<pre><code>① await expect(page.locator(''.info-msg'')).toHaveText(''メールアドレスを更新しました'');<br>② await page.locator(''#email'').fill(''new@example.com'');<br>③ await page.getByRole(''button'', { name: ''保存'' }).click();<br>④ await page.goto(''https://example.com/account'');<br>⑤ await page.locator(''#email'').clear();</code></pre>',
   '{"a": "④ → ⑤ → ② → ③ → ①", "b": "④ → ② → ⑤ → ③ → ①", "c": "⑤ → ④ → ② → ③ → ①", "d": "④ → ③ → ⑤ → ② → ①"}'::jsonb, '{a}', false,
   '<p><strong>【正解：A】</strong><br>正しい操作順序は以下の通りです。<br>④ アカウントページへ移動（Arrange）<br>⑤ 既存のメールアドレスをクリア（現在の値を消去）<br>② 新しいメールアドレスを入力（Act）<br>③ 保存ボタンをクリック（Act）<br>① 更新成功メッセージを検証（Assert）<br>clear()で既存値を消してからfill()で新しい値を入力するのが正しい操作順です。</p>
<p><strong>【Bが不正解の理由】</strong><br>④ → ② の順ではclear()前にfill()を実行しています。既存のメールアドレスが残ったままfill()すると既存値に追記される場合があり、意図しないメールアドレスが入力される可能性があります。</p>
<p><strong>【Cが不正解の理由】</strong><br>⑤ページへの移動（④）より前にclear()を実行しています。ページを開く前に#email要素は存在しないためエラーになります。</p>
<p><strong>【Dが不正解の理由】</strong><br>④ → ③ の順で、clear()とfill()より前に保存ボタンをクリックしています。入力前に保存するため何も変更されず、成功メッセージは表示されません。</p>', 15),
  ('playwright-mock-written-d', 14, 'POM',
   '<p>以下のPOMを使って、ページ遷移してフォーム送信する正しいコードはどれですか？</p>
<pre><code>// ContactPage.js<br>class ContactPage {<br>  constructor(page) {<br>    this.page = page;<br>    this.nameInput = page.locator(''#contact-name'');<br>    this.submitButton = page.getByRole(''button'', { name: ''送信する'' });<br>  }<br> <br>async navigate() {<br>    await this.page.goto(''https://example.com/contact'');<br>  }<br><br>async submitForm(name) {<br>    await this.nameInput.fill(name);<br>    await this.submitButton.click();<br>  }<br>}</code></pre>',
   '{"a": "test(''お問い合わせテスト'', async ({ page }) => {\n  const contactPage = new ContactPage(page);\n  contactPage.navigate();\n  await contactPage.submitForm(''田中花子'');\n});", "b": "test(''お問い合わせテスト'', async ({ page }) => {\n   const contactPage = new ContactPage(page);\n   await contactPage.navigate();\n   await contactPage.submitForm(''田中花子'');\n});", "c": "test(''お問い合わせテスト'', async ({ page }) => {\n   await contactPage = ContactPage(page);\n   await contactPage.navigate();\n   await contactPage.submitForm(''田中花子'');\n});", "d": "test(''お問い合わせテスト'', async ({ page }) => {\n   await ContactPage.navigate(page);\n   await ContactPage.submitForm(page, ''田中花子'');\n});"}'::jsonb, '{b}', false,
   '<p><strong>【正解：B】</strong><br>new ContactPage(page)でインスタンスを生成し、navigate()とsubmitForm()はどちらもasyncメソッドなのでawaitを付けて順番に呼び出します。navigate()のawaitを忘れるとページ遷移が完了する前にfill()が実行されエラーになるため、両方のawaitが重要です。</p>
<p><strong>【Aが不正解の理由】</strong><br>navigate()にawaitがありません。navigate()はasyncメソッドでpage.goto()を内部で呼ぶため、awaitなしだとページ遷移完了前にsubmitForm()が実行されます。#contact-nameへのfill()がページ遷移前に走りエラーになります。</p>
<p><strong>【Cが不正解の理由】</strong><br>newキーワードなしでContactPage(page)を呼んでいます。クラスはnewなしでは呼び出せずTypeErrorになります。</p>
<p><strong>【Dが不正解の理由】</strong><br>ContactPage.navigate(page)とContactPage.submitForm(page, ...)はstaticメソッドの呼び出し形式です。どちらもインスタンスメソッドなので、newでインスタンスを生成してから呼ぶ必要があります。</p>', 10);
