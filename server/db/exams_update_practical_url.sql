-- ============================================================
-- 実技模擬の「練習サイトを開く」リンクを新URLに更新する（2026-11-09）
--
--   旧URL https://bookshelf-practice-site.web.app は、紐付いていた
--   GCPプロジェクトが削除リクエスト状態になり利用不可になったため、
--   widsley-skillcheckプロジェクト配下の新URLへ移設済み。
--   DBのguide(jsonb)に残っている旧URLをここで更新する。
--
--   Cloud SQL Studio にこの1本を貼って Run するだけ。
-- ============================================================

UPDATE exams
   SET guide = jsonb_set(
         guide,
         '{links,0,url}',
         '"https://ssi-bookshelf-practice.web.app"'
       )
 WHERE id = 'playwright-mock-practical'
   AND kind = 'practical'
   AND guide #>> '{links,0,url}' = 'https://bookshelf-practice-site.web.app';

-- 更新できたか確認（新URLが出ていれば成功）
SELECT id, guide #>> '{links,0,label}' AS label, guide #>> '{links,0,url}' AS url
  FROM exams
 WHERE id = 'playwright-mock-practical';
