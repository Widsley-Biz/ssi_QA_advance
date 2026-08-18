\set ON_ERROR_STOP on
\pset pager off

-- ============ テストデータ投入（board相当＝superuserで投入）============
INSERT INTO exams (id, name, description, pass_score, time_limit_min, shuffle_questions, is_published, sort_order)
VALUES
  ('t-fixed', '固定順テスト', '順序シャッフルなし', 20, NULL, false, true, 1),
  ('t-shuf',  'シャッフルテスト', '順序シャッフルあり', 20, 90, true, true, 2),
  ('t-draft', '非公開テスト', '未公開', 10, NULL, false, false, 3);

INSERT INTO exam_questions (exam_id, no, category, question, choices, correct_keys, allow_multiple, explanation, points, difficulty) VALUES
  ('t-fixed', 1, 'locator', 'Q1 正しいlocatorはどれか', '{"a":"getByRole","b":"findElement","c":"querySelector","d":"$x"}', '{a}', false, 'Playwrightは getByRole を推奨', 5, 1),
  ('t-fixed', 2, 'git',     'Q2 PRを出す直前のコマンドは', '{"a":"git init","b":"git push","c":"git clone","d":"git rm"}',    '{b}', false, 'ローカルコミット後にpush', 10, 2),
  ('t-fixed', 3, 'AAA',     'Q3 AAAのAssertはどれ',      '{"a":"page.goto","b":"page.click","c":"expect(...)","d":"beforeEach"}', '{c}', false, 'Assert は expect', 15, 3),
  ('t-shuf',  1, 'locator', 'S1', '{"a":"1","b":"2"}', '{a}', false, '', 10, 1),
  ('t-shuf',  2, 'locator', 'S2', '{"a":"1","b":"2"}', '{b}', false, '', 10, 1),
  ('t-shuf',  3, 'locator', 'S3', '{"a":"1","b":"2"}', '{a}', false, '', 10, 1),
  ('t-draft', 1, 'x',       'D1', '{"a":"1","b":"2"}', '{a}', false, '', 10, 1);

\echo '=== 1. CHECK制約: correct_key が choices に無い設問は弾かれるか ==='
DO $$ BEGIN
  BEGIN
    INSERT INTO exam_questions (exam_id, no, question, choices, correct_keys, points)
    VALUES ('t-fixed', 99, 'bad', '{"a":"1","b":"2"}', '{z}', 1);
    RAISE EXCEPTION 'FAIL: correct_keys が choices に無いのに挿入できた';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: CHECK制約が機能（correct_keys={z} を拒否）';
  END;
  BEGIN
    INSERT INTO exam_questions (exam_id, no, question, choices, correct_keys, points)
    VALUES ('t-fixed', 98, 'bad', '["a","b"]', '{a}', 1);
    RAISE EXCEPTION 'FAIL: choices が配列なのに挿入できた';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: CHECK制約が機能（choices は object のみ）';
  END;
END $$;

-- ============ 以降は受講者A（member）として実行 ============
SET ROLE authenticated;
SET test.uid = '11111111-1111-1111-1111-111111111111';

\echo ''
\echo '=== 2. RLS: 受講者は exam_questions を1行も読めないか（正解隠蔽の要）==='
SELECT count(*) AS "exam_questionsの可視行数_期待0" FROM exam_questions;

\echo ''
\echo '=== 3. RLS: 非公開の試験は見えないか ==='
SELECT count(*) AS "見えるexam数_期待2" FROM exams;
SELECT count(*) AS "t-draftの可視行数_期待0" FROM exams WHERE id = 't-draft';

\echo ''
\echo '=== 4. RLS: 受験記録を直接INSERTできないか（点数の偽装防止）==='
DO $$ BEGIN
  BEGIN
    INSERT INTO exam_attempts (user_id, exam_id, status, earned_points, total_points, passed)
    VALUES (auth.uid(), 't-fixed', 'submitted', 999, 999, true);
    RAISE EXCEPTION 'FAIL: 受験記録を直接INSERTできてしまった';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK: 直接INSERTはRLSで拒否された';
  END;
END $$;

\echo ''
\echo '=== 5. start_exam: 正解と解説が返っていないか ==='
DO $$
DECLARE v jsonb; v_txt text; BEGIN
  v := public.start_exam('t-fixed');
  v_txt := v::text;
  IF v_txt LIKE '%correct_key%' OR v_txt LIKE '%correct_keys%' THEN RAISE EXCEPTION 'FAIL: correct_key が漏れている'; END IF;
  IF v_txt LIKE '%explanation%' THEN RAISE EXCEPTION 'FAIL: explanation が漏れている'; END IF;
  IF v_txt LIKE '%getByRole を推奨%' THEN RAISE EXCEPTION 'FAIL: 解説文が漏れている'; END IF;
  IF jsonb_array_length(v->'questions') <> 3 THEN RAISE EXCEPTION 'FAIL: 設問数が3でない'; END IF;
  IF (v->>'total_points')::int <> 30 THEN RAISE EXCEPTION 'FAIL: 満点が30でない（%）', v->>'total_points'; END IF;
  RAISE NOTICE 'OK: 正解・解説は返らず、設問3問・満点30が返った';
  RAISE NOTICE '出題順(no): %', (SELECT string_agg(q->>'no', ',') FROM jsonb_array_elements(v->'questions') q);
END $$;

\echo ''
\echo '=== 6. start_exam の冪等性: 2回呼んでも同じattemptを再利用するか ==='
DO $$
DECLARE a1 bigint; a2 bigint; n int; BEGIN
  a1 := (public.start_exam('t-fixed')->>'attempt_id')::bigint;
  a2 := (public.start_exam('t-fixed')->>'attempt_id')::bigint;
  IF a1 <> a2 THEN RAISE EXCEPTION 'FAIL: attemptが量産された（% vs %）', a1, a2; END IF;
  SELECT count(*) INTO n FROM exam_attempts WHERE user_id = auth.uid() AND exam_id='t-fixed';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: attempt行が%件ある', n; END IF;
  RAISE NOTICE 'OK: 同じattempt_id=%を再利用（行数1）', a1;
END $$;

\echo ''
\echo '=== 7. submit_exam: 傾斜配点の採点と合否判定 ==='
\echo '    Q1(5点)=正解 / Q2(10点)=誤答 / Q3(15点)=正解 → 20点/30点、合格ライン20 → 合格'
DO $$
DECLARE aid bigint; ans jsonb := '{}'; r jsonb; q jsonb; BEGIN
  aid := (public.start_exam('t-fixed')->>'attempt_id')::bigint;
  FOR q IN SELECT * FROM jsonb_array_elements(public.start_exam('t-fixed')->'questions') LOOP
    ans := ans || jsonb_build_object(
      q->>'id',
      jsonb_build_array(CASE q->>'no' WHEN '1' THEN 'a' WHEN '2' THEN 'd' WHEN '3' THEN 'c' END)
    );
  END LOOP;
  r := public.submit_exam(aid, ans);
  RAISE NOTICE '獲得点=% 満点=% 合否=%', r->>'earned_points', r->>'total_points', r->>'passed';
  IF (r->>'earned_points')::int <> 20 THEN RAISE EXCEPTION 'FAIL: 獲得点が20でない'; END IF;
  IF (r->>'total_points')::int <> 30 THEN RAISE EXCEPTION 'FAIL: 満点が30でない'; END IF;
  IF (r->>'passed')::boolean IS NOT true THEN RAISE EXCEPTION 'FAIL: 合格判定にならない（合格ライン20の境界）'; END IF;
  IF r::text NOT LIKE '%correct_key%' THEN RAISE EXCEPTION 'FAIL: 結果に正解が含まれていない'; END IF;
  IF r::text NOT LIKE '%getByRole を推奨%' THEN RAISE EXCEPTION 'FAIL: 結果に解説が含まれていない'; END IF;
  RAISE NOTICE 'OK: 採点20/30・合格・提出後は正解と解説が返る';
  RAISE NOTICE '問別: %', (SELECT string_agg(format('no%s=%s(%s点)', x->>'no', x->>'is_correct', x->>'earned_points'), ' / ' ORDER BY (x->>'no')::int) FROM jsonb_array_elements(r->'results') x);
END $$;

\echo ''
\echo '=== 8. 二重提出が拒否されるか ==='
DO $$
DECLARE aid bigint; BEGIN
  SELECT id INTO aid FROM exam_attempts WHERE user_id=auth.uid() AND exam_id='t-fixed' AND status='submitted' LIMIT 1;
  BEGIN
    PERFORM public.submit_exam(aid, '{}');
    RAISE EXCEPTION 'FAIL: 二重提出できてしまった';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%already submitted%' THEN RAISE NOTICE 'OK: 二重提出を拒否（%）', SQLERRM;
    ELSE RAISE; END IF;
  END;
END $$;

\echo ''
\echo '=== 9. 未回答の扱い（NULL）と0点 ==='
DO $$
DECLARE aid bigint; r jsonb; BEGIN
  aid := (public.start_exam('t-shuf')->>'attempt_id')::bigint;
  r := public.submit_exam(aid, '{}');  -- 全問未回答
  IF (r->>'earned_points')::int <> 0 THEN RAISE EXCEPTION 'FAIL: 未回答で点が入った'; END IF;
  IF (r->>'passed')::boolean IS NOT false THEN RAISE EXCEPTION 'FAIL: 0点で合格になった'; END IF;
  IF jsonb_array_length(r->'results') <> 3 THEN RAISE EXCEPTION 'FAIL: 結果が3問ぶん無い'; END IF;
  IF jsonb_array_length(r->'results'->0->'selected_keys') <> 0 THEN RAISE EXCEPTION 'FAIL: 未回答が空配列でない'; END IF;
  RAISE NOTICE 'OK: 全問未回答→0/30・不合格・selected_keysは空配列';
END $$;

\echo ''
\echo '=== 10. 非公開の試験は受験できないか ==='
DO $$ BEGIN
  BEGIN
    PERFORM public.start_exam('t-draft');
    RAISE EXCEPTION 'FAIL: 非公開の試験を受験できてしまった';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%not published%' THEN RAISE NOTICE 'OK: 非公開の試験は拒否（%）', SQLERRM;
    ELSE RAISE; END IF;
  END;
END $$;

\echo ''
-- 11〜13 は 21_rls_retest.sql に移設（DO内のRESET ROLEでRLSがバイパスされる
-- ハーネスのバグがあったため、ロールを正しく保つ形で作り直した）

\echo '=== 14. シャッフルが効いているか（10回起動して順序が2種類以上出るか）==='
RESET ROLE;
DO $$
DECLARE i int; orders text[] := '{}'; o text; uid uuid; BEGIN
  FOR i IN 1..10 LOOP
    uid := ('99999999-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    INSERT INTO profiles (id, display_name, email, role, team_id)
      VALUES (uid, 'tmp'||i, 'tmp'||i||'@w.com', 'member', 1);
    PERFORM set_config('test.uid', uid::text, true);
    SELECT string_agg(q->>'no', ',') INTO o
      FROM jsonb_array_elements(public.start_exam('t-shuf')->'questions') q;
    orders := array_append(orders, o);
  END LOOP;
  RAISE NOTICE '出題順パターン: %', (SELECT array_agg(DISTINCT x) FROM unnest(orders) x);
  IF (SELECT count(DISTINCT x) FROM unnest(orders) x) < 2 THEN
    RAISE EXCEPTION 'FAIL: shuffle_questions=true なのに順序が1種類だけ';
  END IF;
  RAISE NOTICE 'OK: 順序がシャッフルされている';
END $$;

\echo ''
\echo '=== 15. 固定順(shuffle=false)は毎回 no 昇順か ==='
DO $$
DECLARE i int; o text; uid uuid; BEGIN
  FOR i IN 11..15 LOOP
    uid := ('99999999-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    INSERT INTO profiles (id, display_name, email, role, team_id)
      VALUES (uid, 'tmp'||i, 'tmp'||i||'@w.com', 'member', 1);
    PERFORM set_config('test.uid', uid::text, true);
    SELECT string_agg(q->>'no', ',') INTO o
      FROM jsonb_array_elements(public.start_exam('t-fixed')->'questions') q;
    IF o <> '1,2,3' THEN RAISE EXCEPTION 'FAIL: 固定順のはずが % ', o; END IF;
  END LOOP;
  RAISE NOTICE 'OK: shuffle=false は毎回 1,2,3';
END $$;

\echo ''
\echo '=== 16. 合格ラインを後から変更できるか（20→25にすると先の20点は不合格扱いになる）==='
DO $$
DECLARE v int; BEGIN
  UPDATE exams SET pass_score = 25 WHERE id = 't-fixed';
  SELECT pass_score INTO v FROM exams WHERE id='t-fixed';
  IF v <> 25 THEN RAISE EXCEPTION 'FAIL: 合格ラインを変更できない'; END IF;
  RAISE NOTICE 'OK: pass_score を 20→25 に変更できた（既存の記録は再採点しない仕様）';
  UPDATE exams SET pass_score = 20 WHERE id = 't-fixed';
END $$;

\echo ''
\echo '=== 17. 配点を後から変更できるか ==='
DO $$
DECLARE v int; BEGIN
  UPDATE exam_questions SET points = 20 WHERE exam_id='t-fixed' AND no=3;
  SELECT SUM(points) INTO v FROM exam_questions WHERE exam_id='t-fixed';
  IF v <> 35 THEN RAISE EXCEPTION 'FAIL: 満点が35にならない（%）', v; END IF;
  RAISE NOTICE 'OK: 配点変更で満点が30→35になった';
  UPDATE exam_questions SET points = 15 WHERE exam_id='t-fixed' AND no=3;
END $$;

\echo ''
\echo '=== 20. 複数正解の設問（順序と重複を無視した集合一致で採点）==='
RESET ROLE;
INSERT INTO exams (id, name, pass_score, shuffle_questions, is_published)
VALUES ('t-multi', '複数正解テスト', 10, false, true);
INSERT INTO exam_questions (exam_id, no, category, question, choices, correct_keys, allow_multiple, explanation, points)
VALUES ('t-multi', 1, 'locator', '正しいものを2つ選べ',
        '{"a":"正1","b":"誤1","c":"誤2","d":"正2"}', '{a,d}', true, 'aとdが正解', 10);

-- 正解が2つあるのに allow_multiple=false は弾かれるか
DO $$ BEGIN
  BEGIN
    INSERT INTO exam_questions (exam_id, no, question, choices, correct_keys, allow_multiple, points)
    VALUES ('t-multi', 2, 'bad', '{"a":"1","b":"2"}', '{a,b}', false, 1);
    RAISE EXCEPTION 'FAIL: 複数正解なのに allow_multiple=false で挿入できた';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: 複数正解 + allow_multiple=false は拒否';
  END;
END $$;

SET ROLE authenticated;
SET test.uid = '11111111-1111-1111-1111-111111111111';
DO $$
DECLARE aid bigint; qid text; r jsonb; BEGIN
  -- (1) 順序を逆にしても正解になるか
  aid := (public.start_exam('t-multi')->>'attempt_id')::bigint;
  qid := (public.start_exam('t-multi')->'questions'->0->>'id');
  r := public.submit_exam(aid, jsonb_build_object(qid, jsonb_build_array('d','a')));
  IF (r->>'earned_points')::int <> 10 THEN RAISE EXCEPTION 'FAIL: 順序違いで不正解になった'; END IF;
  RAISE NOTICE 'OK: ["d","a"] は ["a","d"] と同じ正解扱い（10点）';
  IF (r->'results'->0->'allow_multiple')::boolean IS NOT true THEN RAISE EXCEPTION 'FAIL: allow_multipleが返らない'; END IF;
END $$;

SET test.uid = '22222222-2222-2222-2222-222222222222';
DO $$
DECLARE aid bigint; qid text; r jsonb; BEGIN
  -- (2) 片方だけ選んだら不正解（部分点は与えない）
  aid := (public.start_exam('t-multi')->>'attempt_id')::bigint;
  qid := (public.start_exam('t-multi')->'questions'->0->>'id');
  r := public.submit_exam(aid, jsonb_build_object(qid, jsonb_build_array('a')));
  IF (r->>'earned_points')::int <> 0 THEN RAISE EXCEPTION 'FAIL: 片方だけで点が入った'; END IF;
  RAISE NOTICE 'OK: 片方だけ（["a"]）は不正解・部分点なし';
END $$;

SET test.uid = '33333333-3333-3333-3333-333333333333';
DO $$
DECLARE aid bigint; qid text; r jsonb; BEGIN
  -- (3) 余分に選んだら不正解 / 重複指定は無視される
  aid := (public.start_exam('t-multi')->>'attempt_id')::bigint;
  qid := (public.start_exam('t-multi')->'questions'->0->>'id');
  r := public.submit_exam(aid, jsonb_build_object(qid, jsonb_build_array('a','d','b')));
  IF (r->>'earned_points')::int <> 0 THEN RAISE EXCEPTION 'FAIL: 余分に選んでも正解になった'; END IF;
  RAISE NOTICE 'OK: 余分に選んだ（["a","d","b"]）は不正解';
END $$;

SET test.uid = '44444444-4444-4444-4444-444444444444';
DO $$
DECLARE aid bigint; qid text; r jsonb; BEGIN
  aid := (public.start_exam('t-multi')->>'attempt_id')::bigint;
  qid := (public.start_exam('t-multi')->'questions'->0->>'id');
  r := public.submit_exam(aid, jsonb_build_object(qid, jsonb_build_array('d','a','d')));
  IF (r->>'earned_points')::int <> 10 THEN RAISE EXCEPTION 'FAIL: 重複指定で不正解になった'; END IF;
  RAISE NOTICE 'OK: 重複指定（["d","a","d"]）は重複を無視して正解';
END $$;

\echo ''
\echo '=== 21. 単一正解の設問に文字列形式で回答しても採点されるか（後方互換）==='
SET test.uid = '55555555-5555-5555-5555-555555555555';
DO $$
DECLARE aid bigint; ans jsonb := '{}'; r jsonb; q jsonb; BEGIN
  aid := (public.start_exam('t-fixed')->>'attempt_id')::bigint;
  FOR q IN SELECT * FROM jsonb_array_elements(public.start_exam('t-fixed')->'questions') LOOP
    ans := ans || jsonb_build_object(q->>'id',
      to_jsonb(CASE q->>'no' WHEN '1' THEN 'a' WHEN '2' THEN 'b' WHEN '3' THEN 'c' END));
  END LOOP;
  r := public.submit_exam(aid, ans);
  IF (r->>'earned_points')::int <> 30 THEN RAISE EXCEPTION 'FAIL: 文字列形式が採点されない（%点）', r->>'earned_points'; END IF;
  RAISE NOTICE 'OK: 文字列形式でも全問正解30点として採点された';
END $$;

\echo ''
\echo '########## 20_test.sql 全項目パス ##########'
