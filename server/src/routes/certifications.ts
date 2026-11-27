import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../auth.js';

export const certificationsRouter = Router();

/** リーダーの所属チーム（主チーム or 追加所属）に属するprofile.idの集合 */
function teamMemberIdsSubquery(paramIndex: number): string {
  return `(
    SELECT id FROM profiles WHERE team_id = $${paramIndex}
    UNION
    SELECT profile_id FROM profile_teams WHERE team_id = $${paramIndex}
  )`;
}

certificationsRouter.get('/certifications', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM certifications ORDER BY sort_order');
  res.json(rows);
});

certificationsRouter.post('/certifications', requireRole('board'), async (req, res) => {
  const { name, description, level, category, reward, sort_order, active } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO certifications (name, description, level, category, reward, sort_order, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, description ?? '', level, category, reward ?? null, sort_order ?? 0, active ?? true],
  );
  res.status(201).json(rows[0]);
});

certificationsRouter.patch('/certifications/:id', requireRole('board'), async (req, res) => {
  const allowed = ['name', 'description', 'level', 'category', 'reward', 'sort_order', 'active', 'aliases'];
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
    clauses.push(`user_id IN ${teamMemberIdsSubquery(values.length + 1)}`);
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

/** confirmed_byが付いている行(MF経費自動反映 or 管理者確定済み)は本人のセルフ申告操作の対象外にする。 */
async function isConfirmedByOthers(userId: string, certificationId: number | string): Promise<boolean> {
  const { rows } = await pool.query<{ confirmed_by: string | null }>(
    'SELECT confirmed_by FROM user_certifications WHERE user_id = $1 AND certification_id = $2',
    [userId, certificationId],
  );
  return rows[0]?.confirmed_by != null;
}

certificationsRouter.put('/user_certifications', async (req, res) => {
  const p = req.profile!;
  const { certification_id, status } = req.body as { certification_id: number; status: string };

  if (await isConfirmedByOthers(p.id, certification_id)) {
    res.status(403).json({ error: 'confirmed by MF expense or an admin; cannot self-edit' });
    return;
  }

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

  if (await isConfirmedByOthers(p.id, req.params.certificationId)) {
    res.status(403).json({ error: 'confirmed by MF expense or an admin; cannot self-edit' });
    return;
  }

  await pool.query(
    'DELETE FROM user_certifications WHERE user_id = $1 AND certification_id = $2',
    [p.id, req.params.certificationId],
  );
  res.status(204).end();
});

/**
 * board/system専用: 他メンバーの資格取得状況を確定させる。
 * MF経費連携の自動反映(confirmedBy='system:mf-expense')と、
 * 管理画面からの手動確定(confirmedBy=操作したboardユーザーのid)の両方から呼ぶ。
 */
export async function setCertificationAcquired(
  userId: string,
  certificationId: number,
  opts: { confirmedBy: string; acquiredAt?: string | null; mfApplicationUrl?: string | null },
): Promise<void> {
  await pool.query(
    `INSERT INTO user_certifications
       (user_id, certification_id, status, acquired_at, confirmed_by, mf_application_url, updated_at)
     VALUES ($1, $2, 'acquired', COALESCE($3::date, CURRENT_DATE), $4, $5, now())
     ON CONFLICT (user_id, certification_id) DO UPDATE SET
       status = 'acquired',
       acquired_at = COALESCE($3::date, CURRENT_DATE),
       confirmed_by = $4,
       mf_application_url = $5,
       updated_at = now()`,
    [userId, certificationId, opts.acquiredAt ?? null, opts.confirmedBy, opts.mfApplicationUrl ?? null],
  );
}

// board限定: MF経費連携で「要確認」になった申請を、管理者が手動で確定する
certificationsRouter.put('/admin/user_certifications', requireRole('board'), async (req, res) => {
  const p = req.profile!;
  const { user_id, certification_id, acquired_at, mf_application_url } = req.body as {
    user_id?: string;
    certification_id?: number;
    acquired_at?: string;
    mf_application_url?: string;
  };
  if (!user_id || !certification_id) {
    res.status(400).json({ error: 'user_id and certification_id are required' });
    return;
  }
  await setCertificationAcquired(user_id, certification_id, {
    confirmedBy: p.id,
    acquiredAt: acquired_at ?? null,
    mfApplicationUrl: mf_application_url ?? null,
  });
  res.status(204).end();
});

// board限定: MF経費連携ログの一覧(新しい順)
certificationsRouter.get('/mf-expense-intake-log', requireRole('board'), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, received_at, raw_subject, parsed, matched_user_id, matched_certification_id,
            action_taken, mf_application_url
     FROM mf_expense_intake_log
     ORDER BY received_at DESC
     LIMIT 200`,
  );
  res.json(rows);
});
