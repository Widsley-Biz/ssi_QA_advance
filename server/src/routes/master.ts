import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../auth.js';

export const masterRouter = Router();

// ── courses ──
masterRouter.get('/courses', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM courses ORDER BY sort_order');
  res.json(rows);
});

// ── levels ──
masterRouter.get('/levels', async (req, res) => {
  const courseId = req.query.course_id as string | undefined;
  const { rows } = courseId
    ? await pool.query('SELECT * FROM levels WHERE course_id = $1 ORDER BY sort_order', [courseId])
    : await pool.query('SELECT * FROM levels ORDER BY sort_order');
  res.json(rows);
});

// ── skills ──
masterRouter.get('/skills', async (req, res) => {
  const courseId = req.query.course_id as string | undefined;
  const { rows } = courseId
    ? await pool.query('SELECT * FROM skills WHERE course_id = $1 ORDER BY no', [courseId])
    : await pool.query('SELECT * FROM skills ORDER BY no');
  res.json(rows);
});

// ── teams ──
masterRouter.get('/teams', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM teams ORDER BY name');
  res.json(rows);
});

masterRouter.post('/teams', requireRole('board'), async (req, res) => {
  const { name } = req.body as { name: string };
  const { rows } = await pool.query('INSERT INTO teams (name) VALUES ($1) RETURNING *', [name]);
  res.status(201).json(rows[0]);
});

masterRouter.patch('/teams/:id', requireRole('board'), async (req, res) => {
  const { name } = req.body as { name: string };
  await pool.query('UPDATE teams SET name = $1 WHERE id = $2', [name, req.params.id]);
  res.status(204).end();
});

masterRouter.delete('/teams/:id', requireRole('board'), async (req, res) => {
  await pool.query('DELETE FROM teams WHERE id = $1', [req.params.id]);
  res.status(204).end();
});
