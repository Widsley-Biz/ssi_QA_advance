
## 2026-08-19(追記3) | 教育/SkillCheck
- 内容: 模擬試験の受験画面を実装。バックエンドと合わせて機能一式が完成
  - `src/lib/exams.ts`(APIクライアント)、`ExamList.tsx`(一覧)、`ExamFlow.tsx`(出題)、`ExamResult.tsx`(結果)を新規作成。`App.tsx`にルート3本、`Header.tsx`に「模擬試験」を追加
  - 出題画面は**正解を一切保持しない**(APIが返さないため型にも存在しない)。提出後に結果画面で正解・自分の回答・解説を表示する
  - 複数選択の設問はチェックボックス動作、単一選択は次問へ自動スクロール。未回答の警告・提出前確認・二重送信防止つき
  - 一覧に受験回数と最高得点、下部に受験履歴を表示
  - **検証**: `tsc --noEmit` 通過(フロント・サーバー両方)、`npm run build` 成功
  - Routineの貼り替えは403のまま。GitHub Appの設定画面に「Claude is requesting an update to its permissions」が表示され続けており、**権限更新の承認が未完了**と思われる
- 結果: 模擬試験は実装完了。残るは本番DBへのスキーマ適用とデプロイ
- ハンドオフ: 次の担当 Ryuji / 渡すもの ブランチ feat/mock-exams-gcp / 完了条件 exams.sqlの本番適用とマージ・デプロイ
- PMへ: GitHub Appの権限承認をお願いしたい(Routine4本が止まったまま)
