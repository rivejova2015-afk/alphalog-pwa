"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, BarChart, Play } from "lucide-react";
import type { Lesson, LessonSection } from "@/lib/securities/cybersec";
import { parseContent, tokenizeInline } from "@/lib/securities/cybersec";

interface Props {
  lesson: Lesson;
  hasQuiz: boolean;
}

export function LessonViewer({ lesson, hasQuiz }: Props) {
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
  const blocks = parseContent(section.c);
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-[#22d3ee] font-mono">{section.h}</h2>
      <div className="space-y-2 text-sm text-[#e2e8f0] leading-relaxed">
        {blocks.map((block, bi) =>
          block.type === "code" ? (
            <pre
              key={bi}
              className="overflow-x-auto rounded-lg border border-[#1f2937] bg-[#05080f] px-3 py-2.5 text-[13px] font-mono text-[#7dd3fc] whitespace-pre-wrap"
            >
              <code>{block.lines.join("\n")}</code>
            </pre>
          ) : (
            <div key={bi} className="space-y-1.5">
              {block.lines.map((line, i) => (
                <Fragment key={i}>
                  <p>{renderInline(line)}</p>
                </Fragment>
              ))}
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function renderInline(line: string) {
  const tokens = tokenizeInline(line);
  return tokens.map((tok, i) =>
    tok.b ? (
      <strong key={i} className="text-[#e2e8f0] font-bold">{tok.t}</strong>
    ) : (
      <Fragment key={i}>{tok.t}</Fragment>
    ),
  );
}
