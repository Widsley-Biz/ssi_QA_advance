import { Router } from 'express';
import { getStorage } from 'firebase-admin/storage';
import { pool } from '../db.js';
import { requireRole, type Profile } from '../auth.js';

export const examsRouter = Router();

const MATERIALS_BUCKET = 'widsley-skillcheck-materials';
const MATERIALS_BASE_URL = `https://storage.googleapis.com/${MATERIALS_BUCKET}/`;

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
      // 主チーム or 追加所属(profile_teams)のどちらかで自チームのメンバーとみなす
      clause: `a.user_id IN (
        SELECT id FROM profiles WHERE team_id = $1
        UNION
        SELECT profile_id FROM profile_teams WHERE team_id = $1
      )`,
      values: [teamId],
    };
  }
  return { clause: 'a.user_id = $1', values: [id] };
}

/**
 * 試験の受験可否判定。board は常にtrue（下見・管理用）。
 * member/leader は is_published・開始/終了日時・対象者(exam_targets)を見る。
 * exam_targets に1件も行が無い試験は全員対象（既存の自習試験と同じ動作）。
 */
async function checkExamAccess(
  exam: { id: string; is_published: boolean; opens_at: Date | string | null; closes_at: Date | string | null },
  profile: Profile,
): Promise<{ ok: boolean; reason?: string }> {
  if (profile.role === 'board') return { ok: true };
  if (!exam.is_published) return { ok: false, reason: '非公開の試験です' };

  const now = new Date();
  if (exam.opens_at && now < new Date(exam.opens_at)) return { ok: false, reason: 'この試験はまだ開始していません' };
  if (exam.closes_at && now > new Date(exam.closes_at)) return { ok: false, reason: 'この試験は受付を終了しました' };

  const { rows } = await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE email = $2)::int AS mine
       FROM exam_targets WHERE exam_id = $1`,
    [exam.id, profile.email],
  );
  if (rows[0].total > 0 && rows[0].mine === 0) return { ok: false, reason: 'この試験の対象者ではありません' };
  return { ok: true };
}

/** 正式試験（closes_at設定あり）は終了まで採点結果を非公開にする */
function isRevealed(exam: { closes_at: Date | string | null }): boolean {
  return !exam.closes_at || new Date(exam.closes_at) <= new Date();
}

/** 試験一覧。自分の受験回数と最高得点を添える */
examsRouter.get('/exams', async (req, res) => {
  const p = req.profile!;
  if (p.role === 'retired') return res.status(403).json({ error: 'not permitted' });

  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.description, e.group_name, e.pass_score, e.time_limit_min,
            e.sort_order, e.is_published, e.kind,
            e.opens_at, e.closes_at, e.max_attempts, e.materials,
            (SELECT count(*) FROM exam_targets t WHERE t.exam_id = e.id)::int AS target_count,
            (SELECT count(*) FROM exam_questions q WHERE q.exam_id = e.id)::int      AS question_count,
            (SELECT COALESCE(sum(q.points), 0) FROM exam_questions q WHERE q.exam_id = e.id)::int AS total_points,
            (SELECT count(*) FROM exam_attempts a
              WHERE a.exam_id = e.id AND a.user_id = $1 AND a.status = 'submitted')::int AS my_attempts,
            (SELECT max(a.earned_points) FROM exam_attempts a
              WHERE a.exam_id = e.id AND a.user_id = $1 AND a.status = 'submitted')::int AS my_best_score,
            -- 実技（kind='practical'）はここで採点しないので、自己申告の回数と最終日時だけ添える
            (SELECT count(*) FROM exam_practical_submissions s
              WHERE s.exam_id = e.id AND s.user_id = $1)::int AS my_practical_count,
            (SELECT max(s.submitted_at) FROM exam_practical_submissions s
              WHERE s.exam_id = e.id AND s.user_id = $1)      AS my_practical_at
       FROM exams e
      WHERE $2 = 'board' OR (
              e.is_published
          AND (e.opens_at  IS NULL OR e.opens_at  <= now())
          AND (e.closes_at IS NULL OR e.closes_at >= now())
          AND (
                NOT EXISTS (SELECT 1 FROM exam_targets t WHERE t.exam_id = e.id)
             OR EXISTS (SELECT 1 FROM exam_targets t WHERE t.exam_id = e.id AND t.email = $3)
              )
            )
      ORDER BY e.group_name, e.sort_order, e.id`,
    [p.id, p.role, p.email],
  );
  res.json(rows);
});

/**
 * 教材(materials)の視聴進捗。
 *
 * exams.materials ([{id,label,url,pages}]) の各教材について、
 * 実際に開いたページの集合(viewed_pages)と再開位置(last_page)を持つ。
 * pages(総ページ数)はテーブルに持たず、常に exams.materials[].pages を正とする
 * （クライアント申告値をそのまま信用しない）。
 */

/** 自分の教材進捗を全件返す。一覧画面の%バッジとビューアの再開位置の両方がこれを使う */
examsRouter.get('/exams/materials/progress/mine', async (req, res) => {
  const p = req.profile!;
  const { rows } = await pool.query(
    `SELECT exam_id, material_id, viewed_pages, last_page, updated_at
       FROM material_progress WHERE user_id = $1`,
    [p.id],
  );
  res.json(rows);
});

/** 管理者向け：対象試験の全プロフィール×教材進捗（未着手者もLEFT JOINで出す） */
examsRouter.get('/exams/:examId/materials/progress', requireRole('board'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT pr.id AS user_id, pr.display_name,
            mp.material_id, mp.viewed_pages, mp.last_page, mp.updated_at
       FROM profiles pr
       LEFT JOIN material_progress mp ON mp.user_id = pr.id AND mp.exam_id = $1
      WHERE pr.role <> 'retired'
      ORDER BY pr.display_name`,
    [req.params.examId],
  );
  res.json(rows);
});

/** ページ遷移のたびに呼ぶ。デバウンスしない（タブを閉じる直前の遷移を失わないため） */
examsRouter.put('/exams/:examId/materials/:materialId/progress', async (req, res) => {
  const p = req.profile!;
  if (p.role === 'retired') return res.status(403).json({ error: 'not permitted' });
  const { examId, materialId } = req.params;

  const exam = (
    await pool.query(
      `SELECT id, is_published, opens_at, closes_at, materials FROM exams WHERE id = $1`,
      [examId],
    )
  ).rows[0];
  if (!exam) return res.status(404).json({ error: 'exam not found' });
  const access = await checkExamAccess(exam, p);
  if (!access.ok) return res.status(403).json({ error: access.reason });

  const material = (exam.materials ?? []).find(
    (m: { id?: string; pages?: number }) => m.id === materialId,
  );
  if (!material?.pages) return res.status(404).json({ error: 'material not found' });

  const page = Math.min(Math.max(1, Math.trunc(Number(req.body?.page))), material.pages);
  if (!Number.isInteger(page)) return res.status(400).json({ error: 'bad page' });

  await pool.query(
    `INSERT INTO material_progress (user_id, exam_id, material_id, viewed_pages, last_page)
     VALUES ($1, $2, $3, ARRAY[$4]::int[], $4)
     ON CONFLICT (user_id, exam_id, material_id) DO UPDATE SET
       viewed_pages = CASE WHEN $4 = ANY(material_progress.viewed_pages)
                            THEN material_progress.viewed_pages
                            ELSE array_append(material_progress.viewed_pages, $4) END,
       last_page = $4,
       updated_at = now()`,
    [p.id, examId, materialId, page],
  );
  res.json({ ok: true });
});

/**
 * スライド教材のページ画像。
 *
 * バケット(widsley-skillcheck-materials)は非公開のため、ここで認証・受験資格を
 * 確認したうえでオブジェクトをそのままストリームする（署名付きURLではなく毎回
 * ここを経由させる方式。画像は1枚あたり数十〜百数十KB程度で軽いため、
 * Cloud Run経由でも問題にならない）。
 */
examsRouter.get('/exams/:examId/materials/:materialId/pages/:n', async (req, res) => {
  const p = req.profile!;
  if (p.role === 'retired') return res.status(403).json({ error: 'not permitted' });
  const { examId, materialId } = req.params;
  const n = Number(req.params.n);

  const exam = (
    await pool.query(
      `SELECT id, is_published, opens_at, closes_at, materials FROM exams WHERE id = $1`,
      [examId],
    )
  ).rows[0];
  if (!exam) return res.status(404).json({ error: 'exam not found' });
  const access = await checkExamAccess(exam, p);
  if (!access.ok) return res.status(403).json({ error: access.reason });

  const material = (exam.materials ?? []).find(
    (m: { id?: string; pages?: number; url?: string }) => m.id === materialId,
  );
  if (!material?.pages || !material.url?.startsWith(MATERIALS_BASE_URL)) {
    return res.status(404).json({ error: 'material not found' });
  }
  if (!Number.isInteger(n) || n < 1 || n > material.pages) {
    return res.status(404).json({ error: 'page not found' });
  }

  const prefix = material.url.slice(MATERIALS_BASE_URL.length);
  const objectPath = `${prefix}/${String(n).padStart(3, '0')}.jpg`;

  try {
    const file = getStorage().bucket(MATERIALS_BUCKET).file(objectPath);
    res.setHeader('Content-Type', 'image/jpeg');
    // 失敗レスポンスをブラウザにキャッシュさせない（再読み込みが同じ失敗を
    // 返し続けないように）。成功が確定した最初のデータが来てから初めて
    // キャッシュ可能にする
    res.setHeader('Cache-Control', 'no-store');
    const stream = file.createReadStream();
    let succeeded = false;
    stream.once('data', () => {
      succeeded = true;
      if (!res.headersSent) res.setHeader('Cache-Control', 'private, max-age=3600');
    });
    stream
      .on('error', (err: { code?: number }) => {
        console.error('material page stream error', objectPath, err);
        if (succeeded || res.headersSent) return res.end();
        res.status(err.code === 404 ? 404 : 502).json({ error: 'failed to load page image' });
      })
      .pipe(res);
  } catch (err) {
    console.error('material page load error', objectPath, err);
    res.status(502).json({ error: 'failed to load page image' });
  }
});

/**
 * 実技の案内。文言とリンクはDBの guide(jsonb) にしか無いので、
 * 直すときはSQLを流すだけでよく、デプロイは要らない。
 */
examsRouter.get('/exams/:examId/practical', async (req, res) => {
  const p = req.profile!;
  if (p.role === 'retired') return res.status(403).json({ error: 'not permitted' });

  const exam = (await pool.query(
    `SELECT id, name, description, group_name, kind, guide, is_published, opens_at, closes_at
       FROM exams WHERE id = $1`,
    [req.params.examId],
  )).rows[0];
  if (!exam) return res.status(404).json({ error: 'exam not found' });
  const access = await checkExamAccess(exam, p);
  if (!access.ok) return res.status(403).json({ error: access.reason });
  if (exam.kind !== 'practical') return res.status(409).json({ error: 'not a practical exam' });

  const { rows: mine } = await pool.query(
    `SELECT id, pr_url, note, submitted_at
       FROM exam_practical_submissions
      WHERE exam_id = $1 AND user_id = $2
      ORDER BY submitted_at DESC
      LIMIT 20`,
    [exam.id, p.id],
  );
  res.json({ exam, my_submissions: mine });
});

/** 実技の自己申告。点数は受け取らない（採点はPRレビュー側） */
examsRouter.post('/exams/:examId/practical/submissions', async (req, res) => {
  const p = req.profile!;
  if (p.role === 'retired') return res.status(403).json({ error: 'not permitted' });

  const exam = (await pool.query(
    `SELECT id, kind, is_published, opens_at, closes_at FROM exams WHERE id = $1`,
    [req.params.examId],
  )).rows[0];
  if (!exam) return res.status(404).json({ error: 'exam not found' });
  const access = await checkExamAccess(exam, p);
  if (!access.ok) return res.status(403).json({ error: access.reason });
  if (exam.kind !== 'practical') return res.status(409).json({ error: 'not a practical exam' });

  // 貼り間違いをそのまま保存しないよう、GitHubのPR URLだけ通す（空欄は許可）
  const prUrl = String(req.body?.pr_url ?? '').trim();
  if (prUrl && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/.test(prUrl)) {
    return res.status(400).json({
      error: 'PRのURLは https://github.com/オーナー/リポジトリ/pull/番号 の形で入れてください',
    });
  }
  const note = String(req.body?.note ?? '').trim().slice(0, 500);

  const { rows } = await pool.query(
    `INSERT INTO exam_practical_submissions (exam_id, user_id, pr_url, note)
     VALUES ($1, $2, $3, $4)
     RETURNING id, pr_url, note, submitted_at`,
    [exam.id, p.id, prUrl, note],
  );
  res.status(201).json(rows[0]);
});

/** 自己申告の取り消し。自分の行だけ消せる（boardは全件） */
examsRouter.delete('/exams/practical/submissions/:id', async (req, res) => {
  const p = req.profile!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad id' });

  const { rowCount } = await pool.query(
    `DELETE FROM exam_practical_submissions
      WHERE id = $1 AND ($2 = 'board' OR user_id = $3)`,
    [id, p.role, p.id],
  );
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
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
  values.push(p.role);
  const roleParam = `$${values.length}`;

  // 正式試験（closes_at設定あり）は終了まで本人・リーダーに点数を見せない（boardのみ常に見える）。
  // ここで隠さないと、結果画面は非表示にしていても一覧（受験履歴）から漏れてしまう
  const { rows } = await pool.query(
    `SELECT a.id, a.exam_id, e.name AS exam_name, a.user_id, pr.display_name,
            a.status, a.started_at, a.submitted_at,
            CASE WHEN ${roleParam} = 'board' OR e.closes_at IS NULL OR e.closes_at <= now()
                 THEN a.earned_points END AS earned_points,
            CASE WHEN ${roleParam} = 'board' OR e.closes_at IS NULL OR e.closes_at <= now()
                 THEN a.total_points END AS total_points,
            CASE WHEN ${roleParam} = 'board' OR e.closes_at IS NULL OR e.closes_at <= now()
                 THEN a.passed END AS passed,
            (${roleParam} <> 'board' AND e.closes_at IS NOT NULL AND e.closes_at > now()) AS pending_reveal
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
      `SELECT id, name, description, kind, pass_score, time_limit_min, shuffle_questions,
              is_published, opens_at, closes_at, max_attempts
         FROM exams WHERE id = $1`,
      [examId],
    )
  ).rows[0];
  if (!exam) return res.status(404).json({ error: 'exam not found' });
  const access = await checkExamAccess(exam, p);
  if (!access.ok) return res.status(403).json({ error: access.reason });
  if (exam.kind !== 'written') return res.status(409).json({ error: 'not a written exam' });

  if (exam.max_attempts != null && p.role !== 'board') {
    const { rows: cnt } = await pool.query(
      `SELECT count(*)::int AS n FROM exam_attempts
        WHERE user_id = $1 AND exam_id = $2 AND status = 'submitted'`,
      [p.id, examId],
    );
    if (cnt[0].n >= exam.max_attempts) {
      return res.status(409).json({ error: '受験回数の上限に達しています' });
    }
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
    // 正式試験（closes_at設定あり）は終了まで本人に採点結果・解説を見せない。
    // 採点自体とexam_attempt_answersへの保存はここまでで完了済みなので、絞るのはレスポンスだけ
    if (p.role !== 'board' && !isRevealed(exam)) {
      return res.json({
        attempt_id: attemptId,
        exam: { id: exam.id, name: exam.name },
        status: 'submitted',
        reveal_at: exam.closes_at,
      });
    }
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
      `SELECT 1 FROM profiles WHERE id = $1 AND (
         team_id = $2 OR id IN (SELECT profile_id FROM profile_teams WHERE team_id = $2)
       )`,
      [attempt.user_id, p.team_id],
    );
    allowed = (sameTeam.rowCount ?? 0) > 0;
  } else if (p.role === 'member') allowed = attempt.user_id === p.id;
  if (!allowed) return res.status(403).json({ error: 'not permitted' });
  if (attempt.status !== 'submitted') return res.status(409).json({ error: 'not submitted yet' });

  const exam = (await pool.query('SELECT id, name, closes_at FROM exams WHERE id = $1', [attempt.exam_id])).rows[0];
  if (p.role !== 'board' && !isRevealed(exam)) {
    return res.json({
      attempt_id: attemptId,
      exam: { id: exam.id, name: exam.name },
      status: 'submitted',
      reveal_at: exam.closes_at,
    });
  }
  res.json(await buildResult(attemptId));
});

/**
 * 管理者向けレポート：メンバー×試験のマトリクス。
 * ベストスコア（同点なら最新提出）を1セルとして返す。対象者限定の試験で
 * 対象外のメンバーは excluded=true（結果は返さない）。退職(retired)は除外。
 */
examsRouter.get('/exams/report', requireRole('board'), async (_req, res) => {
  const { rows } = await pool.query(
    `WITH best_attempts AS (
       SELECT DISTINCT ON (a.user_id, a.exam_id)
              a.user_id, a.exam_id, a.id AS attempt_id,
              a.earned_points, a.total_points, a.passed, a.submitted_at
         FROM exam_attempts a
        WHERE a.status = 'submitted'
        ORDER BY a.user_id, a.exam_id, a.earned_points DESC, a.submitted_at DESC
     )
     SELECT p.id AS user_id, p.display_name, p.team_id,
            e.id AS exam_id, e.name AS exam_name, e.group_name, e.sort_order,
            COALESCE(t.total, 0) > 0 AND COALESCE(t.mine, 0) = 0 AS excluded,
            ba.attempt_id, ba.earned_points, ba.total_points, ba.passed, ba.submitted_at
       FROM profiles p
      CROSS JOIN exams e
       LEFT JOIN best_attempts ba ON ba.user_id = p.id AND ba.exam_id = e.id
       LEFT JOIN LATERAL (
             SELECT count(*)::int AS total,
                    count(*) FILTER (WHERE email = p.email)::int AS mine
               FROM exam_targets WHERE exam_id = e.id
            ) t ON true
      WHERE p.role <> 'retired'
        -- kind='material'はテストを持たない教材のみコースなので、
        -- 永久に「未受験」になる列をマトリクスに残さないよう除外する
        AND e.kind <> 'material'
      ORDER BY p.display_name, e.group_name, e.sort_order`,
  );
  res.json(rows);
});

/** 管理者向け：試験の日程・対象者設定の現在値（管理画面のプレフィル用） */
examsRouter.get('/admin/exams/:examId', requireRole('board'), async (req, res) => {
  const examId = req.params.examId;
  const exam = (
    await pool.query(
      `SELECT id, name, group_name, is_published, opens_at, closes_at, max_attempts, materials
         FROM exams WHERE id = $1`,
      [examId],
    )
  ).rows[0];
  if (!exam) return res.status(404).json({ error: 'exam not found' });
  const { rows: targets } = await pool.query(
    'SELECT email FROM exam_targets WHERE exam_id = $1 ORDER BY email',
    [examId],
  );
  res.json({ ...exam, target_emails: targets.map((t) => t.email) });
});

/** 管理者向け：試験の公開状態・開始/終了日時・受験回数上限を設定 */
examsRouter.put('/admin/exams/:examId/schedule', requireRole('board'), async (req, res) => {
  const examId = req.params.examId;
  const { is_published, opens_at, closes_at, max_attempts } = (req.body ?? {}) as {
    is_published?: boolean;
    opens_at?: string | null;
    closes_at?: string | null;
    max_attempts?: number | null;
  };

  if (typeof is_published !== 'boolean') {
    return res.status(400).json({ error: 'is_published must be a boolean' });
  }
  if (max_attempts != null && (!Number.isInteger(max_attempts) || max_attempts <= 0)) {
    return res.status(400).json({ error: 'max_attempts must be a positive integer or null' });
  }
  const opensAt = opens_at ? new Date(opens_at) : null;
  const closesAt = closes_at ? new Date(closes_at) : null;
  if (opensAt && Number.isNaN(opensAt.getTime())) return res.status(400).json({ error: 'bad opens_at' });
  if (closesAt && Number.isNaN(closesAt.getTime())) return res.status(400).json({ error: 'bad closes_at' });
  if (opensAt && closesAt && opensAt > closesAt) {
    return res.status(400).json({ error: 'opens_at must be before closes_at' });
  }

  const { rows, rowCount } = await pool.query(
    `UPDATE exams SET is_published = $2, opens_at = $3, closes_at = $4, max_attempts = $5
      WHERE id = $1
      RETURNING id, is_published, opens_at, closes_at, max_attempts`,
    [examId, is_published, opensAt, closesAt, max_attempts ?? null],
  );
  if (!rowCount) return res.status(404).json({ error: 'exam not found' });
  res.json(rows[0]);
});

/** 管理者向け：試験の対象者（email）を全置換。空配列=対象者指定なし=全員公開に戻る */
examsRouter.put('/admin/exams/:examId/targets', requireRole('board'), async (req, res) => {
  const examId = req.params.examId;
  const emailsRaw = (req.body?.emails ?? []) as unknown;
  if (!Array.isArray(emailsRaw)) return res.status(400).json({ error: 'emails must be an array' });

  const emails = [...new Set(emailsRaw.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  for (const email of emails) {
    if (!email.endsWith('@widsley.com')) {
      return res.status(400).json({ error: `@widsley.com 以外のメールは指定できません: ${email}` });
    }
  }

  const exam = (await pool.query('SELECT id FROM exams WHERE id = $1', [examId])).rows[0];
  if (!exam) return res.status(404).json({ error: 'exam not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM exam_targets WHERE exam_id = $1', [examId]);
    for (const email of emails) {
      await client.query(
        'INSERT INTO exam_targets (exam_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [examId, email],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  res.json({ exam_id: examId, emails });
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
