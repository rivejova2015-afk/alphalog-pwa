-- CyberSec Academy: Data Inicial
-- Inserta: Career Tracks, Badges, Prerequisites
-- Ejecutar DESPUÉS de 999_cybersec_improvements.sql

-- ═══════════════════════════════════════════════════════════════════════════
-- CAREER TRACKS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO securities_career_tracks (name, description, recommended_modules, difficulty, icon_emoji) VALUES
('Red Teamer Path', 'Especialización en pentesting, seguridad ofensiva y explotación',
 ARRAY[1, 10, 25, 30, 35, 70, 75], 'advanced', '🔴'),

('CISO Track', 'Gestión de riesgos, cumplimiento normativo, liderazgo de seguridad',
 ARRAY[50, 80, 85, 86], 'intermediate', '👑'),

('Developer Security', 'Secure coding, OWASP Top 10, criptografía para desarrolladores',
 ARRAY[5, 15, 40, 45, 55, 60], 'intermediate', '🛡️'),

('Cloud Security Specialist', 'Seguridad en AWS, Azure, GCP, container security',
 ARRAY[20, 55, 65, 72], 'intermediate', '☁️'),

('Threat Intelligence Analyst', 'APT, malware analysis, threat hunting, inteligencia',
 ARRAY[1, 10, 30, 45, 78, 84], 'advanced', '🕵️'),

('Incident Response Master', 'Forensics, IR, threat hunting, post-breach recovery',
 ARRAY[10, 30, 45, 70, 76, 82], 'advanced', '🚨'),

('Security Architect', 'Diseño de arquitecturas seguras, zero trust, defense in depth',
 ARRAY[50, 55, 60, 65, 80, 85], 'advanced', '🏗️')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- BADGES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO securities_badges (name, description, icon_emoji, trigger_type, trigger_value, xp_reward) VALUES
('Novice Scholar', 'Completaste 5 módulos', '🎓', 'modules_completed', 5, 50),
('Intermediate Scholar', 'Completaste 20 módulos', '📚', 'modules_completed', 20, 150),
('Advanced Scholar', 'Completaste 50 módulos', '🏆', 'modules_completed', 50, 300),
('Completist', 'Completaste todos los 86 módulos', '✨', 'modules_completed', 86, 500),

('Red Teamer Certified', 'Completaste el Red Teamer Path', '🔴', 'track_completed', 1, 200),
('CISO Ready', 'Completaste el CISO Track', '👑', 'track_completed', 2, 200),
('Developer Guardian', 'Completaste Developer Security', '🛡️', 'track_completed', 3, 200),
('Cloud Guardian', 'Completaste Cloud Security', '☁️', 'track_completed', 4, 200),

('Exam Master', 'Final exam con 90%+', 'exam_score', 90, 250),
('Exam Expert', 'Final exam con 100%', 'exam_score', 100, 500),

('On Fire 🔥', '7 días estudiando sin parar', '🔥', 'streak_days', 7, 100),
('Unstoppable', '30 días streak', '⚡', 'streak_days', 30, 300),

('Exercise Champion', 'Completaste 10 ejercicios', '💪', 'exercise_completed', 10, 100),
('Exercise Master', 'Completaste 50 ejercicios', '🥇', 'exercise_completed', 50, 300)
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- MODULE PREREQUISITES (Dependencias clave)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO securities_module_prerequisites (module_id, prerequisite_module_id) VALUES
-- M50 (Risk Management) requiere foundation
(50, 1), (50, 10),

-- M70+ son avanzados, requieren foundation + intermediate
(70, 1), (70, 10), (70, 25),
(75, 70), (75, 30), (75, 40),
(80, 50), (80, 1),

-- M85-86 (Risk + Compliance) requieren comprehensive foundation
(85, 1), (85, 10), (85, 50),
(86, 85), (86, 50), (86, 80),

-- M60+ (Cloud) requieren dev foundation
(65, 5), (65, 15), (65, 20),
(72, 65), (72, 40),

-- M78 (Threat Intel) requiere reversing y analysis
(78, 10), (78, 25), (78, 30),
(84, 78)
ON CONFLICT (module_id, prerequisite_module_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación: confirmar que se insertó correctamente
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT
--   (SELECT COUNT(*) FROM securities_career_tracks) as tracks,
--   (SELECT COUNT(*) FROM securities_badges) as badges,
--   (SELECT COUNT(*) FROM securities_module_prerequisites) as prerequisites;
