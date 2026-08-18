# supabase/

SkillCheck の DB スキーマ。マイグレーションは連番SQLで管理し、**Supabase の SQL Editor に貼って手動実行**する
（Supabase CLI プロジェクトにはしていない）。

## これまでの経緯

`001`〜`009` は元々このリポジトリの外（`~/Desktop/qa_advance/supabase/`）に置かれており、
**Ryuji のローカルにしか存在しない状態**だった。マシンが壊れるとスキーマ定義が失われるため、
`010` を追加するタイミングでリポジトリ配下に移した（2026-08-18）。

以後、スキーマを変更するときは**このディレクトリのファイルを編集してコミットする**。

## ファイル

| ファイル | 内容 |
|---|---|
| `migrations/001_tables.sql` | courses / levels / skills / teams / profiles / assessments / answers |
| `migrations/002_rls.sql` | RLS ポリシーと `current_user_role()` / `current_user_team_id()` |
| `migrations/003_views.sql` | 達成率・レベルゲート・チームサマリのビュー |
| `migrations/004_functions.sql` | `handle_new_user()` など |
| `migrations/005_invitations.sql` | 招待 |
| `migrations/006_certifications.sql` | 資格マスタ・ユーザー資格 |
| `migrations/007〜009` | 資格追加・職種別コース追加（CSVから生成） |
| `migrations/010_exams.sql` | **模擬試験（筆記）**。exams / exam_questions / exam_attempts / exam_attempt_answers + RPC 3本 |
| `seed/` | 初期データ |
| `tests/` | ローカル PostgreSQL での検証用（下記） |

## 適用手順

1. Supabase ダッシュボード → SQL Editor
2. 未適用のマイグレーションを**連番順に**貼り付けて Run
3. `010_exams.sql` は既存テーブルを変更しないため、既存機能への影響なしで追加できる

## 010_exams.sql の設計要点

SkillCheck はサーバーサイドを持たない静的SPA（nginx + Supabase anon key）なので、
普通に作ると**受験者が回答前に正解を見られてしまう**。これを防ぐために:

- `exam_questions` の RLS は **board のみ SELECT 可**。受験者には1行も見せない
- 出題・採点は `SECURITY DEFINER` の RPC 3本経由に限定する
  - `start_exam(exam_id)` … attempt を作り、**正解と解説を除いた**設問を返す
  - `submit_exam(attempt_id, answers)` … **サーバー側で採点**し、結果（正解・解説つき）を返す
  - `get_attempt_result(attempt_id)` … 提出済み attempt の結果を再表示する
- `exam_attempts` / `exam_attempt_answers` への INSERT/UPDATE は board のみ。
  通常の書き込みは RPC だけが行う（**クライアントから点数を偽装できないようにする**）

配点（`exam_questions.points`）・合格ライン（`exams.pass_score`）・時間制限（`exams.time_limit_min`）・
出題順シャッフル（`exams.shuffle_questions`）はすべてデータ側に持たせているので、
後から SQL 1行で調整できる。

## ローカル検証

`tests/` は本番Supabaseに触らずにローカルのPostgreSQLで検証するためのもの。
`00_stub.sql` が `auth.uid()` や `profiles` など依存部分だけを再現する。

```sh
brew install postgresql@17
supabase/tests/run.sh
```

検証している内容（全23項目）:

- `correct_key` / `explanation` が `start_exam` の戻り値に含まれないこと
- 受験者から `exam_questions` が0行に見えること
- 受験記録を直接 INSERT できないこと（点数偽装の防止）
- 傾斜配点の採点と合格ライン境界（20点/30点・合格ライン20 → 合格）
- 未回答は NULL・0点、二重提出の拒否、非公開試験の拒否
- 未ログイン・retired・他人の attempt へのアクセス拒否
- リーダーは自チーム可・別チームは0件、board は全件
- シャッフルON/OFFの挙動、配点と合格ラインを後から変更できること
