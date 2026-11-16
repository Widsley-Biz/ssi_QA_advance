import { Router } from 'express';
import { pool } from '../db.js';
import type { Profile } from '../auth.js';

export const profilesRouter = Router();

/**
 * 一覧表示用の追加所属チームID配列。profiles.team_id（主チーム。
 * リーダー閲覧範囲・招待のスコープに使う既存の単一値）はそのまま変えず、
 * profile_teamsに持たせた追加の所属先と合わせた和集合をteam_idsとして返す。
 */
const TEAM_IDS_SUBQUERY = `
  COALESCE(
    (SELECT array_agg(DISTINCT t) FROM (
       SELECT team_id AS t FROM profile_teams WHERE profile_id = profiles.id
       UNION
       SELECT profiles.team_id AS t WHERE profiles.team_id IS NOT NULL
     ) u),
    ARRAY[]::bigint[]
  ) AS team_ids
`;

/**
 * 「profiles行が指定チームの一員か（主チーム or 追加所属）」のSQL述語。
 * $<paramIndex>にteam_idの値を束縛する。profilesを指すFROM句に対して
 * 相関させて使う（profiles.id/profiles.team_idを直接参照する）。
 */
function teamMemberPredicate(paramIndex: number): string {
  return `(
    profiles.team_id = $${paramIndex}
    OR EXISTS (SELECT 1 FROM profile_teams pt WHERE pt.profile_id = profiles.id AND pt.team_id = $${paramIndex})
  )`;
}

// board: all / leader: own team(主所属+追加所属の両方) / member: self + own team
profilesRouter.get('/profiles', async (req, res) => {
  const p = req.profile!;
  const teamId = req.query.team_id as string | undefined;

  let rows: Profile[];
  if (p.role === 'board') {
    rows = teamId
      ? (await pool.query<Profile>(`SELECT profiles.*, ${TEAM_IDS_SUBQUERY} FROM profiles WHERE role != 'retired' AND ${teamMemberPredicate(1)}`, [teamId])).rows
      : (await pool.query<Profile>(`SELECT profiles.*, ${TEAM_IDS_SUBQUERY} FROM profiles WHERE role != 'retired'`)).rows;
  } else if (p.role === 'leader') {
    // leaders see everyone belonging (primary or additional) to the leader's own team,
    // regardless of the requested team_id
    rows = (await pool.query<Profile>(
      `SELECT profiles.*, ${TEAM_IDS_SUBQUERY} FROM profiles WHERE role != 'retired' AND ${teamMemberPredicate(1)}`,
      [p.team_id],
    )).rows;
  } else {
    // member: self + same-team (primary or additional)
    rows = (await pool.query<Profile>(
      `SELECT profiles.*, ${TEAM_IDS_SUBQUERY} FROM profiles WHERE role != 'retired' AND (id = $1 OR ${teamMemberPredicate(2)})`,
      [p.id, p.team_id],
    )).rows;
  }
  res.json(rows);
});

profilesRouter.get('/profiles/:id', async (req, res) => {
  const p = req.profile!;
  const targetId = req.params.id;

  const { rows } = await pool.query<Profile>(
    `SELECT profiles.*, ${TEAM_IDS_SUBQUERY} FROM profiles WHERE id = $1`,
    [targetId],
  );
  const target = rows[0];
  if (!target) {
    res.status(404).json(null);
    return;
  }

  // team_idsはbigint[]なので文字列化して比較する（pgはbigintを文字列で返す）
  const targetTeamIds = (target.team_ids ?? []).map(String);
  const viewerTeamId = p.team_id != null ? String(p.team_id) : null;
  const canView =
    p.role === 'board' ||
    (p.role === 'leader' && viewerTeamId !== null && targetTeamIds.includes(viewerTeamId)) ||
    (p.role === 'member' && (target.id === p.id || (viewerTeamId !== null && targetTeamIds.includes(viewerTeamId))));

  if (!canView) {
    res.status(404).json(null); // mirrors RLS: unauthorized rows are simply invisible
    return;
  }
  res.json(target);
});

profilesRouter.patch('/profiles/:id', async (req, res) => {
  const p = req.profile!;
  const targetId = req.params.id;
  const canEdit = p.role === 'board' || targetId === p.id;
  if (!canEdit) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const updates = req.body as Partial<Profile>;
  const allowed = p.role === 'board'
    ? ['display_name', 'email', 'role', 'team_id', 'slack_id']
    : ['display_name', 'slack_id']; // non-board users cannot change their own role/team

  const fields = Object.keys(updates).filter(k => allowed.includes(k));
  if (fields.length === 0) {
    res.status(204).end();
    return;
  }
  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => (updates as Record<string, unknown>)[f]);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 主チームを変える場合、古い主チームへのprofile_teams上の残留（初回投入時の
    // バックフィル分）を消しておく。消さないと、ユーザー管理でAからBへ主チームを
    // 変えても、Aのチーム管理カードに「追加所属」として残り続けてしまう
    let previousTeamId: string | null = null;
    if (fields.includes('team_id')) {
      previousTeamId = (await client.query<{ team_id: string | null }>(
        'SELECT team_id FROM profiles WHERE id = $1',
        [targetId],
      )).rows[0]?.team_id ?? null;
    }

    await client.query(`UPDATE profiles SET ${setClause} WHERE id = $1`, [targetId, ...values]);

    if (fields.includes('team_id') && previousTeamId !== null) {
      const newTeamId = (updates as Record<string, unknown>).team_id;
      if (String(previousTeamId) !== String(newTeamId)) {
        await client.query(
          'DELETE FROM profile_teams WHERE profile_id = $1 AND team_id = $2',
          [targetId, previousTeamId],
        );
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  res.status(204).end();
});

/**
 * 追加チーム所属（profile_teams）の1件追加。主チーム(profiles.team_id)は
 * 変えない。主チームの変更は従来通りPATCH /profiles/:id。
 */
profilesRouter.post('/profiles/:id/teams', async (req, res) => {
  const p = req.profile!;
  if (p.role !== 'board') return res.status(403).json({ error: 'forbidden' });

  const teamId = Number(req.body?.team_id);
  if (!Number.isInteger(teamId)) return res.status(400).json({ error: 'bad team_id' });

  const exists = await pool.query('SELECT 1 FROM profiles WHERE id = $1', [req.params.id]);
  if (!exists.rowCount) return res.status(404).json({ error: 'profile not found' });

  await pool.query(
    'INSERT INTO profile_teams (profile_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.params.id, teamId],
  );
  res.status(204).end();
});

/** 追加チーム所属の1件削除。主チームと同じteam_idは削除不可（ユーザー管理から変更させる） */
profilesRouter.delete('/profiles/:id/teams/:teamId', async (req, res) => {
  const p = req.profile!;
  if (p.role !== 'board') return res.status(403).json({ error: 'forbidden' });

  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId)) return res.status(400).json({ error: 'bad team_id' });

  const prof = (await pool.query<{ team_id: number | null }>(
    'SELECT team_id FROM profiles WHERE id = $1',
    [req.params.id],
  )).rows[0];
  if (!prof) return res.status(404).json({ error: 'profile not found' });
  if (prof.team_id !== null && String(prof.team_id) === String(teamId)) {
    return res.status(409).json({ error: '主チームは「ユーザー管理」タブから変更してください' });
  }

  await pool.query('DELETE FROM profile_teams WHERE profile_id = $1 AND team_id = $2', [req.params.id, teamId]);
  res.status(204).end();
});
