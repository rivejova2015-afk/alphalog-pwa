-- AlphaLog Securities — CyberSec Academy
-- Persists user progress for the CyberSec academy:
--   * securities_progress              one row per (user, module) — current state
--   * securities_quiz_results          history of quiz attempts per lesson
--   * securities_homework_submissions  one row per (user, homework) — soft-deletable
--   * securities_exam_results          history of full-exam attempts (passing >= 70%)
-- Static content (modules, lessons, quizzes, practice, homework, exam questions) lives
-- in src/lib/securities/cybersec/* — these tables only track per-user state.

-- ────────────────────────────────────────────────────────────
-- securities_progress
-- ────────────────────────────────────────────────────────────
CREATE TABLE securities_progress (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  module_id         int         NOT NULL,
  status            text        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('locked','active','completed')),
  completed_levels  text[]      NOT NULL DEFAULT '{}',   -- subset of {'b','i','a'}
  research_done     boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);

ALTER TABLE securities_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_securities_progress"
  ON securities_progress FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_securities_progress_user
  ON securities_progress (user_id);

-- ────────────────────────────────────────────────────────────
-- securities_quiz_results
-- ────────────────────────────────────────────────────────────
CREATE TABLE securities_quiz_results (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  lesson_id   int         NOT NULL,
  score       int         NOT NULL,
  total       int         NOT NULL,
  answers     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  taken_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE securities_quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_securities_quiz_results"
  ON securities_quiz_results FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_securities_quiz_results_user_lesson
  ON securities_quiz_results (user_id, lesson_id, taken_at DESC);

-- ────────────────────────────────────────────────────────────
-- securities_homework_submissions
-- ────────────────────────────────────────────────────────────
CREATE TABLE securities_homework_submissions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  homework_id     int         NOT NULL,
  content         text,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','submitted','graded')),
  points          int,
  submitted_at    timestamptz,
  graded_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE (user_id, homework_id)
);

ALTER TABLE securities_homework_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_securities_homework_submissions"
  ON securities_homework_submissions FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_securities_homework_user
  ON securities_homework_submissions (user_id)
  WHERE deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- securities_exam_results
-- ────────────────────────────────────────────────────────────
CREATE TABLE securities_exam_results (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  attempt_no   int         NOT NULL,
  score        int         NOT NULL,
  total        int         NOT NULL,
  answers      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  passed       boolean     GENERATED ALWAYS AS
                           ((score::float / NULLIF(total, 0)) >= 0.7) STORED,
  taken_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE securities_exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_securities_exam_results"
  ON securities_exam_results FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_securities_exam_user_taken
  ON securities_exam_results (user_id, taken_at DESC);
