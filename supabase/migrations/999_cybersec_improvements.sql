-- CyberSec Academy: Mejoras Completas
-- Agrega: career tracks, prerequisites, exercises, resources, badges, labs
-- Autor: Claude Haiku
-- Fecha: 2026-09-11

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Career Tracks (Rutas de aprendizaje predefinidas)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS securities_career_tracks (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  description TEXT,
  recommended_modules INT[] DEFAULT '{}',
  difficulty VARCHAR CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  icon_emoji VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE securities_career_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Career tracks readable by all authenticated users" ON securities_career_tracks
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Module Prerequisites (Dependencias entre módulos)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS securities_module_prerequisites (
  id SERIAL PRIMARY KEY,
  module_id INT NOT NULL,
  prerequisite_module_id INT NOT NULL CHECK (prerequisite_module_id != module_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module_id, prerequisite_module_id)
);

ALTER TABLE securities_module_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prerequisites readable by all authenticated users" ON securities_module_prerequisites
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Practice Exercises (Ejercicios por concepto)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS securities_practice_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id INT NOT NULL,
  concept_id INT NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  difficulty VARCHAR CHECK (difficulty IN ('basic', 'intermediate', 'advanced')),
  code_template TEXT,
  solution TEXT,
  test_cases JSONB DEFAULT '[]'::jsonb,
  expected_output TEXT,
  hints JSONB DEFAULT '[]'::jsonb,
  language VARCHAR DEFAULT 'python',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE securities_practice_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exercises readable by all authenticated users" ON securities_practice_exercises
  FOR SELECT USING (deleted_at IS NULL);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Exercise Submissions (Respuestas del usuario)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS securities_exercise_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  exercise_id UUID NOT NULL REFERENCES securities_practice_exercises(id),
  submitted_code TEXT NOT NULL,
  passed BOOLEAN DEFAULT false,
  score INT CHECK (score >= 0 AND score <= 100),
  feedback TEXT,
  execution_time_ms INT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE securities_exercise_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own submissions" ON securities_exercise_submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can submit exercises" ON securities_exercise_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Resources (Papers, videos, tools, CTFs)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS securities_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id INT NOT NULL,
  module_id INT NOT NULL,
  type VARCHAR NOT NULL CHECK (type IN ('paper', 'video', 'tool', 'ctf', 'book', 'course')),
  title VARCHAR NOT NULL,
  description TEXT,
  url VARCHAR NOT NULL,
  author VARCHAR,
  rating NUMERIC(3,2) CHECK (rating >= 0 AND rating <= 5.0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE securities_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resources readable by all authenticated users" ON securities_resources
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Badges & Achievements
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS securities_badges (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  description TEXT,
  icon_emoji VARCHAR(10),
  trigger_type VARCHAR CHECK (trigger_type IN ('modules_completed', 'track_completed', 'exam_score', 'streak_days', 'exercise_completed')),
  trigger_value INT,
  xp_reward INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE securities_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges readable by all authenticated users" ON securities_badges
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. User Badges (Qué insignias tiene cada usuario)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS securities_user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  badge_id INT NOT NULL REFERENCES securities_badges(id),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE securities_user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own badges" ON securities_user_badges
  FOR SELECT USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Career Track Progress (Progreso del usuario en tracks)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS securities_track_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  track_id INT NOT NULL REFERENCES securities_career_tracks(id),
  modules_completed INT[] DEFAULT '{}',
  progress_percent INT DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  status VARCHAR DEFAULT 'started' CHECK (status IN ('started', 'in_progress', 'completed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, track_id)
);

ALTER TABLE securities_track_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own track progress" ON securities_track_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own track progress" ON securities_track_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert track progress" ON securities_track_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Labs Metadata
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS securities_labs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id INT NOT NULL,
  concept_id INT NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  docker_image VARCHAR,
  docker_tag VARCHAR DEFAULT 'latest',
  time_limit_minutes INT DEFAULT 30,
  difficulty VARCHAR CHECK (difficulty IN ('basic', 'intermediate', 'advanced')),
  objectives TEXT[] DEFAULT '{}',
  hints JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE securities_labs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Labs readable by all authenticated users" ON securities_labs
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. User Lab Sessions
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS securities_lab_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  lab_id UUID NOT NULL REFERENCES securities_labs(id),
  container_id VARCHAR,
  ip_address INET,
  port INT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'completed', 'timeout', 'error')),
  score INT CHECK (score >= 0 AND score <= 100),
  time_spent_minutes INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE securities_lab_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own lab sessions" ON securities_lab_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. Update securities_progress with new columns
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE securities_progress
ADD COLUMN IF NOT EXISTS career_track_id INT REFERENCES securities_career_tracks(id),
ADD COLUMN IF NOT EXISTS badge_ids INT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS streak_days INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_date DATE,
ADD COLUMN IF NOT EXISTS xp_total INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS specialties VARCHAR[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS leaderboard_rank INT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. Indexes for Performance
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_exercises_module ON securities_practice_exercises(module_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exercises_concept ON securities_practice_exercises(concept_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON securities_practice_exercises(difficulty) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_user ON securities_exercise_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_exercise ON securities_exercise_submissions(exercise_id);
CREATE INDEX IF NOT EXISTS idx_submissions_passed ON securities_exercise_submissions(passed);

CREATE INDEX IF NOT EXISTS idx_resources_concept ON securities_resources(concept_id);
CREATE INDEX IF NOT EXISTS idx_resources_module ON securities_resources(module_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON securities_resources(type);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON securities_user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON securities_user_badges(badge_id);

CREATE INDEX IF NOT EXISTS idx_track_progress_user ON securities_track_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_track_progress_track ON securities_track_progress(track_id);

CREATE INDEX IF NOT EXISTS idx_lab_sessions_user ON securities_lab_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_sessions_lab ON securities_lab_sessions(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_sessions_status ON securities_lab_sessions(status) WHERE status = 'active';

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. Comentarios de documentación
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE securities_career_tracks IS 'Rutas de aprendizaje predefinidas (Red Teamer, CISO, Developer Security, etc.)';
COMMENT ON TABLE securities_module_prerequisites IS 'Dependencias entre módulos para mostrar roadmaps';
COMMENT ON TABLE securities_practice_exercises IS 'Ejercicios prácticos por concepto con casos de prueba';
COMMENT ON TABLE securities_exercise_submissions IS 'Respuestas de usuarios a ejercicios';
COMMENT ON TABLE securities_resources IS 'Recursos externos (papers, videos, tools, CTFs, libros)';
COMMENT ON TABLE securities_badges IS 'Definición de insignias desbloqueables';
COMMENT ON TABLE securities_user_badges IS 'Insignias ganadas por cada usuario';
COMMENT ON TABLE securities_track_progress IS 'Progreso de usuario en career tracks';
COMMENT ON TABLE securities_labs IS 'Laboratorios prácticos con Docker';
COMMENT ON TABLE securities_lab_sessions IS 'Sesiones activas de laboratorios por usuario';
