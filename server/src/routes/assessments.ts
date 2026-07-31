import { Router } from 'express';
import { pool } from '../db.js';

export const assessmentsRouter = Router();

// board: all / leader: own team / member: own only
assessmentsRouter.get('/assessments', async (req, res) => {
  const p = req.profile!;
  const userId = req.query.user_id as string | undefined;
  const courseId = req.query.course_id as string | undefined;

  const clauses: string[] = [];
  const values: unknown[] = [];

  if (p.role === 'board') {
    // no additional scoping
  } else if (p.role === 'leader') {
    clauses.push(
      `user_id IN (SELECT id FROM profiles WHERE team_id = $${values.length + 1})`,
    );
    values.push(p.team_id);
  } else {
    clauses.push(`user_id = $${values.length + 1}`);
    values.push(p.id);
  }

  if (userId) {
    clauses.push(`user_id = $${values.length + 1}`);
    values.push(userId);
  }
  if (courseId) {
    clauses.push(`course_id = $${values.length + 1}`);
    values.push(courseId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM assessments ${where} ORDER BY submitted_at DESC`,
    values,
  );
  res.json(rows);
});

assessmentsRouter.get('/answers', async (req, res) => {
  const p = req.profile!;
  const assessmentId = req.query.assessment_id as string;

  let scopeClause = '';
  const values: unknown[] = [assessmentId];
  if (p.role === 'leader') {
    scopeClause = `AND a.id IN (
      SELECT ass.id FROM assessments ass JOIN profiles pr ON pr.id = ass.user_id WHERE pr.team_id = $2
    )`;
    values.push(p.team_id);
  } else if (p.role === 'member') {
    scopeClause = `AND a.user_id = $2`;
    values.push(p.id);
  }

  const { rows } = await pool.query(
    `SELECT ans.* FROM answers ans JOIN assessments a ON a.id = ans.assessment_id
     WHERE a.id = $1 ${scopeClause}`,
    values,
  );
  res.json(rows);
});

assessmentsRouter.post('/assessments', async (req, res) => {
  const p = req.profile!;
  const { course_id, answers, score_snapshot } = req.body as {
    course_id: string;
    answers: Record<number, number>;
    score_snapshot: Record<string, unknown>;
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO assessments (user_id, course_id, status, submitted_at, score_snapshot)
       VALUES ($1, $2, 'submitted', now(), $3) RETURNING id`,
      [p.id, course_id, score_snapshot],
    );
    const assessmentId = rows[0].id as number;

    const entries = Object.entries(answers);
    if (entries.length > 0) {
      const values: unknown[] = [];
      const placeholders = entries.map(([skillId, score], i) => {
        values.push(assessmentId, Number(skillId), score);
        return `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`;
      });
      await client.query(
        `INSERT INTO answers (assessment_id, skill_id, score) VALUES ${placeholders.join(', ')}`,
        values,
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ assessmentId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

assessmentsRouter.delete('/assessments/:id', async (req, res) => {
  const p = req.profile!;
  const id = req.params.id;

  if (p.role === 'board') {
    await pool.query('DELETE FROM assessments WHERE id = $1', [id]);
  } else if (p.role === 'leader') {
    await pool.query(
      `DELETE FROM assessments WHERE id = $1 AND user_id IN (
        SELECT pr.id FROM profiles pr WHERE pr.team_id = $2
      )`,
      [id, p.team_id],
    );
  } else {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  res.status(204).end();
});
