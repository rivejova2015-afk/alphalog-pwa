"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { searchModules } from "@/lib/securities/cybersec";

export function SearchView() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchModules(query), [query]);
  const trimmed = query.trim();

  return (
    <div className="space-y-5">
      <Link href="/securities/cybersec" className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#22d3ee]">
        <ArrowLeft size={14} /> Volver al syllabus
      </Link>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar módulos, temas… (ej: nmap, kerberos, XSS)"
          aria-label="Buscar en CyberSec Academy"
          className="w-full rounded-lg border border-[#1f2937] bg-[#0a0e1a] pl-9 pr-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#22d3ee]/50"
        />
      </div>

      {trimmed.length === 0 ? (
        <p className="text-sm text-[#475569]">Escribí para buscar entre los 82 módulos.</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-[#475569]">Sin resultados para “{trimmed}”.</p>
      ) : (
        <>
          <p className="text-[11px] text-[#475569]">{results.length} resultado(s)</p>
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.m}>
                <Link
                  href={`/securities/cybersec/modules/${r.m}`}
                  className="block rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3 hover:border-[#22d3ee]/40 hover:bg-[#151b28]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[#e2e8f0]">
                      <span className="text-[#475569] font-mono mr-1.5">M{r.m}</span>{r.title}
                    </p>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-[#a78bfa]">{r.cat}</span>
                  </div>
                  {r.matched.length > 0 && (
                    <p className="mt-1 text-[11px] text-[#94a3b8]">
                      {r.matched.slice(0, 3).join(" · ")}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
