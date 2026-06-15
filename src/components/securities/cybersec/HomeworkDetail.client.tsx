"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Award, RotateCcw, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Homework, HomeworkSubmission } from "@/lib/securities/cybersec";
import { parseContent, tokenizeInline, rubricFor, rubricScore } from "@/lib/securities/cybersec";

interface Props {
  homework: Homework;
}

const TYPE_LABELS: Record<string, string> = {
  research:   "Investigación",
  practical:  "Práctico",
  reflection: "Reflexión",
  code:       "Código",
};

function draftKey(id: number) {
  return `cybersec.hw.${id}.draft`;
}

export function HomeworkDetail({ homework: hw }: Props) {
  const [content, setContent] = useState("");
  const [submission, setSubmission] = useState<HomeworkSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [checked, setChecked] = useState<boolean[]>([]);

  const criteria = useMemo(() => rubricFor(hw.tp), [hw.tp]);

  useEffect(() => {
    setChecked(new Array(criteria.length).fill(false));
  }, [criteria.length]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/securities/cybersec/homework-submissions");
        if (!res.ok) return;
        const data = (await res.json()) as Record<number, HomeworkSubmission>;
        if (cancelled) return;
        const existing = data[hw.id] ?? null;
        setSubmission(existing);
        if (existing?.content) {
          setContent(existing.content);
        } else {
          // No server content → restore local draft if any.
          try {
            const draft = localStorage.getItem(draftKey(hw.id));
            if (draft) setContent(draft);
          } catch { /* ignore */ }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hw.id]);

  // Autosave draft (debounced) while editing and not yet graded.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      try {
        if (content.trim()) localStorage.setItem(draftKey(hw.id), content);
      } catch { /* ignore */ }
    }, 800);
    return () => clearTimeout(t);
  }, [content, hw.id, loading]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const status = submission?.status ?? "pending";
  const checkedCount = checked.filter(Boolean).length;
  const rubricPts = rubricScore(checkedCount, criteria.length, hw.pts);

  const handleSubmit = async () => {
    if (content.trim().length === 0) {
      toast.error("La entrega no puede estar vacía");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/securities/cybersec/homework-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homework_id: hw.id, content }),
      });
      if (!res.ok) { toast.error("No se pudo enviar la entrega"); return; }
      const json = (await res.json()) as { submission: HomeworkSubmission };
      setSubmission(json.submission);
      try { localStorage.removeItem(draftKey(hw.id)); } catch { /* ignore */ }
      toast.success("Entrega enviada");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleSelfGrade = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/securities/cybersec/homework-submissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homework_id: hw.id, status: "graded", points: rubricPts }),
      });
      if (!res.ok) { toast.error("No se pudo guardar la nota"); return; }
      const json = (await res.json()) as { submission: HomeworkSubmission };
      setSubmission(json.submission);
      toast.success(`Nota guardada: ${rubricPts}/${hw.pts}`);
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/securities/cybersec/homework-submissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homework_id: hw.id, status: "pending" }),
      });
      if (!res.ok) { toast.error("No se pudo reabrir"); return; }
      const json = (await res.json()) as { submission: HomeworkSubmission };
      setSubmission(json.submission);
      toast.success("Entrega reabierta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/securities/cybersec/homework" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver a homework
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-[#475569] font-mono">
          <span>HW{hw.id}</span><span>·</span><span>L{hw.l}</span><span>·</span>
          <span>{TYPE_LABELS[hw.tp]}</span><span>·</span>
          <span className="text-[#22d3ee] font-bold">{hw.pts} pts</span>
        </div>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">{hw.t}</h1>
      </header>

      <section className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
        <p className="text-xs uppercase tracking-wider text-[#475569] font-bold mb-2">Consigna</p>
        <p className="text-sm text-[#e2e8f0] leading-relaxed">{hw.d}</p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="content" className="block text-xs uppercase tracking-wider text-[#94a3b8] font-bold">Tu entrega</label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#475569]">{wordCount} palabras</span>
            <button
              onClick={() => setPreview((p) => !p)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-[#1f2937] text-[#94a3b8] hover:text-[#22d3ee]"
            >
              {preview ? <><Pencil size={11} /> Escribir</> : <><Eye size={11} /> Vista previa</>}
            </button>
          </div>
        </div>
        {preview ? (
          <div className="min-h-[12rem] rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3 text-sm text-[#e2e8f0]">
            {content.trim() ? <MarkdownPreview content={content} /> : <span className="text-[#475569]">Nada para previsualizar.</span>}
          </div>
        ) : (
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={loading || saving || status === "graded"}
            placeholder="Pega aquí el resultado de tu trabajo. Markdown: **negrita**, líneas y bloques de código."
            rows={12}
            className="w-full rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3 text-sm text-[#e2e8f0] placeholder-[#475569] font-mono focus:outline-none focus:border-[#22d3ee]/50 disabled:opacity-50"
          />
        )}
        <p className="text-[11px] text-[#475569]">Borrador autoguardado localmente mientras escribís.</p>
      </section>

      {/* Self-assessment rubric (after submitting) */}
      {status === "submitted" && criteria.length > 0 && (
        <section className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-[#94a3b8] font-bold">Autoevaluación (rúbrica)</p>
          <ul className="space-y-2">
            {criteria.map((c, i) => (
              <li key={i}>
                <label className="flex items-start gap-2 text-sm text-[#e2e8f0] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked[i] ?? false}
                    onChange={(e) => setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                    className="mt-0.5 accent-[#22d3ee]"
                  />
                  {c}
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => void handleSelfGrade()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#34d399] hover:bg-[#10b981] text-[#0a0e1a] font-bold rounded text-sm disabled:opacity-50"
            >
              <Award size={14} /> Calificar ({rubricPts}/{hw.pts})
            </button>
            <span className="text-xs text-[#94a3b8]">{checkedCount}/{criteria.length} criterios</span>
          </div>
        </section>
      )}

      {status === "graded" && (
        <div className="flex items-center gap-3 rounded-lg border border-[#34d399]/40 bg-[#34d399]/5 p-3">
          <Award size={20} className="text-[#34d399]" />
          <div>
            <p className="text-sm font-bold text-[#34d399]">Calificada · {submission?.points ?? "—"}/{hw.pts} pts</p>
            {submission?.graded_at && <p className="text-[11px] text-[#94a3b8]">{new Date(submission.graded_at).toLocaleString()}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void handleSubmit()}
          disabled={loading || saving || status === "graded"}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0a0e1a] font-bold rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={14} /> {status === "submitted" ? "Reemplazar entrega" : "Enviar"}
        </button>
        {status === "graded" && (
          <button
            onClick={() => void handleReopen()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-3 py-2 bg-[#1f2937] hover:bg-[#151b28] text-[#94a3b8] hover:text-[#e2e8f0] rounded text-sm border border-[#1f2937]"
          >
            <RotateCcw size={14} /> Reabrir
          </button>
        )}
        {submission?.submitted_at && (
          <span className="text-[11px] text-[#475569] ml-auto">Enviada: {new Date(submission.submitted_at).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}

// Minimal markdown preview reusing the lesson renderer (bold + code blocks).
function MarkdownPreview({ content }: { content: string }) {
  const blocks = parseContent(content);
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((b, bi) =>
        b.type === "code" ? (
          <pre key={bi} className="overflow-x-auto rounded border border-[#1f2937] bg-[#05080f] px-2 py-1.5 text-[12px] font-mono text-[#7dd3fc] whitespace-pre-wrap">
            <code>{b.lines.join("\n")}</code>
          </pre>
        ) : (
          <div key={bi} className="space-y-1">
            {b.lines.map((line, i) => (
              <p key={i}>
                {tokenizeInline(line).map((tok, k) => (tok.b ? <strong key={k} className="font-bold">{tok.t}</strong> : <Fragment key={k}>{tok.t}</Fragment>))}
              </p>
            ))}
          </div>
        ),
      )}
    </div>
  );
}
