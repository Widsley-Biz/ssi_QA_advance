-- ============================================================
-- profile_teams.sql  –  1人が複数チームに所属できるようにする
-- ============================================================
-- 2026-11-16 追加。既存のprofiles.team_id（主チーム・リーダー閲覧範囲や
-- 招待のスコープに使う）はそのまま残し、追加の所属先だけをこのテーブルで
-- 持つ。主チームの変更は今まで通りユーザー管理（profiles.team_id）、
-- 追加チームへの所属はチーム管理の「＋メンバーを追加」から行う。
--
-- 一覧表示用の team_ids は「profiles.team_id ∪ profile_teams」の和集合で
-- APIが返す（server/src/routes/profiles.ts）。
-- ============================================================

CREATE TABLE IF NOT EXISTS profile_teams (
  profile_id text   NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id    bigint NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_teams_team ON profile_teams(team_id);

-- 既存のprofiles.team_id（主チーム）を追加所属一覧にも反映しておく
INSERT INTO profile_teams (profile_id, team_id)
SELECT id, team_id FROM profiles WHERE team_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- app_userがDDL権限を持たずpostgresで上を実行した場合は忘れず実行すること
GRANT SELECT, INSERT, UPDATE, DELETE ON profile_teams TO app_user;
