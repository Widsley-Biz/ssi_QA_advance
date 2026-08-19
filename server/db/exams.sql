-- ============================================================
-- exams.sql  –  模擬試験（筆記）
-- ============================================================
-- 2026-08-19 追加。schema.sql への追加分（既存テーブルは変更しない）。
--
-- 【背景】
--   模擬筆記試験をAirCourseからSkillCheckへ移管する。AirCourseのオリジナル
--   コースは無料枠が1ヶ月分のみで、毎月コピー＋受講者招待の手作業が発生していた。
--   本番の社内認定試験は当面AirCourseのまま。ここに載せるのは模擬のみ。
--
-- 【設計方針】
--   1. 汎用の試験機能にする（将来JSTQB対策なども載せる）
--   2. 傾斜配点。配点・合格ライン・時間制限・シャッフル可否はすべてデータ側に
--      持たせ、後からSQL 1行で調整できるようにする
--   3. 全問回答後に一括採点
--   4. 正解（correct_keys）と解説（explanation）は、出題時に
--      **サーバー側で必ず落としてから**クライアントへ返すこと。
--      採点も server/src/routes/exams.ts で行い、点数をクライアントから
--      受け取らない。これが「回答前に正解が見えない」ことの担保になる
--   5. 認可は他のルートと同じ方式（req.profile の role で board / leader /
--      member をSQLのWHERE句で出し分ける）。DB側のRLSには依存しない
-- ============================================================


-- 試験マスタ
CREATE TABLE exams (
  id text PRIMARY KEY,                                  -- 例: 'playwright-mock-written-a'
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  course_id text REFERENCES courses(id),                -- NULL可（コースに紐づかない試験もある）
  group_name text NOT NULL DEFAULT '',                  -- ジャンル。一覧をこの単位でまとめる
  pass_score int NOT NULL,                              -- 合格点（素点）。後から変更可
  time_limit_min int,                                   -- NULL = 制限なし
  shuffle_questions boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT false,          -- false の間は board 以外に出さない
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 設問
--   choices は {"a":"選択肢A","b":"選択肢B",...} のオブジェクト。
--   キーの昇順が表示順になる（a,b,c,d）。
--   correct_keys は正解キーの配列。複数正解の設問が実在するため配列で持つ
--   （移行元のAirCourseデータに「A;D」の2択正解があった）。
CREATE TABLE exam_questions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exam_id text NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  no int NOT NULL,                                      -- 表示番号（シャッフル前の並び）
  category text NOT NULL DEFAULT '',                    -- 'locator' 'Git' 'AAA' 'POM' など
  question text NOT NULL,                               -- HTML。コードブロックを含む
  choices jsonb NOT NULL,
  correct_keys text[] NOT NULL,
  allow_multiple boolean NOT NULL DEFAULT false,        -- true ならUIはチェックボックス
  explanation text NOT NULL DEFAULT '',                 -- HTML
  points int NOT NULL DEFAULT 1 CHECK (points > 0),     -- 傾斜配点
  difficulty int,
  UNIQUE (exam_id, no),
  CONSTRAINT exam_questions_choices_is_object
    CHECK (jsonb_typeof(choices) = 'object'),
  CONSTRAINT exam_questions_correct_keys_not_empty
    CHECK (array_length(correct_keys, 1) >= 1),
  CONSTRAINT exam_questions_correct_keys_in_choices
    CHECK (choices ?& correct_keys),
  -- 正解が2つ以上あるなら複数選択を許可していないと回答不能になる
  CONSTRAINT exam_questions_multiple_consistent
    CHECK (array_length(correct_keys, 1) = 1 OR allow_multiple)
);

-- 受験記録
--   既存の assessments は status が 'submitted' のみだが、試験は「受験中」の
--   状態が必要なため in_progress を持たせている（意図的な差分）。
CREATE TABLE exam_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_id text NOT NULL REFERENCES exams(id),
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted')),
  question_ids bigint[] NOT NULL DEFAULT '{}',          -- 出題した設問と順序
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

CREATE INDEX idx_exams_group ON exams(group_name, sort_order);
CREATE INDEX idx_exam_questions_exam ON exam_questions(exam_id, no);
CREATE INDEX idx_exam_attempts_user ON exam_attempts(user_id, exam_id);
CREATE INDEX idx_exam_attempt_answers_attempt ON exam_attempt_answers(attempt_id);


-- ------------------------------------------------------------
-- 採点用ヘルパー
-- ------------------------------------------------------------
-- text配列を昇順に正規化する。選択肢の集合比較（順序と重複を無視した一致判定）に使う。
-- 空配列に array_agg を掛けると NULL が返るため COALESCE で空配列に戻している。
-- これをしないと「全問未回答」のときに正誤判定が NULL になり採点に失敗する。
CREATE OR REPLACE FUNCTION sorted_text_array(arr text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN arr IS NULL THEN NULL
              ELSE COALESCE(
                     (SELECT array_agg(x ORDER BY x) FROM unnest(arr) AS x),
                     '{}'::text[]
                   )
         END;
$$;
