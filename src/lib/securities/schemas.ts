import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// Career Tracks
// ═══════════════════════════════════════════════════════════════════════════

export const careerTrackSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  recommended_modules: z.array(z.number().int().positive()).default([]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  icon_emoji: z.string().max(10).optional(),
  created_at: z.date().or(z.string()),
  updated_at: z.date().or(z.string()),
});

export type CareerTrack = z.infer<typeof careerTrackSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Practice Exercises
// ═══════════════════════════════════════════════════════════════════════════

export const practiceExerciseSchema = z.object({
  id: z.string().uuid().optional(),
  module_id: z.number().int().positive(),
  concept_id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  difficulty: z.enum(["basic", "intermediate", "advanced"]),
  code_template: z.string().optional(),
  solution: z.string().optional(),
  test_cases: z.array(z.record(z.any())).default([]),
  expected_output: z.string().optional(),
  hints: z.array(z.string()).default([]),
  language: z.string().default("python"),
  created_at: z.date().or(z.string()).optional(),
  updated_at: z.date().or(z.string()).optional(),
  deleted_at: z.date().or(z.string()).nullable().optional(),
});

export type PracticeExercise = z.infer<typeof practiceExerciseSchema>;

export const exerciseSubmissionSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  submitted_code: z.string().min(1),
  passed: z.boolean().default(false),
  score: z.number().int().min(0).max(100).optional(),
  feedback: z.string().optional(),
  execution_time_ms: z.number().int().optional(),
  submitted_at: z.date().or(z.string()).optional(),
});

export type ExerciseSubmission = z.infer<typeof exerciseSubmissionSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Resources
// ═══════════════════════════════════════════════════════════════════════════

export const resourceSchema = z.object({
  id: z.string().uuid().optional(),
  concept_id: z.number().int().positive(),
  module_id: z.number().int().positive(),
  type: z.enum(["paper", "video", "tool", "ctf", "book", "course"]),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  url: z.string().url(),
  author: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  created_at: z.date().or(z.string()).optional(),
});

export type Resource = z.infer<typeof resourceSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Badges
// ═══════════════════════════════════════════════════════════════════════════

export const badgeSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon_emoji: z.string().max(10).optional(),
  trigger_type: z.enum(["modules_completed", "track_completed", "exam_score", "streak_days", "exercise_completed"]),
  trigger_value: z.number().int().positive().optional(),
  xp_reward: z.number().int().nonnegative().default(0),
  created_at: z.date().or(z.string()).optional(),
});

export type Badge = z.infer<typeof badgeSchema>;

export const userBadgeSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  badge_id: z.number().int().positive(),
  earned_at: z.date().or(z.string()).optional(),
});

export type UserBadge = z.infer<typeof userBadgeSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Track Progress
// ═══════════════════════════════════════════════════════════════════════════

export const trackProgressSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  track_id: z.number().int().positive(),
  modules_completed: z.array(z.number().int().positive()).default([]),
  progress_percent: z.number().int().min(0).max(100).default(0),
  status: z.enum(["started", "in_progress", "completed"]).default("started"),
  started_at: z.date().or(z.string()).optional(),
  completed_at: z.date().or(z.string()).nullable().optional(),
});

export type TrackProgress = z.infer<typeof trackProgressSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Labs
// ═══════════════════════════════════════════════════════════════════════════

export const labSchema = z.object({
  id: z.string().uuid().optional(),
  module_id: z.number().int().positive(),
  concept_id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  docker_image: z.string().optional(),
  docker_tag: z.string().default("latest"),
  time_limit_minutes: z.number().int().positive().default(30),
  difficulty: z.enum(["basic", "intermediate", "advanced"]),
  objectives: z.array(z.string()).default([]),
  hints: z.array(z.string()).default([]),
});

export type Lab = z.infer<typeof labSchema>;

export const labSessionSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  lab_id: z.string().uuid(),
  container_id: z.string().optional(),
  ip_address: z.string().optional(),
  port: z.number().int().optional(),
  started_at: z.date().or(z.string()).optional(),
  ended_at: z.date().or(z.string()).nullable().optional(),
  status: z.enum(["active", "completed", "timeout", "error"]).default("active"),
  score: z.number().int().min(0).max(100).optional(),
  time_spent_minutes: z.number().int().optional(),
});

export type LabSession = z.infer<typeof labSessionSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Module Prerequisites
// ═══════════════════════════════════════════════════════════════════════════

export const modulePrerequisiteSchema = z.object({
  id: z.number().int().positive().optional(),
  module_id: z.number().int().positive(),
  prerequisite_module_id: z.number().int().positive(),
  created_at: z.date().or(z.string()).optional(),
});

export type ModulePrerequisite = z.infer<typeof modulePrerequisiteSchema>;
