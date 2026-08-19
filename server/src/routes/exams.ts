import { Router } from 'express';
import { pool } from '../db.js';

export const examsRouter = Router();

/**
 * 模擬試験（筆記）。
 *
 * 設計の要:
 *   出題時のレスポンスに correct_keys と explanation を**絶対に含めない**。
 *   採点はこのサーバー側で行い、点数はクライアントから受け取らない。
 *   これにより「全問回答するまで正解が見えない」ことを担保する。
 *   SELECT句を書き換えるときは、この2カラムが漏れていないか必ず確認すること。
 */

type Sel = { clause: string; values: unknown[] };

/** 受験記録の可視範囲。board=全件 / leader=自チーム / member=自分のみ */
function scopeAttempts(role: string, id: string, teamId: number | null): Sel {
  if (role === 'board') return { clause: '1=1', values: [] };
  if (role === 'leader') {
    return {
      clause: 'a.user_id IN (SELECT id FROM profiles WHERE team_id = $1)',
      values: [teamId],
    };
  }
  return { clause: 'a.user_id = $1', values: [id] };
}

/** 試験一覧。自分の受験回数と最高得点を添える */
examsRouter.get('/exams', async (req, res) => {
  const p = req.profile!;
  if (p.role === 'retired') return res.status(403).json({ error: 'not permitted' });

  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.description, e.group_name, e.pass_score, e.time_limit_min,
            e.sort_order, e.is_published,
            (SELECT count(*) FROM exam_questions q WHERE q.exam_id = e.id)::int      AS question_count,
            (SELECT COALESCE(sum(q.points), 0) FROM exam_questions q WHERE q.exam_id = e.id)::int AS total_points,
            (SELECT count(*) FROM exam_attempts a
              WHERE a.exam_id = e.id AND a.user_id = $1 AND a.status = 'submitted')::int AS my_attempts,
            (SELECT max(a.earned_points) FROM exam_attempts a
              WHERE a.exam_id = e.id AND a.user_id = $1 AND a.status = 'submitted')::int AS my_best_score
       FROM exams e
      WHERE e.is_published OR $2 = 'board'
      ORDER BY e.group_name, e.sort_order, e.id`,
    [p.id, p.role],
  );
  res.json(rows);
});

/** 自分（または権限内）の受験履歴。マイページと管理画面が使う */
examsRouter.get('/exams/attempts', async (req, res) => {
  const p = req.profile!;
  if (p.role === 'retired') return res.status(403).json({ error: 'not permitted' });

  const scope = scopeAttempts(p.role, p.id, p.team_id);
  const userId = req.query.user_id as string | undefined;
  const values = [...scope.values];
  let extra = '';
  if (userId) {
    values.push(userId);
    extra = ` AND a.user_id = $${values.length}`;
  }

  const { rows } = await pool.query(
    `SELECT a.id, a.exam_id, e.name AS exam_name, a.user_id, pr.display_name,
            a.status, a.started_at, a.submitted_at,
            a.earned_points, a.total_points, a.passed
       FROM exam_attempts a
       JOIN exams e ON e.id = a.exam_id
       JOIN profiles pr ON pr.id = a.user_id
      WHERE ${scope.clause}${extra} AND a.status = 'submitted'
      ORDER BY a.submitted_at DESC
      LIMIT 200`,
    values,
  );
  res.json(rows);
});

/** 受験開始。未提出の attempt があれば再利用する（リロードで記録が量産されないように） */
examsRouter.post('/exams/:examId/start', async (req, res) => {
  const p = req.profile!;
  if (p.role === 'retired') return res.status(403).json({ error: 'not permitted' });
  const examId = req.params.examId;

  const exam = (
    await pool.query(
      `SELECT id, name, description, pass_score, time_limit_min, shuffle_questions, is_published
         FROM exams WHERE id = $1`,
      [examId],
    )
  ).rows[0];
  if (!exam) return res.status(404).json({ error: 'exam not found' });
  if (!exam.is_published && p.role !== 'board') {
    return res.status(403).json({ error: 'exam not published' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let attempt = (
      await client.query(
        `SELECT * FROM exam_attempts
          WHERE user_id = $1 AND exam_id = $2 AND status = 'in_progress'
          ORDER BY started_at DESC LIMIT 1
          FOR UPDATE`,
        [p.id, examId],
      )
    ).rows[0];

    if (!attempt) {
      const ids = (
        await client.query<{ id: string }>(
          `SELECT id FROM exam_questions WHERE exam_id = $1
            ORDER BY ${exam.shuffle_questions ? 'random()' : 'no'}`,
          [examId],
        )
      ).rows.map((r) => r.id);
      if (ids.length === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'exam has no questions' });
      }
      attempt = (
        await client.query(
          `INSERT INTO exam_attempts (user_id, exam_id, question_ids)
           VALUES ($1, $2, $3) RETURNING *`,
          [p.id, examId, ids],
        )
      ).rows[0];
    }

    // 出題。correct_keys と explanation は含めない
    const questions = (
      await client.query(
        `SELECT q.id, q.no, q.category, q.question, q.choices,
                q.allow_multiple, q.points, q.difficulty
           FROM unnest($1::bigint[]) WITH ORDINALITY AS ord(qid, idx)
           JOIN exam_questions q ON q.id = ord.qid
          ORDER BY ord.idx`,
        [attempt.question_ids],
      )
    ).rows;

    const totalPoints = questions.reduce((s, q) => s + Number(q.points), 0);

    await client.query('COMMIT');
    res.json({
      attempt_id: attempt.id,
      started_at: attempt.started_at,
      total_points: totalPoints,
      exam: {
        id: exam.id,
        name: exam.name,
        description: exam.description,
        pass_score: exam.pass_score,
        time_limit_min: exam.time_limit_min,
      },
      questions,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

/** 提出・採点。answers は { "<question_id>": ["a"] } 形式。文字列 "a" も受け付ける */
examsRouter.post('/exams/attempts/:attemptId/submit', async (req, res) => {
  const p = req.profile!;
  const attemptId = Number(req.params.attemptId);
  if (!Number.isInteger(attemptId)) return res.status(400).json({ error: 'bad attempt id' });

  const raw = (req.body?.answers ?? {}) as Record<string, string[] | string>;
  const answers = new Map<string, string[]>();
  for (const [qid, v] of Object.entries(raw)) {
    const keys = Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [];
    answers.set(String(qid), [...new Set(keys.map(String))].sort());
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const attempt = (
      await client.query('SELECT * FROM exam_attempts WHERE id = $1 FOR UPDATE', [attemptId])
    ).rows[0];
    if (!attempt) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'attempt not found' });
    }
    if (attempt.user_id !== p.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'not permitted' });
    }
    if (attempt.status === 'submitted') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'already submitted' });
    }

    const exam = (await client.query('SELECT * FROM exams WHERE id = $1', [attempt.exam_id])).rows[0];
    const questions = (
      await client.query(
        `SELECT id, correct_keys, points FROM exam_questions WHERE id = ANY($1::bigint[])`,
        [attempt.question_ids],
      )
    ).rows;

    let earned = 0;
    let total = 0;
    for (const q of questions) {
      const selected = answers.get(String(q.id)) ?? [];
      const correct = [...(q.correct_keys as string[])].sort();
      const ok = selected.length === correct.length && selected.every((k, i) => k === correct[i]);
      const pts = ok ? Number(q.points) : 0;
      earned += pts;
      total += Number(q.points);
      await client.query(
        `INSERT INTO exam_attempt_answers
           (attempt_id, question_id, selected_keys, is_correct, earned_points)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (attempt_id, question_id) DO UPDATE
           SET selected_keys = EXCLUDED.selected_keys,
               is_correct    = EXCLUDED.is_correct,
               earned_points = EXCLUDED.earned_points`,
        [attemptId, q.id, selected.length ? selected : null, ok, pts],
      );
    }

    await client.query(
      `UPDATE exam_attempts
          SET status = 'submitted', submitted_at = now(),
              earned_points = $2, total_points = $3, passed = $4
        WHERE id = $1`,
      [attemptId, earned, total, earned >= exam.pass_score],
    );

    await client.query('COMMIT');
    res.json(await buildResult(attemptId));
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

/** 提出済み attempt の結果。正解と解説はここで初めて返す */
examsRouter.get('/exams/attempts/:attemptId', async (req, res) => {
  const p = req.profile!;
  const attemptId = Number(req.params.attemptId);
  if (!Number.isInteger(attemptId)) return res.status(400).json({ error: 'bad attempt id' });

  const attempt = (await pool.query('SELECT * FROM exam_attempts WHERE id = $1', [attemptId])).rows[0];
  if (!attempt) return res.status(404).json({ error: 'attempt not found' });

  let allowed = false;
  if (p.role === 'board') allowed = true;
  else if (p.role === 'leader') {
    const sameTeam = await pool.query(
      'SELECT 1 FROM profiles WHERE id = $1 AND team_id = $2',
      [attempt.user_id, p.team_id],
    );
    allowed = (sameTeam.rowCount ?? 0) > 0;
  } else if (p.role === 'member') allowed = attempt.user_id === p.id;
  if (!allowed) return res.status(403).json({ error: 'not permitted' });
  if (attempt.status !== 'submitted') return res.status(409).json({ error: 'not submitted yet' });

  res.json(await buildResult(attemptId));
});

async function buildResult(attemptId: number) {
  const attempt = (await pool.query('SELECT * FROM exam_attempts WHERE id = $1', [attemptId])).rows[0];
  const exam = (await pool.query('SELECT * FROM exams WHERE id = $1', [attempt.exam_id])).rows[0];
  const { rows: results } = await pool.query(
    `SELECT q.id AS question_id, q.no, q.category, q.question, q.choices,
            q.allow_multiple, q.points,
            COALESCE(aa.selected_keys, '{}') AS selected_keys,
            q.correct_keys, aa.is_correct, aa.earned_points, q.explanation
       FROM unnest($1::bigint[]) WITH ORDINALITY AS ord(qid, idx)
       JOIN exam_questions q ON q.id = ord.qid
       LEFT JOIN exam_attempt_answers aa
              ON aa.attempt_id = $2 AND aa.question_id = q.id
      ORDER BY ord.idx`,
    [attempt.question_ids, attemptId],
  );
  return {
    attempt_id: attempt.id,
    exam: { id: exam.id, name: exam.name, pass_score: exam.pass_score },
    earned_points: attempt.earned_points,
    total_points: attempt.total_points,
    passed: attempt.passed,
    submitted_at: attempt.submitted_at,
    results,
  };
}
