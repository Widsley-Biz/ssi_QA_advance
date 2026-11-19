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

-- 追記専用ログ。UPDATE/DELETEは与えない
GRANT SELECT, INSERT ON material_progress_log TO app_user;
