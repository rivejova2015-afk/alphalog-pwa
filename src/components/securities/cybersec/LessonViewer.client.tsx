"use client";

import Link from "next/link";
import { ArrowLeft, Clock, BarChart, Play, BookMarked, Network, History, Compass, ChevronDown } from "lucide-react";
import type { Lesson, LessonSection } from "@/lib/securities/cybersec";
import {
  moduleIdFromSub,
  definitionsByModule,
  frameworksByModule,
  timelinesByModule,
  branchesByModule,
} from "@/lib/securities/cybersec";
import { MarkdownBlocks } from "./MarkdownBlocks.client";
import { DefinitionList } from "./DefinitionList.client";
import { FrameworkDiagram } from "./FrameworkDiagram.client";
import { HistoryTimeline } from "./HistoryTimeline.client";
import { FieldBranches } from "./FieldBranches.client";

interface Props {
  lesson: Lesson;
  hasQuiz: boolean;
}

export function LessonViewer({ lesson, hasQuiz }: Props) {
  const moduleId = moduleIdFromSub(lesson.sub);
  const definitions = moduleId != null ? definitionsByModule(moduleId) : [];
  const frameworks = moduleId != null ? frameworksByModule(moduleId) : [];
  const timelines = moduleId != null ? timelinesByModule(moduleId) : [];
  const branches = moduleId != null ? branchesByModule(moduleId) : [];

  return (
    <div className="space-y-6">
      <Link href="/securities/cybersec" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver al syllabus
      </Link>

      <header className="space-y-2 border-b border-[#1f2937] pb-4">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-[#475569] font-mono">
          <span>{lesson.sub}</span>
          <span className="inline-flex items-center gap-1"><BarChart size={11} /> {lesson.diff}</span>
          <span className="inline-flex items-center gap-1"><Clock size={11} /> {lesson.dur}</span>
        </div>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">{lesson.title}</h1>
      </header>

      <article className="space-y-6">
        {lesson.sections.map((section, idx) => (
          <Section key={idx} section={section} />
        ))}
      </article>

      {/* ── Contenido enriquecido del módulo ── */}
      {definitions.length > 0 && (
        <Enrichment title="Definiciones clave" icon={<BookMarked size={15} />} count={definitions.length} defaultOpen>
          <DefinitionList definitions={definitions} />
        </Enrichment>
      )}
      {frameworks.length > 0 && (
        <Enrichment title="Frameworks" icon={<Network size={15} />} count={frameworks.length}>
          <FrameworkDiagram frameworks={frameworks} />
        </Enrichment>
      )}
      {timelines.length > 0 && (
        <Enrichment title="Historia y evolución" icon={<History size={15} />}>
          <HistoryTimeline timelines={timelines} />
        </Enrichment>
      )}
      {branches.length > 0 && (
        <Enrichment title="Ramas del campo" icon={<Compass size={15} />} count={branches.length}>
          <FieldBranches branches={branches} />
        </Enrichment>
      )}

      {hasQuiz && (
        <Link
          href={`/securities/cybersec/quizzes/${lesson.id}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0a0e1a] font-bold rounded text-sm"
        >
          <Play size={14} /> Tomar quiz de esta lección
        </Link>
      )}
    </div>
  );
}

function Section({ section }: { section: LessonSection }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-[#22d3ee] font-mono">{section.h}</h2>
      <MarkdownBlocks content={section.c} />
    </section>
  );
}

// Sección colapsable de contenido enriquecido (usa <details> nativo).
function Enrichment({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-[#1f2937] bg-[#070b14]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
        <span className="text-[#22d3ee]">{icon}</span>
        <span className="text-sm font-bold text-[#e2e8f0]">{title}</span>
        {count != null && (
          <span className="rounded-full bg-[#1f2937] px-2 py-0.5 text-[10px] font-mono text-[#94a3b8]">{count}</span>
        )}
        <ChevronDown size={16} className="ml-auto text-[#475569] transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-[#1f2937] px-4 py-4">{children}</div>
    </details>
  );
}
