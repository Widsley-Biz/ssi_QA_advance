-- ============================================================
-- certifications_mf_expense_intake.sql
-- MF経費(資格受験料)の承認通知メール → SkillCheck所有資格の自動反映
-- ============================================================
-- 2026-11-26 追加。既存テーブルへの追加のみ（既存列・既存行は変更しない）。
--
-- user_certifications:
--   acquired_at        … 資格取得日(メール/申請から判明すればその日、無ければ反映処理日)
--   confirmed_by       … NULL = 従来どおり本人のセルフ申告(未確認)。
--                         'system:mf-expense' = このパイプラインが自動反映。
--                         それ以外の文字列 = 管理画面で手動確認したboardユーザーのid。
--                         confirmed_byが入っている行は、本人によるPUT/DELETEの対象外にする
--                         （server/src/routes/certifications.ts側でガードする）。
--   mf_application_url … 反映の根拠になったMF経費申請のURL（メール本文から抽出、自前では組み立てない）。
--
-- certifications:
--   aliases … メール本文の表記ゆれ対策(例: "JSTQB FL" ⇔ "JSTQB Foundation Level")。
--             資格マスタ管理画面(/admin/certs)から編集できるようにする(PR2)。
--
-- mf_expense_intake_log … Zapier経由で届いた生データと、解析・突合・反映結果の監査ログ。
--   action_taken: 'acquired_set' | 'needs_review' | 'ignored'
--     acquired_set  … 自動で user_certifications.status='acquired' にした
--     needs_review  … 資格受験料の申請らしいが氏名/資格名を確信を持って特定できなかった
--                      → Slack #dx推進室 (C09TP5Q0UH5) に通知する
--     ignored       … 資格受験料の申請ではない(無関係なメール) → 通知しない
--   現時点(実メール未入手)では解析ロジックが未校正のため、当面はすべて 'needs_review' として
--   扱う(= 安全側に倒す)。実メール入手後に判定ロジックを調律する。
-- ============================================================

ALTER TABLE user_certifications
  ADD COLUMN IF NOT EXISTS acquired_at date,
  ADD COLUMN IF NOT EXISTS confirmed_by text,
  ADD COLUMN IF NOT EXISTS mf_application_url text;

ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS mf_expense_intake_log (
  id                        bigserial PRIMARY KEY,
  received_at               timestamptz NOT NULL DEFAULT now(),
  source_message_id         text,
  raw_subject               text,
  raw_body                  text,
  parsed                    jsonb,
  matched_user_id           text REFERENCES profiles(id),
  matched_certification_id  bigint REFERENCES certifications(id),
  action_taken              text NOT NULL CHECK (action_taken IN ('acquired_set', 'needs_review', 'ignored')),
  mf_application_url        text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- Zapierからの再送(at-least-once)で同じメールを二重処理しないための一意制約。
-- source_message_idが取れないケースもあり得るため、NULLは複数行許容(部分一意インデックス)。
CREATE UNIQUE INDEX IF NOT EXISTS uq_mf_expense_intake_log_message
  ON mf_expense_intake_log(source_message_id)
  WHERE source_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mf_expense_intake_log_received
  ON mf_expense_intake_log(received_at DESC);

-- 取込みは追記専用。管理画面からの手動解決時にaction_takenを更新できるようUPDATEのみ追加で許可。
GRANT SELECT, INSERT, UPDATE ON mf_expense_intake_log TO app_user;
GRANT USAGE, SELECT ON SEQUENCE mf_expense_intake_log_id_seq TO app_user;

-- 確認用
SELECT
  has_table_privilege('app_user', 'mf_expense_intake_log', 'INSERT') AS can_insert_table,
  has_sequence_privilege('app_user', 'mf_expense_intake_log_id_seq', 'USAGE') AS can_use_sequence;
