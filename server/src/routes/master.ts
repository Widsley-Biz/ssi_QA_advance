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

/**
 * チーム削除。フロント側の「在籍メンバー0人なら削除可」判定は
 * profiles.team_id（主チーム）しか見ていないため、退職者やprofile_teams
 * 経由の追加所属・招待中のteam_id参照が残っていると外部キー制約で
 * 必ず失敗していた（エラーがUIに出ず「削除できない」ように見える不具合）。
 * ここでサーバー側が最終判定を行い、在籍中(retired以外)のメンバーが
 * 1人でもいれば409で明示的に拒否し、残っているのが退職者・招待の参照
 * だけならクリアしてから削除する。
 */
masterRouter.delete('/teams/:id', requireRole('board'), async (req, res) => {
  const teamId = Number(req.params.id);
  if (!Number.isInteger(teamId)) return res.status(400).json({ error: 'bad id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM profiles
        WHERE role <> 'retired'
          AND (team_id = $1 OR id IN (SELECT profile_id FROM profile_teams WHERE team_id = $1))`,
      [teamId],
    );
    if (rows[0].n > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `在籍中のメンバーが${rows[0].n}人いるため削除できません` });
    }

    // 残っているのは退職者・招待中の参照のみ。クリアしてから削除する
    await client.query('UPDATE profiles SET team_id = NULL WHERE team_id = $1', [teamId]);
    await client.query('UPDATE invitations SET team_id = NULL WHERE team_id = $1', [teamId]);
    await client.query('DELETE FROM profile_teams WHERE team_id = $1', [teamId]);
    await client.query('DELETE FROM teams WHERE id = $1', [teamId]);

    await client.query('COMMIT');
    res.status(204).end();
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
