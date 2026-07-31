import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../auth.js';

export const invitationsRouter = Router();

invitationsRouter.get('/invitations', requireRole('board'), async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM invitations ORDER BY created_at DESC');
  res.json(rows);
});

invitationsRouter.post('/invitations', requireRole('board'), async (req, res) => {
  const p = req.profile!;
  const { email, role, team_id } = req.body as { email: string; role: string; team_id: number | null };
  const { rows } = await pool.query(
    `INSERT INTO invitations (email, role, team_id, invited_by, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
    [email.toLowerCase().trim(), role, team_id, p.id],
  );
  res.status(201).json(rows[0]);
});

invitationsRouter.delete('/invitations/:id', requireRole('board'), async (req, res) => {
  await pool.query('DELETE FROM invitations WHERE id = $1', [req.params.id]);
  res.status(204).end();
});
