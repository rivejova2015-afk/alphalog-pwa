// AlphaLog Securities — CyberSec Academy
// Static content types. Per-user state lives in Supabase (see migration 094).

export type ModuleStatus = "locked" | "active" | "completed";
export type LevelKey = "b" | "i" | "a";

export interface ModuleLevels {
  b: string;
  i: string;
  a: string;
}

export interface Module {
  m: number;
  title: string;
  cat: string;
  wk: string;
  levels: ModuleLevels;
  topics: string[];
  research: string;
  st: ModuleStatus;
}

export interface LessonSection {
  h: string;
  c: string;
}

export interface Lesson {
  id: number;
  title: string;
  sub: string;
  dur: string;
  diff: string;
  sections: LessonSection[];
}

export interface QuizQuestion {
  q: string;
  o: string[];
  c: number;
  e: string;
}

// Niveles de un quiz por módulo: básico → intermedio → avanzado. Se desbloquean
// en orden y alimentan la maestría (b/i/a + Legendary).
export type QuizLevel = "b" | "i" | "a";

export interface PracticeItem {
  s: string;
  a: string;
}

export interface PracticeExercise {
  id: number;
  lesson: number;
  title: string;
  items: PracticeItem[];
  opts: string[];
}

export type HomeworkType = "research" | "practical" | "reflection" | "code";

export interface Homework {
  id: number;
  l: number;
  t: string;
  tp: HomeworkType;
  pts: number;
  d: string;
}

export interface ExamQuestion {
  q: string;
  o: string[];
  c: number;
}

export interface ProgressRecord {
  module_id: number;
  status: ModuleStatus;
  completed_levels: LevelKey[];
  research_done: boolean;
}

export type ProgressMap = Record<number, ProgressRecord>;

export type HomeworkStatus = "pending" | "submitted" | "graded";

export interface HomeworkSubmission {
  homework_id: number;
  content: string | null;
  status: HomeworkStatus;
  points: number | null;
  submitted_at: string | null;
  graded_at: string | null;
}
