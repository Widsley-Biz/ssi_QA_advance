-- ============================================================
-- material_progress_log.sql  –  教材(スライド)の「新しく読んだページ」ログ
-- ============================================================
-- 2026-11-19 追加。既存テーブル(material_progress)は変更しない（追加のみ）。
--
-- material_progress.viewed_pages は現在値しか持たず、いつ読んだかが
-- 失われる（上書きのたびに updated_at が今に変わるだけ）。
-- ダッシュボードの「デイリー学習進捗」「個人別の週間/月間/3ヶ月推移」を
-- 出すには、ページを新しく読んだ日時そのものを残す必要がある。
--
-- 既にviewed_pagesに入っているページを再度開いても行を増やさない
-- （サーバー側で「新規ページのときだけ」INSERTする想定。過去に遡っての
-- 一括投入はしない＝このテーブルを作った日からのログのみになる）。
-- ============================================================

CREATE TABLE IF NOT EXISTS material_progress_log (
  id          bigserial PRIMARY KEY,
  user_id     text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_id     text NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  material_id text NOT NULL,
  page        int NOT NULL,
  viewed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_progress_log_user_viewed
  ON material_progress_log(user_id, viewed_at);

-- PUTはデバウンスしないため、同じ新規ページに対して短時間に2回INSERTが
-- 飛んでくる可能性がある。二重計上を防ぐため一意制約+ON CONFLICT DO NOTHING
CREATE UNIQUE INDEX IF NOT EXISTS uq_material_progress_log_page
  ON material_progress_log(user_id, exam_id, material_id, page);

-- 追記専用ログ。UPDATE/DELETEは与えない
GRANT SELECT, INSERT ON material_progress_log TO app_user;
-- bigserialのシーケンスはテーブルと別オブジェクトなので忘れず付与する
-- （本番APIはapp_userで接続しており、ここが無いとINSERTが
-- 「permission denied for sequence」で失敗する）
GRANT USAGE, SELECT ON SEQUENCE material_progress_log_id_seq TO app_user;

-- 確認用: app_userがテーブル・シーケンスの両方に書き込めるか
SELECT
  has_table_privilege('app_user', 'material_progress_log', 'INSERT') AS can_insert_table,
  has_sequence_privilege('app_user', 'material_progress_log_id_seq', 'USAGE') AS can_use_sequence;
