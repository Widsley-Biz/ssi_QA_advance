-- ============================================================
-- Playwright社内試験のグループ名・試験名の表記を変更する（2026-11-18）
--
--   グループ名「Playwright社内試験」→「Playwright社内試験模擬（座学・実技）」
--   試験名の「模擬筆記」→「座学模擬」（例: 「Playwright社内試験 模擬筆記 セットA」
--     → 「Playwright社内試験 座学模擬 セットA」）
--
-- データの更新のみ（スキーマ変更なし）。何度流しても同じ結果になる
-- （既に置換済みの行は条件に一致しないため再度は変わらない）。
-- ============================================================

UPDATE exams SET group_name = 'Playwright社内試験模擬（座学・実技）'
 WHERE group_name = 'Playwright社内試験';

UPDATE exams SET name = replace(name, '模擬筆記', '座学模擬')
 WHERE name LIKE '%模擬筆記%';

-- 確認用
SELECT id, name, group_name FROM exams
 WHERE group_name = 'Playwright社内試験模擬（座学・実技）'
 ORDER BY sort_order;
