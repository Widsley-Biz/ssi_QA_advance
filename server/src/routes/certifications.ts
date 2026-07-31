import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../auth.js';

export const certificationsRouter = Router();

certificationsRouter.get('/certifications', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM certifications ORDER BY sort_order');
  res.json(rows);
});

certificationsRouter.post('/certifications', requireRole('board'), async (req, res) => {
  const { name, description, level, category, reward, sort_order } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO certifications (name, description, level, category, reward, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, description ?? '', level, category, reward ?? null, sort_order ?? 0],
  );
  res.status(201).json(rows[0]);
});

certificationsRouter.patch('/certifications/:id', requireRole('board'), async (req, res) => {
  const allowed = ['name', 'description', 'level', 'category', 'reward', 'sort_order'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (fields.length === 0) {
    res.status(204).end();
    return;
  }
  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => req.body[f]);
  await pool.query(`UPDATE certifications SET ${setClause} WHERE id = $1`, [req.params.id, ...values]);
  res.status(204).end();
});

certificationsRouter.delete('/certifications/:id', requireRole('board'), async (req, res) => {
  await pool.query('DELETE FROM certifications WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

// ── user_certifications ──
// board: all / leader: own team / member: own only
certificationsRouter.get('/user_certifications', async (req, res) => {
  const p = req.profile!;
  const userId = req.query.user_id as string | undefined;

  const clauses: string[] = [];
  const values: unknown[] = [];

  if (p.role === 'board') {
    // no scoping
  } else if (p.role === 'leader') {
    clauses.push(`user_id IN (SELECT id FROM profiles WHERE team_id = $${values.length + 1})`);
    values.push(p.team_id);
  } else {
    clauses.push(`user_id = $${values.length + 1}`);
    values.push(p.id);
  }

  if (userId) {
    clauses.push(`user_id = $${values.length + 1}`);
    values.push(userId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM user_certifications ${where} ORDER BY updated_at DESC`,
    values,
  );
  res.json(rows);
});

certificationsRouter.put('/user_certifications', async (req, res) => {
  const p = req.profile!;
  const { certification_id, status } = req.body as { certification_id: number; status: string };
  await pool.query(
    `INSERT INTO user_certifications (user_id, certification_id, status, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, certification_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
    [p.id, certification_id, status],
  );
  res.status(204).end();
});

certificationsRouter.delete('/user_certifications/:certificationId', async (req, res) => {
  const p = req.profile!;
  await pool.query(
    'DELETE FROM user_certifications WHERE user_id = $1 AND certification_id = $2',
    [p.id, req.params.certificationId],
  );
  res.status(204).end();
});
