// AlphaLog Securities — CyberSec Academy
// Static content types. Per-user state lives in Supabase (see migration 094).

import type { CertTrack } from "./certifications";

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

// ── Enriquecimiento de lecciones (definiciones, frameworks, timeline, ramas) ──
// Catálogos de contenido keyed por módulo, mostrados dentro de LessonViewer.

export interface ConceptDefinition {
  id: number;
  module: number;      // módulo al que pertenece (1-86)
  term: string;        // concepto (ej. "Superficie de ataque")
  short: string;       // definición de una línea
  detail: string;      // explicación extendida (markdown: bold, tablas, callouts)
  examples: string[];  // ejemplos concretos
  related: string[];   // términos relacionados (chips)
}

export interface FrameworkPhase {
  n: number;           // número de fase (1..N, consecutivo)
  name: string;
  desc: string;
  defenses: string[];  // contramedidas/defensas de la fase
}

export interface Framework {
  id: number;
  module: number;
  name: string;        // ej. "Cyber Kill Chain (Lockheed Martin)"
  kind: "killchain" | "attack" | "controls" | "layers" | "flow";
  summary: string;
  phases: FrameworkPhase[];
}

export type ImpactLevel = "low" | "medium" | "high";

export interface TimelineEvent {
  year: number;
  title: string;
  desc: string;
  impact: ImpactLevel;
}

export interface HistoryTimeline {
  id: number;
  module: number;
  title: string;
  events: TimelineEvent[]; // ordenados por año ascendente
}

export interface FieldBranch {
  id: number;
  module: number;
  name: string;        // ej. "Red Team / Ofensiva"
  color: string;       // acento hex para la tarjeta
  summary: string;
  roles: string[];
  skills: string[];
  tools: string[];
  track: CertTrack;    // enlaza a /certificaciones?track=
}


export interface HomeworkSubmission {
  homework_id: number;
  content: string | null;
  status: HomeworkStatus;
  points: number | null;
  submitted_at: string | null;
  graded_at: string | null;
}
