import { Router } from 'express';
import { pool } from '../db.js';
import { requireRole } from '../auth.js';

export const dashboardRouter = Router();

/**
 * 管理者向け：全member/leaderの教材(スライド)閲覧進捗を、試験グループ(group_name)
 * 単位で集計して返す（JSTQB○%・コードリテラシー○%等）。
 * kind='material'の全試験を横断で1回のクエリにまとめる（従来は試験ごとに1回ずつだった）。
 * id/pagesを持たない教材(動画リンク等)は対象外。管理者(role=board)は除外。
 */
dashboardRouter.get('/dashboard/materials-summary', requireRole('board'), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT pr.id AS user_id, e.group_name,
            SUM(COALESCE(array_length(mp.viewed_pages, 1), 0))::int AS viewed_pages,
            SUM((mat->>'pages')::int)::int AS total_pages
       FROM profiles pr
      CROSS JOIN exams e
      CROSS JOIN LATERAL jsonb_array_elements(e.materials) AS mat
       LEFT JOIN material_progress mp
              ON mp.user_id = pr.id AND mp.exam_id = e.id AND mp.material_id = mat->>'id'
      WHERE pr.role NOT IN ('retired', 'board')
        AND e.kind = 'material'
        AND mat ? 'id' AND mat ? 'pages'
      GROUP BY pr.id, e.group_name`,
  );
  res.json(rows);
});

/**
 * 管理者向け：デイリー学習進捗・個人別推移の元データ。
 *   examEvents      … 筆記/実技試験の提出イベント(日付・提出日時はJST)
 *   skillmapEvents  … 旧コース(スキルマップ)の提出イベント(日付・提出日時はJST)
 *   materialDaily   … 教材ページを新しく読んだ日ごとの件数(ユーザー別、日付・最終既読日時はJST)
 *   recordStart     … material_progress_logの最古のレコード日時(無ければnull)。
 *                      これより前の教材閲覧は記録されていないことを示すマーカーに使う
 * 管理者(role=board)・退職者は除外。
 */
dashboardRouter.get('/dashboard/daily-activity', requireRole('board'), async (req, res) => {
  const days = Math.min(Math.max(1, Number(req.query.days) || 90), 365);

  const [examEvents, skillmapEvents, materialDaily, recordStart] = await Promise.all([
    pool.query(
      `SELECT a.user_id, p.display_name, p.team_id,
              (a.submitted_at AT TIME ZONE 'Asia/Tokyo')::date AS day, a.submitted_at,
              e.id AS exam_id, e.name AS exam_name, e.kind, a.passed, a.earned_points
         FROM exam_attempts a
         JOIN exams e ON e.id = a.exam_id
         JOIN profiles p ON p.id = a.user_id
        WHERE a.status = 'submitted'
          AND p.role NOT IN ('retired', 'board')
          AND a.submitted_at >= now() - ($1 || ' days')::interval
        ORDER BY a.submitted_at DESC`,
      [days],
    ),
    pool.query(
      `SELECT ass.user_id, p.display_name, p.team_id,
              (ass.submitted_at AT TIME ZONE 'Asia/Tokyo')::date AS day, ass.submitted_at,
              c.id AS course_id, c.name AS course_name
         FROM assessments ass
         JOIN courses c ON c.id = ass.course_id
         JOIN profiles p ON p.id = ass.user_id
        WHERE p.role NOT IN ('retired', 'board')
          AND ass.submitted_at >= now() - ($1 || ' days')::interval
        ORDER BY ass.submitted_at DESC`,
      [days],
    ),
    pool.query(
      `SELECT l.user_id, (l.viewed_at AT TIME ZONE 'Asia/Tokyo')::date AS day,
              max(l.viewed_at) AS last_viewed_at, count(*)::int AS pages
         FROM material_progress_log l
         JOIN profiles p ON p.id = l.user_id
        WHERE p.role NOT IN ('retired', 'board')
          AND l.viewed_at >= now() - ($1 || ' days')::interval
        GROUP BY l.user_id, day
        ORDER BY day`,
      [days],
    ),
    pool.query(`SELECT min(viewed_at) AS record_start FROM material_progress_log`),
  ]);

  res.json({
    examEvents: examEvents.rows,
    skillmapEvents: skillmapEvents.rows,
    materialDaily: materialDaily.rows,
    recordStart: recordStart.rows[0]?.record_start ?? null,
  });
});
