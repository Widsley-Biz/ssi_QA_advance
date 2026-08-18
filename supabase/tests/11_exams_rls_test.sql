\set ON_ERROR_STOP on
\pset pager off
-- 11〜13の再検証。DOブロック内で RESET ROLE を使わない（セッションロールが
-- superuser に戻り RLS がバイパスされてしまうため）。

-- 受講者Aの提出済みattempt idを、Aとして取得しておく
SET ROLE authenticated;
SET test.uid = '11111111-1111-1111-1111-111111111111';
SELECT id AS aid_a FROM exam_attempts WHERE status = 'submitted' ORDER BY id LIMIT 1
\gset
\echo '受講者Aの提出済みattempt_id =' :aid_a
SELECT set_config('test.aid_a', :'aid_a', false) AS "セッション変数に格納";

\echo ''
\echo '=== 11(再). 同チームの別memberが他人の結果を読めないか ==='
SET ROLE authenticated;
SET test.uid = '22222222-2222-2222-2222-222222222222';
SELECT current_user AS "実行ロール", current_setting('test.uid') AS "uid";
SELECT count(*) AS "受講者Bから見えるattempt数_期待0" FROM exam_attempts;
DO $$ BEGIN
  BEGIN
    PERFORM public.get_attempt_result(current_setting('test.aid_a')::bigint);
    RAISE EXCEPTION 'FAIL: 他人の結果を読めてしまった';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%not permitted%' THEN RAISE NOTICE 'OK: 他人の結果は拒否（%）', SQLERRM;
    ELSE RAISE; END IF;
  END;
END $$;

\echo ''
\echo '=== 12(再). リーダーは自チームを見られる / 別チームmemberは見られない ==='
SET ROLE authenticated;
SET test.uid = '33333333-3333-3333-3333-333333333333';
SELECT current_user AS "実行ロール", 'leader/team1' AS who,
       count(*) AS "見えるattempt数_期待1以上" FROM exam_attempts;
DO $$ BEGIN
  BEGIN
    PERFORM public.get_attempt_result(current_setting('test.aid_a')::bigint);
    RAISE NOTICE 'OK: リーダーは自チームの結果を読める';
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'FAIL: リーダーが自チームの結果を読めない（%）', SQLERRM;
  END;
END $$;

SET test.uid = '55555555-5555-5555-5555-555555555555';
SELECT current_user AS "実行ロール", 'member/team2' AS who,
       count(*) AS "見えるattempt数_期待0" FROM exam_attempts;
DO $$
DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM exam_attempts;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: 別チームのmemberに%件見えている', n; END IF;
  BEGIN
    PERFORM public.get_attempt_result(current_setting('test.aid_a')::bigint);
    RAISE EXCEPTION 'FAIL: 別チームのmemberが結果を読めてしまった';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%not permitted%' THEN RAISE NOTICE 'OK: 別チームのmemberは0件・結果も拒否';
    ELSE RAISE; END IF;
  END;
END $$;

\echo ''
\echo '=== 13(再). boardは全件見える / 退職者(retired)は何も見えない ==='
SET ROLE authenticated;
SET test.uid = '44444444-4444-4444-4444-444444444444';
SELECT current_user AS "実行ロール", 'board' AS who,
       (SELECT count(*) FROM exam_questions) AS "exam_questions_期待7",
       (SELECT count(*) FROM exams) AS "exams_期待3",
       (SELECT count(*) FROM exam_attempts) AS "attempts_全件";

-- retired ユーザーを追加して検証
RESET ROLE;
INSERT INTO profiles (id, display_name, email, role, team_id)
VALUES ('66666666-6666-6666-6666-666666666666','退職者','r@widsley.com','retired',1)
ON CONFLICT (id) DO NOTHING;

SET ROLE authenticated;
SET test.uid = '66666666-6666-6666-6666-666666666666';
SELECT current_user AS "実行ロール", 'retired' AS who,
       (SELECT count(*) FROM exam_attempts) AS "attempts_期待0",
       (SELECT count(*) FROM exam_questions) AS "exam_questions_期待0";
DO $$
DECLARE n int; m int; BEGIN
  SELECT count(*) INTO n FROM exam_attempts;
  SELECT count(*) INTO m FROM exam_questions;
  IF n <> 0 OR m <> 0 THEN RAISE EXCEPTION 'FAIL: retiredに見えている（attempts=% questions=%）', n, m; END IF;
  BEGIN
    PERFORM public.start_exam('t-fixed');
    RAISE EXCEPTION 'FAIL: retiredが受験できてしまった';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%not permitted%' THEN RAISE NOTICE 'OK: retiredは閲覧0件・受験も拒否';
    ELSE RAISE; END IF;
  END;
END $$;

\echo ''
\echo '=== 18. 未ログイン(uidなし)で受験できないか ==='
SET ROLE authenticated;
SET test.uid = '';
DO $$ BEGIN
  BEGIN
    PERFORM public.start_exam('t-fixed');
    RAISE EXCEPTION 'FAIL: 未ログインで受験できてしまった';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%not authenticated%' THEN RAISE NOTICE 'OK: 未ログインは拒否（%）', SQLERRM;
    ELSE RAISE; END IF;
  END;
END $$;

\echo ''
\echo '=== 19. 他人のattemptに提出できないか（なりすまし防止）==='
SET test.uid = '22222222-2222-2222-2222-222222222222';
DO $$
DECLARE aid bigint; BEGIN
  aid := (public.start_exam('t-fixed')->>'attempt_id')::bigint;
  -- Bが自分のattemptを作った状態で、Aのattempt(:aid_a)に提出を試みる
  BEGIN
    PERFORM public.submit_exam(current_setting('test.aid_a')::bigint, '{}');
    RAISE EXCEPTION 'FAIL: 他人のattemptに提出できてしまった';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%not permitted%' OR SQLERRM LIKE '%already submitted%'
      THEN RAISE NOTICE 'OK: 他人のattemptへの提出は拒否（%）', SQLERRM;
    ELSE RAISE; END IF;
  END;
END $$;

\echo ''
\echo '########## RLS再検証 完了 ##########'
