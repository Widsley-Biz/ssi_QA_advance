import { Router } from 'express';
import { pool } from '../db.js';
import type { Profile } from '../auth.js';

export const profilesRouter = Router();

// board: all / leader: own team / member: self + own team
profilesRouter.get('/profiles', async (req, res) => {
  const p = req.profile!;
  const teamId = req.query.team_id as string | undefined;

  let rows: Profile[];
  if (p.role === 'board') {
    rows = teamId
      ? (await pool.query<Profile>("SELECT * FROM profiles WHERE role != 'retired' AND team_id = $1", [teamId])).rows
      : (await pool.query<Profile>("SELECT * FROM profiles WHERE role != 'retired'")).rows;
  } else if (p.role === 'leader') {
    // leaders only ever see their own team regardless of the requested team_id
    rows = (await pool.query<Profile>(
      "SELECT * FROM profiles WHERE role != 'retired' AND team_id = $1",
      [p.team_id],
    )).rows;
  } else {
    // member: self + same-team
    rows = (await pool.query<Profile>(
      "SELECT * FROM profiles WHERE role != 'retired' AND (id = $1 OR team_id = $2)",
      [p.id, p.team_id],
    )).rows;
  }
  res.json(rows);
});

profilesRouter.get('/profiles/:id', async (req, res) => {
  const p = req.profile!;
  const targetId = req.params.id;

  const { rows } = await pool.query<Profile>('SELECT * FROM profiles WHERE id = $1', [targetId]);
  const target = rows[0];
  if (!target) {
    res.status(404).json(null);
    return;
  }

  const canView =
    p.role === 'board' ||
    (p.role === 'leader' && target.team_id === p.team_id) ||
    (p.role === 'member' && (target.id === p.id || (target.team_id !== null && target.team_id === p.team_id)));

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
  await pool.query(`UPDATE profiles SET ${setClause} WHERE id = $1`, [targetId, ...values]);
  res.status(204).end();
});
