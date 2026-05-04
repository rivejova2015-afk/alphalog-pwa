"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Award, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Homework, HomeworkSubmission } from "@/lib/securities/cybersec";

interface Props {
  homework: Homework;
}

const TYPE_LABELS: Record<string, string> = {
  research:   "Investigación",
  practical:  "Práctico",
  reflection: "Reflexión",
  code:       "Código",
};

export function HomeworkDetail({ homework: hw }: Props) {
  const [content, setContent] = useState("");
  const [submission, setSubmission] = useState<HomeworkSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/securities/cybersec/homework-submissions");
        if (!res.ok) return;
        const data = (await res.json()) as Record<number, HomeworkSubmission>;
        if (!cancelled) {
          const existing = data[hw.id] ?? null;
          setSubmission(existing);
          setContent(existing?.content ?? "");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hw.id]);

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
      if (!res.ok) {
        toast.error("No se pudo enviar la entrega");
        return;
      }
      const json = (await res.json()) as { submission: HomeworkSubmission };
      setSubmission(json.submission);
      toast.success("Entrega enviada");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleSelfGrade = async (points: number) => {
    setSaving(true);
    try {
      const res = await fetch("/api/securities/cybersec/homework-submissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homework_id: hw.id, status: "graded", points }),
      });
      if (!res.ok) {
        toast.error("No se pudo guardar la nota");
        return;
      }
      const json = (await res.json()) as { submission: HomeworkSubmission };
      setSubmission(json.submission);
      toast.success(`Nota guardada: ${points}/${hw.pts}`);
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
      if (!res.ok) {
        toast.error("No se pudo reabrir");
        return;
      }
      const json = (await res.json()) as { submission: HomeworkSubmission };
      setSubmission(json.submission);
      toast.success("Entrega reabierta");
    } finally {
      setSaving(false);
    }
  };

  const status = submission?.status ?? "pending";

  return (
    <div className="space-y-6">
      <Link href="/securities/cybersec/homework" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver a homework
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-[#475569] font-mono">
          <span>HW{hw.id}</span>
          <span>·</span>
          <span>L{hw.l}</span>
          <span>·</span>
          <span>{TYPE_LABELS[hw.tp]}</span>
          <span>·</span>
          <span className="text-[#22d3ee] font-bold">{hw.pts} pts</span>
        </div>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">{hw.t}</h1>
      </header>

      <section className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
        <p className="text-xs uppercase tracking-wider text-[#475569] font-bold mb-2">Consigna</p>
        <p className="text-sm text-[#e2e8f0] leading-relaxed">{hw.d}</p>
      </section>

      <section className="space-y-2">
        <label htmlFor="content" className="block text-xs uppercase tracking-wider text-[#94a3b8] font-bold">
          Tu entrega
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={loading || saving}
          placeholder="Pega aquí el resultado de tu trabajo. Markdown permitido."
          rows={12}
          className="w-full rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3 text-sm text-[#e2e8f0] placeholder-[#475569] font-mono focus:outline-none focus:border-[#22d3ee]/50 disabled:opacity-50"
        />
      </section>

      {submission && submission.status === "graded" && (
        <div className="flex items-center gap-3 rounded-lg border border-[#34d399]/40 bg-[#34d399]/5 p-3">
          <Award size={20} className="text-[#34d399]" />
          <div>
            <p className="text-sm font-bold text-[#34d399]">Calificada · {submission.points ?? "—"}/{hw.pts} pts</p>
            {submission.graded_at && (
              <p className="text-[11px] text-[#94a3b8]">{new Date(submission.graded_at).toLocaleString()}</p>
            )}
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

        {status === "submitted" && (
          <SelfGradePicker max={hw.pts} disabled={saving} onPick={(pts) => void handleSelfGrade(pts)} />
        )}

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
          <span className="text-[11px] text-[#475569] ml-auto">
            Enviada: {new Date(submission.submitted_at).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

function SelfGradePicker({ max, disabled, onPick }: { max: number; disabled: boolean; onPick: (pts: number) => void }) {
  const options = [Math.round(max * 0.6), Math.round(max * 0.8), max];
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[11px] text-[#94a3b8]">Auto-calificar:</span>
      {options.map((pts) => (
        <button
          key={pts}
          onClick={() => onPick(pts)}
          disabled={disabled}
          className="px-2.5 py-1 rounded text-[11px] font-bold border border-[#34d399]/40 text-[#34d399] hover:bg-[#34d399]/10 disabled:opacity-50"
        >
          {pts}/{max}
        </button>
      ))}
    </div>
  );
}
