"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Award, Search, ExternalLink, BadgeCheck, Wallet, ListChecks, FileText } from "lucide-react";
import {
  CERT_TRACKS, CERT_TIER_LABELS, certsByTrack, trackLabel,
  type Certification, type CertTrack, type CertTier,
} from "@/lib/securities/cybersec";
import { useCybersecSummary } from "./useCybersecSummary";

const TIERS: CertTier[] = [1, 2, 3, 4, 5];

function priceLabel(c: Certification): string {
  if (c.priceUsd === 0) return "Gratis";
  return `≈ $${c.priceUsd.toLocaleString("en-US")} USD`;
}

export function CertificationsView({ initialTrack }: { initialTrack?: string } = {}) {
  const { summary, updateSpecialization } = useCybersecSummary();
  const validInitial = CERT_TRACKS.some((t) => t.id === initialTrack) ? (initialTrack as CertTrack) : null;

  const [track, setTrack] = useState<CertTrack>(validInitial ?? "offensive");
  const [touched, setTouched] = useState(false);
  const [query, setQuery] = useState("");

  // Si no vino por URL, adoptar la especialización guardada cuando cargue el summary
  // (solo si el usuario todavía no eligió manualmente en esta vista).
  useEffect(() => {
    if (validInitial || touched) return;
    if (summary?.specialization) setTrack(summary.specialization);
  }, [summary?.specialization, validInitial, touched]);

  const selectTrack = (t: CertTrack) => {
    setTrack(t);
    setTouched(true);
    void updateSpecialization(t); // persiste la rama elegida
  };

  const q = query.trim().toLowerCase();
  const certs = useMemo(() => {
    const all = certsByTrack(track);
    if (!q) return all;
    return all.filter((c) => `${c.name} ${c.fullName} ${c.vendor} ${c.domains}`.toLowerCase().includes(q));
  }, [track, q]);

  return (
    <div className="space-y-6">
      <Link href="/securities/cybersec" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver al syllabus
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold text-[#e2e8f0] font-mono">
          <Award size={20} className="text-[#eab308]" /> Certificaciones por rama
        </h1>
        <p className="text-sm text-[#94a3b8]">Elegí tu especialización y seguí la escalera de nivel <b>Entrada → Experto</b>.</p>
      </header>

      {/* Selector de rama */}
      <div className="space-y-2">
        <span className="text-[11px] uppercase tracking-[0.2em] text-[#a78bfa] font-bold">Tu rama</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {CERT_TRACKS.map((t) => {
            const active = t.id === track;
            return (
              <button
                key={t.id}
                onClick={() => selectTrack(t.id)}
                aria-pressed={active}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  active ? "bg-[#eab308]/10 border-[#eab308]/50" : "bg-[#0a0e1a] border-[#1f2937] hover:bg-[#151b28]"
                }`}
              >
                <p className={`text-sm font-bold ${active ? "text-[#eab308]" : "text-[#e2e8f0]"}`}>{t.label}</p>
                <p className="text-[11px] text-[#94a3b8] leading-tight mt-0.5">{t.desc}</p>
              </button>
            );
          })}
        </div>
        {summary?.specialization && (
          <p className="text-[11px] text-[#475569]">Tu rama guardada: <b className="text-[#94a3b8]">{trackLabel(summary.specialization)}</b>.</p>
        )}
      </div>

      {/* Buscar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por nombre, emisor o tema…"
          aria-label="Buscar certificaciones"
          className="w-full rounded-lg border border-[#1f2937] bg-[#0a0e1a] pl-9 pr-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#eab308]/50"
        />
      </div>

      {/* Escalera por nivel */}
      <div className="space-y-6">
        {q ? (
          <CertList certs={certs} />
        ) : (
          TIERS.map((tier) => {
            const items = certs.filter((c) => c.tier === tier);
            if (items.length === 0) return null;
            return (
              <section key={tier} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#eab308] text-[#0a0e1a] text-xs font-bold">{tier}</span>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8]">{CERT_TIER_LABELS[tier]}</h2>
                  <div className="flex-1 h-px bg-[#1f2937]" />
                </div>
                <CertList certs={items} />
              </section>
            );
          })
        )}
        {certs.length === 0 && <p className="text-sm text-[#475569]">Sin certificaciones que coincidan.</p>}
      </div>

      <p className="text-[10px] text-[#475569] border-t border-[#1f2937] pt-3">
        ⚠️ Los precios son <b>aproximados en USD</b> y cambian con frecuencia (varían por región, reintentos y si incluyen curso). Verificá siempre el precio y los requisitos en el sitio oficial del emisor.
      </p>
    </div>
  );
}

function CertList({ certs }: { certs: Certification[] }) {
  return (
    <ul className="space-y-2">
      {certs.map((c) => (
        <li key={c.id} className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#e2e8f0]">
                {c.name} <span className="text-[11px] font-normal text-[#94a3b8]">· {c.vendor}</span>
              </p>
              <p className="text-[11px] text-[#475569]">{c.fullName}</p>
            </div>
            <span className="inline-flex items-center gap-1 shrink-0 text-[11px] px-2 py-0.5 rounded border border-[#34d399]/40 bg-[#34d399]/10 text-[#34d399]">
              <Wallet size={11} /> {priceLabel(c)}
            </span>
          </div>

          <p className="text-[12px] text-[#94a3b8] mt-2">{c.desc}</p>

          <div className="mt-3 grid gap-1.5 text-[11px]">
            <p className="text-[#94a3b8] flex gap-1.5"><ListChecks size={13} className="text-[#a78bfa] shrink-0 mt-px" /><span><b className="text-[#cbd5e1]">Requisitos:</b> {c.prerequisites}</span></p>
            <p className="text-[#94a3b8] flex gap-1.5"><FileText size={13} className="text-[#22d3ee] shrink-0 mt-px" /><span><b className="text-[#cbd5e1]">Examen:</b> {c.exam}</span></p>
            <p className="text-[#94a3b8] flex gap-1.5"><BadgeCheck size={13} className="text-[#eab308] shrink-0 mt-px" /><span><b className="text-[#cbd5e1]">Temario:</b> {c.domains}</span></p>
            {c.priceNote && <p className="text-[10px] text-[#475569] pl-[18px]">Precio: {c.priceNote}.</p>}
          </div>

          <div className="mt-3">
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#eab308] hover:underline">
              Sitio oficial <ExternalLink size={11} />
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
