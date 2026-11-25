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
 * 試験の「予定」解決結果。
 *
 * hasSchedules=false の試験は従来通り exams.opens_at/closes_at/max_attempts
 * (レガシー予定、schedule_id=null)だけで動く。
 * hasSchedules=true の試験は exam_schedules の各行(予定)だけを見る。
 * このとき exams側の opens_at/closes_at/max_attempts は無視される。
 */
interface ResolvedSchedule {
  hasSchedules: boolean;
  scheduleId: number | null;
  opensAt: Date | string | null;
  closesAt: Date | string | null;
  maxAttempts: number | null;
  state: 'open' | 'not_yet' | 'closed' | 'not_targeted';
  /**
   * emailが「対象者として名前を指定されている」か（全員対象の予定で
   * 該当しているだけではない）。board が自分自身を受験者として扱って良いか
   * （＝回数上限等を適用すべきか）の判定に使う。
   */
  explicit: boolean;
}

/**
 * 対象のユーザーにとって「いま有効な予定」を1つ選ぶ。
 * 候補が複数ある場合は締切(closes_at)が最も近いものを優先する
 * （同時に開いている予定の対象者は重ならない設計を前提にした決め打ち）。
 */
async function resolveSchedule(
  examId: string,
  legacy: { opens_at: Date | string | null; closes_at: Date | string | null; max_attempts: number | null },
  email: string,
): Promise<ResolvedSchedule> {
  const { rows: schedules } = await pool.query<{
    id: number;
    opens_at: Date | string | null;
    closes_at: Date | string | null;
    max_attempts: number | null;
    open_to_all: boolean;
    targets_me: boolean;
  }>(
    `SELECT s.id, s.opens_at, s.closes_at, s.max_attempts,
            NOT EXISTS (SELECT 1 FROM exam_schedule_targets t WHERE t.schedule_id = s.id) AS open_to_all,
            EXISTS (SELECT 1 FROM exam_schedule_targets t WHERE t.schedule_id = s.id AND t.email = $2) AS targets_me
       FROM exam_schedules s WHERE s.exam_id = $1
       ORDER BY s.closes_at ASC NULLS LAST, s.id ASC`,
    [examId, email],
  );

  if (schedules.length === 0) {
    // レガシー予定(exam_schedulesが0件)。exam_targetsで対象者を絞る
    // （この分岐が無いと「対象者限定」の従来試験に誰でも直接APIを叩いて
    //  入れてしまう。一覧(GET /exams)側では絞られていても、ここで
    //  絞らないとstart等の他のエンドポイントが素通りしてしまうため必須）
    const { rows: targetRows } = await pool.query<{ total: number; mine: number }>(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE email = $2)::int AS mine
         FROM exam_targets WHERE exam_id = $1`,
      [examId, email],
    );
    const { total, mine } = targetRows[0];
    if (total > 0 && mine === 0) {
      return { hasSchedules: false, scheduleId: null, opensAt: null, closesAt: null, maxAttempts: null, state: 'not_targeted', explicit: false };
    }
    const now = new Date();
    const opensAt = legacy.opens_at ? new Date(legacy.opens_at) : null;
    const closesAt = legacy.closes_at ? new Date(legacy.closes_at) : null;
    let state: ResolvedSchedule['state'] = 'open';
    if (opensAt && now < opensAt) state = 'not_yet';
    else if (closesAt && now > closesAt) state = 'closed';
    return { hasSchedules: false, scheduleId: null, opensAt, closesAt, maxAttempts: legacy.max_attempts, state, explicit: total > 0 && mine > 0 };
  }

  const mine = schedules.filter((s) => s.open_to_all || s.targets_me);
  if (mine.length === 0) {
    return { hasSchedules: true, scheduleId: null, opensAt: null, closesAt: null, maxAttempts: null, state: 'not_targeted', explicit: false };
  }

  const now = new Date();
  const isOpen = (s: (typeof mine)[number]) =>
    (s.opens_at == null || now >= new Date(s.opens_at)) && (s.closes_at == null || now <= new Date(s.closes_at));
  const openOnes = mine.filter(isOpen);
  if (openOnes.length > 0) {
    const s = openOnes[0]; // 既に closes_at 昇順でソート済み＝最も締切が近いもの
    return { hasSchedules: true, scheduleId: s.id, opensAt: s.opens_at, closesAt: s.closes_at, maxAttempts: s.max_attempts, state: 'open', explicit: s.targets_me };
  }

  const future = mine
    .filter((s) => s.opens_at && now < new Date(s.opens_at))
    .sort((a, b) => new Date(a.opens_at!).getTime() - new Date(b.opens_at!).getTime());
  if (future.length > 0) {
    const s = future[0];
    return { hasSchedules: true, scheduleId: s.id, opensAt: s.opens_at, closesAt: s.closes_at, maxAttempts: s.max_attempts, state: 'not_yet', explicit: s.targets_me };
  }

  const past = [...mine].sort(
    (a, b) => new Date(b.closes_at ?? 0).getTime() - new Date(a.closes_at ?? 0).getTime(),
  );
  const s = past[0];
  return { hasSchedules: true, scheduleId: s.id, opensAt: s.opens_at, closesAt: s.closes_at, maxAttempts: s.max_attempts, state: 'closed', explicit: s.targets_me };
}

/**
 * 試験の受験可否判定。
 * member/leader は is_published・予定(レガシー or exam_schedules)・対象者を見る。
 * 対象者を1人も設定していない予定は全員対象（既存の自習試験と同じ動作）。
 *
 * board は下見・管理のため基本的に常にtrue。ただしboardが予定の対象者として
 * 明示的に名前を指定されており(explicit)、かつその予定が今まさに開いている(open)
 * 場合だけは「実際の受験者」として扱い、schedule を添えて回数上限等を適用する
 * （boardが自分自身をテスト受験者に加えて動作確認するケースのため。それ以外の
 *  通常の下見では、公開前・対象外・終了後の試験も問題なく閲覧できる必要がある）。
 */
async function checkExamAccess(
  exam: {
    id: string;
    is_published: boolean;
    opens_at: Date | string | null;
    closes_at: Date | string | null;
    max_attempts?: number | null;
  },
  profile: Profile,
): Promise<{ ok: boolean; reason?: string; schedule?: ResolvedSchedule }> {
  if (profile.role === 'board') {
    const resolved = await resolveSchedule(
      exam.id,
      { opens_at: exam.opens_at, closes_at: exam.closes_at, max_attempts: exam.max_attempts ?? null },
      profile.email,
    );
    if (resolved.state === 'open' && resolved.explicit) return { ok: true, schedule: resolved };
    return { ok: true };
  }
  if (!exam.is_published) return { ok: false, reason: '非公開の試験です' };

  const resolved = await resolveSchedule(
    exam.id,
    { opens_at: exam.opens_at, closes_at: exam.closes_at, max_attempts: exam.max_attempts ?? null },
    profile.email,
  );
  if (resolved.state === 'not_yet') return { ok: false, reason: 'この試験はまだ開始していません' };
  if (resolved.state === 'closed') return { ok: false, reason: 'この試験は受付を終了しました' };
  if (resolved.state === 'not_targeted') return { ok: false, reason: 'この試験の対象者ではありません' };
  return { ok: true, schedule: resolved };
}

/** 正式試験（closes_at設定あり）は終了まで採点結果を非公開にする */
function isRevealed(exam: { closes_at: Date | string | null }): boolean {
  return !exam.closes_at || new Date(exam.closes_at) <= new Date();
}

/** 試験一覧。自分の受験回数と最高得点を添える */
examsRouter.get('/exams', async (req, res) => {
  const p = req.profile!;
  if (p.role === 'retired') return res.status(403).json({ error: 'not permitted' });

  // 複数予定(exam_schedules)を持つ試験は、このユーザーに対して「いま有効な予定」を
  // hs/rs/eff の3段のLATERALで解決する。exam_schedulesが1件も無い試験(大多数)は
  // 従来通り exams.opens_at/closes_at/max_attempts(レガシー予定)がそのまま使われる。
  // (resolveSchedule()と同じ「締切が最も近い予定を優先」のロジックをSQLで表現している)
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.description, e.group_name, e.pass_score, e.time_limit_min,
            e.sort_order, e.is_published, e.kind, e.category,
            eff.opens_at, eff.closes_at, eff.max_attempts, e.materials,
            (e.guide IS NOT NULL) AS has_guide,
            e.guide ->> 'button_label' AS guide_button_label,
            (SELECT count(*) FROM exam_targets t WHERE t.exam_id = e.id)::int AS target_count,
            (SELECT count(*) FROM exam_questions q WHERE q.exam_id = e.id)::int      AS question_count,
            (SELECT COALESCE(sum(q.points), 0) FROM exam_questions q WHERE q.exam_id = e.id)::int AS total_points,
            (SELECT count(*) FROM exam_attempts a
              WHERE a.exam_id = e.id AND a.user_id = $1 AND a.status = 'submitted'
                AND a.schedule_id IS NOT DISTINCT FROM eff.schedule_id)::int AS my_attempts,
            (SELECT max(a.earned_points) FROM exam_attempts a
              WHERE a.exam_id = e.id AND a.user_id = $1 AND a.status = 'submitted'
                AND a.schedule_id IS NOT DISTINCT FROM eff.schedule_id)::int AS my_best_score,
            -- 実技（kind='practical'）はここで採点しないので、自己申告の回数と最終日時だけ添える
            (SELECT count(*) FROM exam_practical_submissions s
              WHERE s.exam_id = e.id AND s.user_id = $1)::int AS my_practical_count,
            (SELECT max(s.submitted_at) FROM exam_practical_submissions s
              WHERE s.exam_id = e.id AND s.user_id = $1)      AS my_practical_at
       FROM exams e
       LEFT JOIN LATERAL (
             SELECT true AS yes FROM exam_schedules hs0 WHERE hs0.exam_id = e.id LIMIT 1
            ) hs ON true
       LEFT JOIN LATERAL (
             -- まず通常の受験者と同じ条件(時間内・対象者)で絞った予定を探す。
             -- boardがその予定の対象者として明示的に指定されている場合、ここで
             -- 見つかった予定が「boardの実際の受験」として扱われる(my_attempts等が
             -- 正しく数えられる)。見つからなければ(通常のboard下見)、2本目の
             -- クエリで対象者・時間を無視した「一番近い予定」のプレビューに落ちる
             (
               SELECT s.id, s.opens_at, s.closes_at, s.max_attempts, 1 AS pri
                 FROM exam_schedules s
                WHERE s.exam_id = e.id
                  AND (s.opens_at  IS NULL OR s.opens_at  <= now())
                  AND (s.closes_at IS NULL OR s.closes_at >= now())
                  AND (
                        NOT EXISTS (SELECT 1 FROM exam_schedule_targets st WHERE st.schedule_id = s.id)
                     OR EXISTS (SELECT 1 FROM exam_schedule_targets st WHERE st.schedule_id = s.id AND st.email = $3)
                      )
                ORDER BY s.closes_at ASC NULLS LAST, s.id ASC
                LIMIT 1
             )
             UNION ALL
             (
               SELECT s.id, s.opens_at, s.closes_at, s.max_attempts, 2 AS pri
                 FROM exam_schedules s
                WHERE s.exam_id = e.id AND $2 = 'board'
                -- boardは時間での絞り込みをしていないため、終了済みの予定より
                -- 開催中・予約中の予定を優先して表示する(そうしないと終了済みの
                -- 最初の予定が一番締切が近い=優先されてしまう)
                ORDER BY (s.closes_at IS NOT NULL AND s.closes_at < now()) ASC, s.closes_at ASC NULLS LAST, s.id ASC
                LIMIT 1
             )
             ORDER BY pri ASC
             LIMIT 1
            ) rs ON true
       LEFT JOIN LATERAL (
             SELECT
               CASE WHEN hs.yes THEN rs.id          ELSE NULL         END AS schedule_id,
               CASE WHEN hs.yes THEN rs.opens_at    ELSE e.opens_at   END AS opens_at,
               CASE WHEN hs.yes THEN rs.closes_at   ELSE e.closes_at  END AS closes_at,
               CASE WHEN hs.yes THEN rs.max_attempts ELSE e.max_attempts END AS max_attempts
            ) eff ON true
      WHERE $2 = 'board' OR (
              e.is_published
          AND (
                (hs.yes IS NOT TRUE
                  AND (e.opens_at  IS NULL OR e.opens_at  <= now())
                  AND (e.closes_at IS NULL OR e.closes_at >= now())
                  AND (
                        NOT EXISTS (SELECT 1 FROM exam_targets t WHERE t.exam_id = e.id)
                     OR EXISTS (SELECT 1 FROM exam_targets t WHERE t.exam_id = e.id AND t.email = $3)
                      )
                )
             OR (hs.yes IS TRUE AND eff.schedule_id IS NOT NULL)
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
      WHERE pr.role NOT IN ('retired', 'board')
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

  const existing = (
    await pool.query<{ viewed_pages: number[] }>(
      `SELECT viewed_pages FROM material_progress WHERE user_id = $1 AND exam_id = $2 AND material_id = $3`,
      [p.id, examId, materialId],
    )
  ).rows[0];
  const isNewPage = !existing?.viewed_pages.includes(page);

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

  // デイリー学習進捗・個人別推移で使う「新しく読んだページ」のログ。再訪問は記録しない
  if (isNewPage) {
    await pool.query(
      `INSERT INTO material_progress_log (user_id, exam_id, material_id, page) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, exam_id, material_id, page) DO NOTHING`,
      [p.id, examId, materialId, page],
    );
  }

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
 * 教材・実技共通の案内ページ。文言とリンクはDBの guide(jsonb) にしか無いので、
 * 直すときはSQLを流すだけでよく、デプロイは要らない。
 *
 * /practical と違い kind の制限は無い（kind='material' の「はじめにガイド」・
 * 各回の後日演習課題の案内でも使うため）。guide が無い試験は404にする。
 */
examsRouter.get('/exams/:examId/guide', async (req, res) => {
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
  if (!exam.guide) return res.status(404).json({ error: 'no guide for this exam' });

  res.json({ exam });
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
  // ここで隠さないと、結果画面は非表示にしていても一覧（受験履歴）から漏れてしまう。
  // 複数予定(exam_schedules)を使っている試験は、受験時の予定(a.schedule_id)に
  // 紐づく closes_at を基準にする（exams.closes_at は複数予定モードでは参照しない）
  const { rows } = await pool.query(
    `SELECT a.id, a.exam_id, e.name AS exam_name, a.user_id, pr.display_name,
            a.status, a.started_at, a.submitted_at,
            CASE WHEN ${roleParam} = 'board' OR eff.closes_at IS NULL OR eff.closes_at <= now()
                 THEN a.earned_points END AS earned_points,
            CASE WHEN ${roleParam} = 'board' OR eff.closes_at IS NULL OR eff.closes_at <= now()
                 THEN a.total_points END AS total_points,
            CASE WHEN ${roleParam} = 'board' OR eff.closes_at IS NULL OR eff.closes_at <= now()
                 THEN a.passed END AS passed,
            (${roleParam} <> 'board' AND eff.closes_at IS NOT NULL AND eff.closes_at > now()) AS pending_reveal
       FROM exam_attempts a
       JOIN exams e ON e.id = a.exam_id
       JOIN profiles pr ON pr.id = a.user_id
       LEFT JOIN exam_schedules es ON es.id = a.schedule_id
       LEFT JOIN LATERAL (
             SELECT CASE WHEN a.schedule_id IS NOT NULL THEN es.closes_at ELSE e.closes_at END AS closes_at
            ) eff ON true
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

  // 下見中のboard(access.scheduleが無い=予定の対象者として明示されていない)は
  // schedule_id=null・回数無制限のまま進める。board が予定の対象者として明示されて
  // いる場合は access.schedule が付き、通常の受験者と同じく回数上限を適用する。
  // ここで `??` を使うと「予定が無制限(maxAttempts=null)」を「予定情報が無い」と
  // 取り違えて exam.max_attempts (レガシー値。複数予定モードでは無効なはず) に
  // フォールバックしてしまうため、schedule の有無で明示的に分岐する
  const scheduleId = access.schedule?.scheduleId ?? null;
  const maxAttempts = access.schedule ? access.schedule.maxAttempts : exam.max_attempts;
  const isPreviewBoard = p.role === 'board' && !access.schedule;

  if (maxAttempts != null && !isPreviewBoard) {
    const { rows: cnt } = await pool.query(
      `SELECT count(*)::int AS n FROM exam_attempts
        WHERE user_id = $1 AND exam_id = $2 AND status = 'submitted'
          AND schedule_id IS NOT DISTINCT FROM $3`,
      [p.id, examId, scheduleId],
    );
    if (cnt[0].n >= maxAttempts) {
      return res.status(409).json({ error: '受験回数の上限に達しています' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 同じ予定(schedule_id)の未提出attemptだけ再利用する。複数予定を使っている
    // 試験で、別の予定(過去ラウンド等)の未提出attemptを誤って再開しないように
    let attempt = (
      await client.query(
        `SELECT * FROM exam_attempts
          WHERE user_id = $1 AND exam_id = $2 AND status = 'in_progress'
            AND schedule_id IS NOT DISTINCT FROM $3
          ORDER BY started_at DESC LIMIT 1
          FOR UPDATE`,
        [p.id, examId, scheduleId],
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
          `INSERT INTO exam_attempts (user_id, exam_id, schedule_id, question_ids)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [p.id, examId, scheduleId, ids],
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
    // 複数予定(exam_schedules)を使っている試験は、受験時の予定自体のcloses_atを基準にする
    // （exams.closes_atは複数予定モードでは無視する）。
    // 採点自体とexam_attempt_answersへの保存はここまでで完了済みなので、絞るのはレスポンスだけ
    const effectiveClosesAt =
      attempt.schedule_id != null
        ? (await pool.query('SELECT closes_at FROM exam_schedules WHERE id = $1', [attempt.schedule_id])).rows[0]
            ?.closes_at ?? null
        : exam.closes_at;
    if (p.role !== 'board' && !isRevealed({ closes_at: effectiveClosesAt })) {
      return res.json({
        attempt_id: attemptId,
        exam: { id: exam.id, name: exam.name },
        status: 'submitted',
        reveal_at: effectiveClosesAt,
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
  const effectiveClosesAt =
    attempt.schedule_id != null
      ? (await pool.query('SELECT closes_at FROM exam_schedules WHERE id = $1', [attempt.schedule_id])).rows[0]
          ?.closes_at ?? null
      : exam.closes_at;
  if (p.role !== 'board' && !isRevealed({ closes_at: effectiveClosesAt })) {
    return res.json({
      attempt_id: attemptId,
      exam: { id: exam.id, name: exam.name },
      status: 'submitted',
      reveal_at: effectiveClosesAt,
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
     ),
     attempt_counts AS (
       SELECT user_id, exam_id, count(*)::int AS attempt_count
         FROM exam_attempts
        WHERE status = 'submitted'
        GROUP BY user_id, exam_id
     )
     SELECT p.id AS user_id, p.display_name, p.team_id,
            e.id AS exam_id, e.name AS exam_name, e.group_name, e.sort_order,
            CASE
              -- 複数予定(exam_schedules)モード：いずれかの予定の対象(全員対象含む)なら除外しない
              WHEN t.sched_total > 0 THEN t.sched_open_count = 0 AND t.sched_mine = 0
              -- レガシー予定：従来通りexam_targetsだけで判定
              ELSE COALESCE(t.legacy_total, 0) > 0 AND COALESCE(t.legacy_mine, 0) = 0
            END AS excluded,
            ba.attempt_id, ba.earned_points, ba.total_points, ba.passed, ba.submitted_at,
            COALESCE(ac.attempt_count, 0) AS attempt_count
       FROM profiles p
      CROSS JOIN exams e
       LEFT JOIN best_attempts ba ON ba.user_id = p.id AND ba.exam_id = e.id
       LEFT JOIN attempt_counts ac ON ac.user_id = p.id AND ac.exam_id = e.id
       LEFT JOIN LATERAL (
             SELECT
               (SELECT count(*) FROM exam_targets WHERE exam_id = e.id)::int AS legacy_total,
               (SELECT count(*) FROM exam_targets WHERE exam_id = e.id AND email = p.email)::int AS legacy_mine,
               (SELECT count(*) FROM exam_schedules WHERE exam_id = e.id)::int AS sched_total,
               (SELECT count(*) FROM exam_schedules s WHERE s.exam_id = e.id
                  AND NOT EXISTS (SELECT 1 FROM exam_schedule_targets st WHERE st.schedule_id = s.id))::int AS sched_open_count,
               (SELECT count(*) FROM exam_schedule_targets st
                  JOIN exam_schedules s ON s.id = st.schedule_id
                 WHERE s.exam_id = e.id AND st.email = p.email)::int AS sched_mine
            ) t ON true
      WHERE p.role NOT IN ('retired', 'board')
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
      `SELECT id, name, group_name, is_published, opens_at, closes_at, max_attempts, materials,
              (SELECT count(*) FROM exam_attempts WHERE exam_id = $1 AND schedule_id IS NULL AND status = 'submitted')::int AS attempt_count
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

function validateWidsleyEmails(emailsRaw: unknown): string[] | { error: string } {
  if (!Array.isArray(emailsRaw)) return { error: 'emails must be an array' };
  const emails = [...new Set(emailsRaw.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  for (const email of emails) {
    if (!email.endsWith('@widsley.com')) {
      return { error: `@widsley.com 以外のメールは指定できません: ${email}` };
    }
  }
  return emails;
}

function validateScheduleBody(body: unknown): {
  label: string;
  opensAt: Date | null;
  closesAt: Date | null;
  maxAttempts: number | null;
  emails: string[];
} | { error: string } {
  const { label, opens_at, closes_at, max_attempts, emails: emailsRaw } = (body ?? {}) as {
    label?: string;
    opens_at?: string | null;
    closes_at?: string | null;
    max_attempts?: number | null;
    emails?: unknown;
  };
  if (max_attempts != null && (!Number.isInteger(max_attempts) || max_attempts <= 0)) {
    return { error: 'max_attempts must be a positive integer or null' };
  }
  const opensAt = opens_at ? new Date(opens_at) : null;
  const closesAt = closes_at ? new Date(closes_at) : null;
  if (opensAt && Number.isNaN(opensAt.getTime())) return { error: 'bad opens_at' };
  if (closesAt && Number.isNaN(closesAt.getTime())) return { error: 'bad closes_at' };
  if (opensAt && closesAt && opensAt > closesAt) return { error: 'opens_at must be before closes_at' };
  const emails = validateWidsleyEmails(emailsRaw ?? []);
  if ('error' in emails) return emails;
  return { label: typeof label === 'string' ? label.trim() : '', opensAt, closesAt, maxAttempts: max_attempts ?? null, emails };
}

/**
 * 管理者向け：試験の「予定」一覧(複数予定モード)。
 * 開催中・予約中を先に、終了済み(履歴)を後ろに並べる。
 */
examsRouter.get('/admin/exams/:examId/schedules', requireRole('board'), async (req, res) => {
  const examId = req.params.examId;
  const exam = (await pool.query('SELECT id FROM exams WHERE id = $1', [examId])).rows[0];
  if (!exam) return res.status(404).json({ error: 'exam not found' });

  const { rows } = await pool.query(
    `SELECT s.id, s.label, s.opens_at, s.closes_at, s.max_attempts,
            (SELECT count(*) FROM exam_schedule_targets t WHERE t.schedule_id = s.id)::int AS target_count,
            (SELECT count(*) FROM exam_attempts a WHERE a.schedule_id = s.id AND a.status = 'submitted')::int AS attempt_count,
            -- 削除可否はステータス問わず全件で判定する(DELETEエンドポイントと同じ基準)。
            -- attempt_countは「受験済」の表示用で提出済みだけを数えるため、
            -- 受験中(in_progress)の記録があるのに「受験済0件」のまま削除がブロックされる
            -- ことがある。一覧側にdeletableを持たせて一致させる
            (SELECT count(*) FROM exam_attempts a WHERE a.schedule_id = s.id) = 0 AS deletable,
            (s.closes_at IS NOT NULL AND s.closes_at <= now()) AS is_past
       FROM exam_schedules s
      WHERE s.exam_id = $1
      ORDER BY (s.closes_at IS NOT NULL AND s.closes_at <= now()) ASC, s.opens_at ASC NULLS LAST, s.id ASC`,
    [examId],
  );
  res.json(rows);
});

/**
 * 管理者向け：複数予定(exam_schedules)が1件も無い試験の「予定」詳細(対象者ロスター・結果一覧)。
 * exam_targets + exam_attempts(schedule_id IS NULL)から組み立てる。
 * 「予定」一覧UIは複数予定モードかどうかを意識させず常に1件以上の予定を見せたいため、
 * schedules.length===0のときはこちらを叩く(ui側で分岐)
 */
examsRouter.get('/admin/exams/:examId/schedule-legacy-results', requireRole('board'), async (req, res) => {
  const examId = req.params.examId;
  const exam = (await pool.query('SELECT id FROM exams WHERE id = $1', [examId])).rows[0];
  if (!exam) return res.status(404).json({ error: 'exam not found' });

  const { rows: targetEmails } = await pool.query(
    'SELECT email FROM exam_targets WHERE exam_id = $1 ORDER BY email',
    [examId],
  );

  const { rows: members } = await pool.query(
    `WITH best AS (
       SELECT DISTINCT ON (a.user_id) a.user_id, a.id AS attempt_id, a.status,
              a.earned_points, a.total_points, a.passed, a.submitted_at
         FROM exam_attempts a WHERE a.exam_id = $1 AND a.schedule_id IS NULL
        ORDER BY a.user_id, a.earned_points DESC NULLS LAST, a.submitted_at DESC NULLS LAST
     )
     SELECT pr.id AS user_id, pr.email, pr.display_name,
            b.attempt_id, b.status, b.earned_points, b.total_points, b.passed, b.submitted_at
       FROM profiles pr
       LEFT JOIN best b ON b.user_id = pr.id
      WHERE ($2::int = 0 AND b.attempt_id IS NOT NULL)
         OR ($2::int > 0 AND pr.email = ANY($3::text[]))
      ORDER BY pr.display_name`,
    [examId, targetEmails.length, targetEmails.map((t) => t.email)],
  );

  res.json({
    exam_id: examId,
    target_count: targetEmails.length,
    target_emails: targetEmails.map((t) => t.email),
    members,
  });
});

/** 管理者向け：予定1件の詳細（対象者ロスター・結果一覧）。クリックして開く画面用 */
examsRouter.get('/admin/exams/:examId/schedules/:scheduleId', requireRole('board'), async (req, res) => {
  const examId = String(req.params.examId);
  const scheduleId = String(req.params.scheduleId);
  if (!/^\d+$/.test(scheduleId)) return res.status(400).json({ error: 'bad schedule id' });

  const schedule = (
    await pool.query(
      `SELECT id, exam_id, label, opens_at, closes_at, max_attempts
         FROM exam_schedules WHERE id = $1 AND exam_id = $2`,
      [scheduleId, examId],
    )
  ).rows[0];
  if (!schedule) return res.status(404).json({ error: 'schedule not found' });

  const { rows: targetEmails } = await pool.query(
    'SELECT email FROM exam_schedule_targets WHERE schedule_id = $1 ORDER BY email',
    [scheduleId],
  );

  // 対象者を指定している予定は「対象者 × ベスト結果」のロスターを返す（未受験者もnullの行で含む）。
  // 対象者指定なし(全員対象)の予定は対象者ロスターを組めないため、実際に受験した人の結果だけを返す
  const { rows: members } = await pool.query(
    `WITH best AS (
       SELECT DISTINCT ON (a.user_id) a.user_id, a.id AS attempt_id, a.status,
              a.earned_points, a.total_points, a.passed, a.submitted_at
         FROM exam_attempts a WHERE a.schedule_id = $1
        ORDER BY a.user_id, a.earned_points DESC NULLS LAST, a.submitted_at DESC NULLS LAST
     )
     SELECT pr.id AS user_id, pr.email, pr.display_name,
            b.attempt_id, b.status, b.earned_points, b.total_points, b.passed, b.submitted_at
       FROM profiles pr
       LEFT JOIN best b ON b.user_id = pr.id
      WHERE ($2::int = 0 AND b.attempt_id IS NOT NULL)
         OR ($2::int > 0 AND pr.email = ANY($3::text[]))
      ORDER BY pr.display_name`,
    [scheduleId, targetEmails.length, targetEmails.map((t) => t.email)],
  );

  res.json({
    exam_id: examId,
    schedule,
    target_count: targetEmails.length,
    // 対象者を編集フォームに正しくプリフィルするための生のメール一覧。
    // members はprofilesに行が無いemail(未ログインの対象者)を含まないため、
    // 編集時にこちらを無視してmembersから復元すると対象者が消えてしまう
    target_emails: targetEmails.map((t) => t.email),
    members,
  });
});

/**
 * 管理者向け：試験に新しい予定(開催回)を追加する。
 * この試験がまだ「複数予定モード」でない(exam_schedulesが0件)場合は、
 * 既存のレガシー予定(exams.opens_at/closes_at/max_attempts + exam_targets)を
 * まず1件目の予定としてコピーし、それに紐づく未割当のexam_attempts(schedule_id IS NULL)を
 * そちらに向け替えてから、リクエストされた新しい予定を追加する
 * （途中で見えなくなる受験者・受験記録が出ないようにするための移行手順）。
 */
examsRouter.post('/admin/exams/:examId/schedules', requireRole('board'), async (req, res) => {
  const examId = req.params.examId;
  const parsed = validateScheduleBody(req.body);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exam = (
      await client.query('SELECT id, is_published, opens_at, closes_at, max_attempts FROM exams WHERE id = $1 FOR UPDATE', [examId])
    ).rows[0];
    if (!exam) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'exam not found' });
    }

    const existingCount = (
      await client.query('SELECT count(*)::int AS n FROM exam_schedules WHERE exam_id = $1', [examId])
    ).rows[0].n;

    if (existingCount === 0) {
      const legacyTargets = (
        await client.query('SELECT email FROM exam_targets WHERE exam_id = $1', [examId])
      ).rows.map((r) => r.email);
      const legacy = (
        await client.query(
          `INSERT INTO exam_schedules (exam_id, label, opens_at, closes_at, max_attempts)
           VALUES ($1, '(以前の設定)', $2, $3, $4) RETURNING id`,
          [examId, exam.opens_at, exam.closes_at, exam.max_attempts],
        )
      ).rows[0];
      for (const email of legacyTargets) {
        await client.query(
          'INSERT INTO exam_schedule_targets (schedule_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [legacy.id, email],
        );
      }
      await client.query(
        'UPDATE exam_attempts SET schedule_id = $2 WHERE exam_id = $1 AND schedule_id IS NULL',
        [examId, legacy.id],
      );
    }

    const created = (
      await client.query(
        `INSERT INTO exam_schedules (exam_id, label, opens_at, closes_at, max_attempts)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, label, opens_at, closes_at, max_attempts`,
        [examId, parsed.label, parsed.opensAt, parsed.closesAt, parsed.maxAttempts],
      )
    ).rows[0];
    for (const email of parsed.emails) {
      await client.query(
        'INSERT INTO exam_schedule_targets (schedule_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [created.id, email],
      );
    }

    await client.query('COMMIT');
    res.json({ ...created, target_emails: parsed.emails });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

/** 管理者向け：既存の予定を更新する。日程・回数上限・対象者を1つのトランザクションで保存する */
examsRouter.put('/admin/exams/:examId/schedules/:scheduleId', requireRole('board'), async (req, res) => {
  const examId = String(req.params.examId);
  const scheduleId = String(req.params.scheduleId);
  if (!/^\d+$/.test(scheduleId)) return res.status(400).json({ error: 'bad schedule id' });
  const parsed = validateScheduleBody(req.body);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE exam_schedules SET label = $3, opens_at = $4, closes_at = $5, max_attempts = $6
        WHERE id = $1 AND exam_id = $2`,
      [scheduleId, examId, parsed.label, parsed.opensAt, parsed.closesAt, parsed.maxAttempts],
    );
    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'schedule not found' });
    }
    await client.query('DELETE FROM exam_schedule_targets WHERE schedule_id = $1', [scheduleId]);
    for (const email of parsed.emails) {
      await client.query(
        'INSERT INTO exam_schedule_targets (schedule_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [scheduleId, email],
      );
    }
    await client.query('COMMIT');
    res.json({
      id: Number(scheduleId),
      label: parsed.label,
      opens_at: parsed.opensAt,
      closes_at: parsed.closesAt,
      max_attempts: parsed.maxAttempts,
      target_emails: parsed.emails,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

/**
 * 管理者向け：予定を削除する。
 * 受験記録(exam_attempts)が1件でも紐づく予定は、受験回数集計・結果公開の基準が
 * 失われるため削除を拒否する。また、最後の1件を削除すると試験がレガシー予定
 * (exams側の古い値)に戻ってしまい分かりにくいため、それも拒否する
 */
examsRouter.delete('/admin/exams/:examId/schedules/:scheduleId', requireRole('board'), async (req, res) => {
  const examId = String(req.params.examId);
  const scheduleId = String(req.params.scheduleId);
  if (!/^\d+$/.test(scheduleId)) return res.status(400).json({ error: 'bad schedule id' });

  const schedule = (
    await pool.query('SELECT id FROM exam_schedules WHERE id = $1 AND exam_id = $2', [scheduleId, examId])
  ).rows[0];
  if (!schedule) return res.status(404).json({ error: 'schedule not found' });

  const { rows: attemptRows } = await pool.query(
    `SELECT count(*) FILTER (WHERE status = 'submitted')   AS submitted,
            count(*) FILTER (WHERE status = 'in_progress') AS in_progress
       FROM exam_attempts WHERE schedule_id = $1`,
    [scheduleId],
  );
  const submitted = Number(attemptRows[0].submitted);
  const inProgress = Number(attemptRows[0].in_progress);
  if (submitted + inProgress > 0) {
    return res.status(409).json({
      error: `この予定には受験記録(提出済み${submitted}件・受験中${inProgress}件)があるため削除できません`,
    });
  }

  const totalCount = (
    await pool.query('SELECT count(*)::int AS n FROM exam_schedules WHERE exam_id = $1', [examId])
  ).rows[0].n;
  if (totalCount <= 1) {
    return res.status(409).json({ error: '最後の1件は削除できません（試験全体を非公開にしてください）' });
  }

  await pool.query('DELETE FROM exam_schedules WHERE id = $1', [scheduleId]);
  res.json({ ok: true });
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
