"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Skeleton, EmptyState } from "@/components/ui";
import { HW, HW_TOTAL_POINTS, type HomeworkStatus, type HomeworkSubmission } from "@/lib/securities/cybersec";

const STATUS_STYLES: Record<HomeworkStatus, string> = {
  pending:   "text-[#94a3b8] bg-[#1f2937] border-[#1f2937]",
  submitted: "text-[#22d3ee] bg-[#22d3ee]/10 border-[#22d3ee]/30",
  graded:    "text-[#34d399] bg-[#34d399]/10 border-[#34d399]/30",
};

const TYPE_LABELS: Record<string, string> = {
  research:   "Investigación",
  practical:  "Práctico",
  reflection: "Reflexión",
  code:       "Código",
};

export function HomeworkList() {
  const [submissions, setSubmissions] = useState<Record<number, HomeworkSubmission>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/securities/cybersec/homework-submissions");
        if (!res.ok) {
          toast.error("No se pudieron cargar las entregas");
          return;
        }
        const data = (await res.json()) as Record<number, HomeworkSubmission>;
        if (!cancelled) setSubmissions(data);
      } catch {
        toast.error("Error de conexión");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalSubmitted = Object.values(submissions).filter((s) => s.status !== "pending").length;
  const totalEarned = Object.entries(submissions).reduce((acc, [hwId, sub]) => {
    if (sub.status !== "graded") return acc;
    const hw = HW.find((h) => h.id === Number(hwId));
    return acc + (sub.points ?? hw?.pts ?? 0);
  }, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-2">
          <Skeleton height={70} />
          <Skeleton height={70} />
          <Skeleton height={70} />
        </div>
        <Skeleton height={70} count={4} />
      </div>
    );
  }

  if (HW.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Sin tareas asignadas"
        message="Cuando se publiquen nuevas tareas aparecerán aquí."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Entregadas" value={`${totalSubmitted}/${HW.length}`} accent="#22d3ee" />
        <Tile label="Puntos" value={`${totalEarned}/${HW_TOTAL_POINTS}`} accent="#34d399" />
        <Tile label="Pendientes" value={`${HW.length - totalSubmitted}`} accent="#eab308" />
      </div>

      <ul className="space-y-2">
        {HW.map((hw) => {
          const sub = submissions[hw.id];
          const status: HomeworkStatus = sub?.status ?? "pending";
          return (
            <li key={hw.id}>
              <Link
                href={`/securities/cybersec/homework/${hw.id}`}
                className="flex items-center gap-3 rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3 hover:bg-[#151b28] transition-colors"
              >
                <FileText size={18} className="text-[#22d3ee] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-[#475569]">HW{hw.id}</span>
                    <span className="text-[10px] uppercase tracking-wider text-[#94a3b8]">L{hw.l} · {TYPE_LABELS[hw.tp]}</span>
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider rounded border px-1.5 py-0.5 ${STATUS_STYLES[status]}`}>
                      {status}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#e2e8f0] mt-1">{hw.t}</p>
                  <p className="text-[11px] text-[#94a3b8] mt-0.5 line-clamp-1">{hw.d}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-[#22d3ee]">{hw.pts} pts</p>
                  <ChevronRight size={14} className="text-[#475569] inline mt-1" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#475569]">{label}</p>
      <p className="text-xl font-bold font-mono mt-1" style={{ color: accent }}>{value}</p>
    </div>
  );
}
