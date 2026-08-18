-- ============================================================
-- 010_exams.sql  –  模擬試験(筆記)機能
-- ============================================================
-- 2026-08-18 追加
--
-- 【背景】
--   模擬筆記試験をAircourseからSkillCheckへ移管する。Aircourseのオリジナル
--   コースは無料枠が1ヶ月分のみで、毎月コピー+受講者招待の手作業が発生していた。
--   本番の社内認定試験は当面Aircourseのまま。ここに載せるのは模擬のみ。
--
-- 【設計方針】
--   1. 汎用の試験機能にする(将来JSTQB対策なども載せる)
--   2. 傾斜配点。配点・合格ライン・時間制限・シャッフル可否はすべてデータ側に
--      持たせ、後からSQL 1行で調整できるようにする
--   3. 全問回答後に一括採点
--   4. 回答前に正解が見えないこと。SkillCheckはサーバーサイドを持たない静的SPA
--      なので、exam_questions を authenticated から直接読めないようにし、
--      出題と採点を SECURITY DEFINER の RPC 経由に限定する
--   5. 受験記録はクライアントから直接書き込めないようにする(点数の偽装防止)。
--      exam_attempts / exam_attempt_answers への INSERT/UPDATE は board のみに
--      許可し、通常の書き込みは RPC(RLSをバイパスする)だけが行う
-- ============================================================


-- ------------------------------------------------------------
-- ヘルパー
-- ------------------------------------------------------------

-- text配列を昇順に正規化する。選択肢の集合比較（順序を問わない一致判定）に使う
CREATE OR REPLACE FUNCTION public.sorted_text_array(arr text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  -- 空配列に array_agg を掛けると NULL が返るため COALESCE で空配列に戻す。
  -- これをしないと「全問未回答」のときに正誤判定が NULL になり採点に失敗する。
  SELECT CASE WHEN arr IS NULL THEN NULL
              ELSE COALESCE(
                     (SELECT array_agg(x ORDER BY x) FROM unnest(arr) AS x),
                     '{}'::text[]
                   )
         END;
$$;


-- ------------------------------------------------------------
-- テーブル
-- ------------------------------------------------------------

-- 試験マスタ
CREATE TABLE exams (
  id text PRIMARY KEY,                                  -- 例: 'playwright-mock-written'
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  course_id text REFERENCES courses(id),                -- NULL可(コースに紐づかない試験もある)
  pass_score int NOT NULL,                              -- 合格点(素点)。後から変更可
  time_limit_min int,                                   -- NULL = 制限なし
  shuffle_questions boolean NOT NULL DEFAULT true,       -- 出題順をシャッフルするか
  is_published boolean NOT NULL DEFAULT false,          -- false の間は board 以外に見えない
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 設問
--   choices は {"a":"選択肢A","b":"選択肢B",...} のオブジェクト。
--   キーの昇順が表示順になる(a,b,c,d)。
--   correct_keys は正解キーの配列。複数正解の設問があるため配列で持つ
--   (実際にAircourseの移行元データに「A;D」の2択正解が存在した)。
--   correct_keys の全要素が choices のキーに存在することを CHECK で保証している
--   (SQL直投入で問題を追加するため、採点不能な設問が混入しないようにする)。
CREATE TABLE exam_questions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exam_id text NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  no int NOT NULL,                                      -- 表示番号(シャッフル前の並び)
  category text NOT NULL DEFAULT '',                    -- 例: 'locator' 'Git' 'AAA' 'POM'
  question text NOT NULL,                               -- HTML。コードブロックを含む
  choices jsonb NOT NULL,
  correct_keys text[] NOT NULL,
  allow_multiple boolean NOT NULL DEFAULT false,         -- true ならUIはチェックボックス
  explanation text NOT NULL DEFAULT '',                 -- HTML
  points int NOT NULL DEFAULT 1 CHECK (points > 0),     -- 傾斜配点
  difficulty int,                                       -- 1..3 想定。表示用
  UNIQUE (exam_id, no),
  CONSTRAINT exam_questions_choices_is_object
    CHECK (jsonb_typeof(choices) = 'object'),
  CONSTRAINT exam_questions_correct_keys_not_empty
    CHECK (array_length(correct_keys, 1) >= 1),
  CONSTRAINT exam_questions_correct_keys_in_choices
    CHECK (choices ?& correct_keys),
  -- 正解が2つ以上あるなら複数選択を許可していなければ回答不能になる
  CONSTRAINT exam_questions_multiple_consistent
    CHECK (array_length(correct_keys, 1) = 1 OR allow_multiple)
);

-- 受験記録
--   既存の assessments は status が 'submitted' のみだが、試験は「受験中」の
--   状態が必要なため in_progress を持たせている(意図的な差分)。
CREATE TABLE exam_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_id text NOT NULL REFERENCES exams(id),
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted')),
  question_ids bigint[] NOT NULL DEFAULT '{}',          -- 出題した設問と順序。将来のランダム抽出にも対応
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  earned_points int,
  total_points int,
  passed boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 各設問への回答と正誤
CREATE TABLE exam_attempt_answers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id bigint NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id bigint NOT NULL REFERENCES exam_questions(id),
  selected_keys text[],                                 -- NULL または空配列 = 未回答
  is_correct boolean NOT NULL,
  earned_points int NOT NULL,
  UNIQUE (attempt_id, question_id)
);

-- インデックス
CREATE INDEX idx_exam_questions_exam ON exam_questions(exam_id, no);
CREATE INDEX idx_exam_attempts_user ON exam_attempts(user_id, exam_id);
CREATE INDEX idx_exam_attempt_answers_attempt ON exam_attempt_answers(attempt_id);


-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

-- exams : 公開中のものは全認証ユーザーが read、board は全件read + write
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exams_select" ON exams
  FOR SELECT TO authenticated
  USING (is_published OR public.current_user_role() = 'board');

CREATE POLICY "exams_insert" ON exams
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "exams_update" ON exams
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'board')
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "exams_delete" ON exams
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'board');


-- exam_questions : board のみ。受験者には1行も見せない
--   ★これが正解隠蔽の要。受験者は start_exam / submit_exam / get_attempt_result
--     の3つのRPC経由でしか設問に触れられない
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_questions_select" ON exam_questions
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'board');

CREATE POLICY "exam_questions_insert" ON exam_questions
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "exam_questions_update" ON exam_questions
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'board')
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "exam_questions_delete" ON exam_questions
  FOR DELETE TO authenticated
  USING (public.current_user_role() = 'board');


-- exam_attempts
--   read : member=自分 / leader=自チーム / board=全件 / retired=不可
--   write: board のみ(通常の書き込みは SECURITY DEFINER の RPC が行う)
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_attempts_select" ON exam_attempts
  FOR SELECT TO authenticated
  USING (
    CASE public.current_user_role()
      WHEN 'board' THEN true
      WHEN 'leader' THEN
        user_id IN (
          SELECT id FROM profiles WHERE team_id = public.current_user_team_id()
        )
      WHEN 'member' THEN user_id = auth.uid()
      ELSE false
    END
  );

CREATE POLICY "exam_attempts_insert" ON exam_attempts
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "exam_attempts_update" ON exam_attempts
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'board')
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "exam_attempts_delete" ON exam_attempts
  FOR DELETE TO authenticated
  USING (
    CASE public.current_user_role()
      WHEN 'board' THEN true
      WHEN 'leader' THEN
        user_id IN (
          SELECT id FROM profiles WHERE team_id = public.current_user_team_id()
        )
      ELSE false
    END
  );


-- exam_attempt_answers : 親(exam_attempts)の所有権で判定
ALTER TABLE exam_attempt_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_attempt_answers_select" ON exam_attempt_answers
  FOR SELECT TO authenticated
  USING (
    CASE public.current_user_role()
      WHEN 'board' THEN true
      WHEN 'leader' THEN
        attempt_id IN (
          SELECT a.id FROM exam_attempts a
          JOIN profiles p ON p.id = a.user_id
          WHERE p.team_id = public.current_user_team_id()
        )
      WHEN 'member' THEN
        attempt_id IN (
          SELECT id FROM exam_attempts WHERE user_id = auth.uid()
        )
      ELSE false
    END
  );

CREATE POLICY "exam_attempt_answers_insert" ON exam_attempt_answers
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "exam_attempt_answers_update" ON exam_attempt_answers
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'board')
  WITH CHECK (public.current_user_role() = 'board');

CREATE POLICY "exam_attempt_answers_delete" ON exam_attempt_answers
  FOR DELETE TO authenticated
  USING (
    CASE public.current_user_role()
      WHEN 'board' THEN true
      WHEN 'leader' THEN
        attempt_id IN (
          SELECT a.id FROM exam_attempts a
          JOIN profiles p ON p.id = a.user_id
          WHERE p.team_id = public.current_user_team_id()
        )
      ELSE false
    END
  );


-- ------------------------------------------------------------
-- RPC
-- ------------------------------------------------------------

-- 受験開始
--   attempt を作成し、正解と解説を除いた設問リストを返す。
--   同じ試験の未提出 attempt が残っている場合はそれを再利用する
--   (リロードで受験記録が量産されないようにする)。
CREATE OR REPLACE FUNCTION public.start_exam(p_exam_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_role      text := public.current_user_role();
  v_exam      exams;
  v_attempt   exam_attempts;
  v_ids       bigint[];
  v_questions jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF v_role IS NULL OR v_role = 'retired' THEN
    RAISE EXCEPTION 'not permitted';
  END IF;

  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id;
  IF v_exam.id IS NULL THEN
    RAISE EXCEPTION 'exam not found: %', p_exam_id;
  END IF;
  IF NOT v_exam.is_published AND v_role <> 'board' THEN
    RAISE EXCEPTION 'exam not published: %', p_exam_id;
  END IF;

  -- 未提出の attempt があれば再利用
  SELECT * INTO v_attempt
  FROM exam_attempts
  WHERE user_id = v_uid AND exam_id = p_exam_id AND status = 'in_progress'
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_attempt.id IS NULL THEN
    SELECT array_agg(q.id ORDER BY
             CASE WHEN v_exam.shuffle_questions THEN NULL ELSE q.no END,
             CASE WHEN v_exam.shuffle_questions THEN random() ELSE NULL END)
      INTO v_ids
    FROM exam_questions q
    WHERE q.exam_id = p_exam_id;

    IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
      RAISE EXCEPTION 'exam has no questions: %', p_exam_id;
    END IF;

    INSERT INTO exam_attempts (user_id, exam_id, question_ids)
    VALUES (v_uid, p_exam_id, v_ids)
    RETURNING * INTO v_attempt;
  END IF;

  -- 出題(正解・解説は返さない)
  SELECT jsonb_agg(
           jsonb_build_object(
             'id', q.id,
             'no', q.no,
             'category', q.category,
             'question', q.question,
             'choices', q.choices,
             'allow_multiple', q.allow_multiple,
             'points', q.points,
             'difficulty', q.difficulty
           )
           ORDER BY ord.idx
         )
    INTO v_questions
  FROM unnest(v_attempt.question_ids) WITH ORDINALITY AS ord(qid, idx)
  JOIN exam_questions q ON q.id = ord.qid;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'exam', jsonb_build_object(
      'id', v_exam.id,
      'name', v_exam.name,
      'description', v_exam.description,
      'pass_score', v_exam.pass_score,
      'time_limit_min', v_exam.time_limit_min
    ),
    'total_points', (SELECT COALESCE(SUM(points), 0) FROM exam_questions WHERE exam_id = p_exam_id),
    'started_at', v_attempt.started_at,
    'questions', COALESCE(v_questions, '[]'::jsonb)
  );
END;
$$;


-- 採点結果を返す共通処理(提出済み attempt 用)
CREATE OR REPLACE FUNCTION public.get_attempt_result(p_attempt_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_role    text := public.current_user_role();
  v_attempt exam_attempts;
  v_exam    exams;
  v_results jsonb;
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_attempt FROM exam_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'attempt not found: %', p_attempt_id;
  END IF;

  -- 参照権限は RLS と同じ規則(自分 / 自チーム / board)
  v_allowed := CASE v_role
    WHEN 'board' THEN true
    WHEN 'leader' THEN EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = v_attempt.user_id AND p.team_id = public.current_user_team_id()
    )
    WHEN 'member' THEN v_attempt.user_id = v_uid
    ELSE false
  END;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'not permitted';
  END IF;

  IF v_attempt.status <> 'submitted' THEN
    RAISE EXCEPTION 'attempt not submitted yet: %', p_attempt_id;
  END IF;

  SELECT * INTO v_exam FROM exams WHERE id = v_attempt.exam_id;

  SELECT jsonb_agg(
           jsonb_build_object(
             'question_id', q.id,
             'no', q.no,
             'category', q.category,
             'question', q.question,
             'choices', q.choices,
             'allow_multiple', q.allow_multiple,
             'points', q.points,
             'selected_keys', COALESCE(aa.selected_keys, '{}'),
             'correct_keys', q.correct_keys,
             'is_correct', aa.is_correct,
             'earned_points', aa.earned_points,
             'explanation', q.explanation
           )
           ORDER BY ord.idx
         )
    INTO v_results
  FROM unnest(v_attempt.question_ids) WITH ORDINALITY AS ord(qid, idx)
  JOIN exam_questions q ON q.id = ord.qid
  LEFT JOIN exam_attempt_answers aa
         ON aa.attempt_id = v_attempt.id AND aa.question_id = q.id;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'exam', jsonb_build_object(
      'id', v_exam.id,
      'name', v_exam.name,
      'pass_score', v_exam.pass_score
    ),
    'earned_points', v_attempt.earned_points,
    'total_points', v_attempt.total_points,
    'passed', v_attempt.passed,
    'submitted_at', v_attempt.submitted_at,
    'results', COALESCE(v_results, '[]'::jsonb)
  );
END;
$$;


-- 提出・採点
--   p_answers は {"<question_id>": "<selected_key>", ...}
--   未回答の設問はキーを含めないか null を入れる。
--   採点はサーバー側で行い、クライアントから点数を渡させない。
CREATE OR REPLACE FUNCTION public.submit_exam(p_attempt_id bigint, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_attempt exam_attempts;
  v_exam    exams;
  v_earned  int;
  v_total   int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_attempt FROM exam_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'attempt not found: %', p_attempt_id;
  END IF;
  IF v_attempt.user_id <> v_uid THEN
    RAISE EXCEPTION 'not permitted';
  END IF;
  IF v_attempt.status = 'submitted' THEN
    RAISE EXCEPTION 'already submitted: %', p_attempt_id;
  END IF;

  SELECT * INTO v_exam FROM exams WHERE id = v_attempt.exam_id;

  -- 採点して回答を記録
  --   p_answers の各値は ["a"] / ["a","d"] の配列を想定する。
  --   後方互換で "a" のような文字列も受け付ける。
  --   正誤は「選んだ集合と正解集合が完全一致するか」で判定する（順序と重複は無視）。
  WITH served AS (
    SELECT
      q.id, q.correct_keys, q.points,
      CASE
        WHEN jsonb_typeof(p_answers -> q.id::text) = 'array'
          THEN ARRAY(SELECT DISTINCT jsonb_array_elements_text(p_answers -> q.id::text))
        WHEN COALESCE(p_answers ->> q.id::text, '') <> ''
          THEN ARRAY[p_answers ->> q.id::text]
        ELSE '{}'::text[]
      END AS sel
    FROM unnest(v_attempt.question_ids) AS t(qid)
    JOIN exam_questions q ON q.id = t.qid
  )
  INSERT INTO exam_attempt_answers (attempt_id, question_id, selected_keys, is_correct, earned_points)
  SELECT
    v_attempt.id,
    s.id,
    NULLIF(s.sel, '{}'::text[]),
    public.sorted_text_array(s.sel) = public.sorted_text_array(s.correct_keys),
    CASE WHEN public.sorted_text_array(s.sel) = public.sorted_text_array(s.correct_keys)
         THEN s.points ELSE 0 END
  FROM served s;

  SELECT COALESCE(SUM(earned_points), 0) INTO v_earned
  FROM exam_attempt_answers WHERE attempt_id = v_attempt.id;

  SELECT COALESCE(SUM(q.points), 0) INTO v_total
  FROM unnest(v_attempt.question_ids) AS t(qid)
  JOIN exam_questions q ON q.id = t.qid;

  UPDATE exam_attempts
     SET status = 'submitted',
         submitted_at = now(),
         earned_points = v_earned,
         total_points = v_total,
         passed = (v_earned >= v_exam.pass_score)
   WHERE id = v_attempt.id;

  RETURN public.get_attempt_result(v_attempt.id);
END;
$$;


-- 実行権限。テーブルへの直接書き込みは与えず、この3本だけを公開する
REVOKE ALL ON FUNCTION public.start_exam(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_exam(bigint, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_attempt_result(bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.start_exam(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_exam(bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attempt_result(bigint) TO authenticated;
