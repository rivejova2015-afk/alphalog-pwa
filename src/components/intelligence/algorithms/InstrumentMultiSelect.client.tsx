"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { toast } from "sonner";

interface InstrumentItem {
  id?: string;
  symbol: string;
  display_name: string;
  category: string;
  market_type?: string;
}

interface ApiResponse {
  grouped: Record<string, InstrumentItem[]>;
  flat: InstrumentItem[];
}

const FALLBACK: InstrumentItem[] = [
  { symbol: "XAUUSD", display_name: "XAUUSD (Gold)",   category: "Metales", market_type: "metals"  },
  { symbol: "US500",  display_name: "US500 (S&P500)", category: "Indices", market_type: "indices" },
];

const MAX_SELECTION = 10;

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
}

export function InstrumentMultiSelect({ value, onChange, error }: Props) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems]     = useState<InstrumentItem[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/instruments", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        setItems(json.flat ?? []);
      } catch {
        if (cancelled) return;
        toast.error("Error cargando instrumentos");
        setItems(FALLBACK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return items;
    return items.filter((it) => it.symbol.toUpperCase().includes(q) || it.display_name.toUpperCase().includes(q));
  }, [items, search]);

  const grouped = useMemo(() => {
    const map: Record<string, InstrumentItem[]> = {};
    for (const it of filtered) {
      const key = it.category || "Otros";
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    return map;
  }, [filtered]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const limitReached = value.length >= MAX_SELECTION;

  function toggle(symbol: string) {
    if (selectedSet.has(symbol)) {
      onChange(value.filter((s) => s !== symbol));
    } else {
      if (limitReached) return;
      onChange([...value, symbol]);
    }
  }

  function remove(symbol: string) {
    onChange(value.filter((s) => s !== symbol));
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between rounded-lg bg-[#0a0e1a] border px-3 py-2 text-sm transition-colors ${
          error ? "border-[#ef4444]" : "border-[#1f2937] hover:border-[#475569]"
        }`}
      >
        <span className="text-[#94a3b8]">
          {value.length === 0
            ? "Selecciona instrumentos…"
            : `${value.length} seleccionado${value.length === 1 ? "" : "s"}`}
        </span>
        <ChevronDown size={14} className={`text-[#475569] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#34d399]/30 bg-[#34d399]/10 text-[#34d399] text-[11px] font-mono"
            >
              {s}
              <button
                type="button"
                onClick={() => remove(s)}
                aria-label={`Quitar ${s}`}
                className="hover:text-[#e2e8f0] transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="text-[10px] text-[#ef4444] mt-1">{error}</p>
      )}

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-2 max-h-80 overflow-hidden rounded-lg border border-[#1f2937] bg-[#0a0e1a] shadow-xl flex flex-col">
          <div className="flex items-center gap-2 border-b border-[#1f2937] px-3 py-2 flex-shrink-0">
            <Search size={12} className="text-[#475569]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar instrumento…"
              className="w-full bg-transparent text-[#e2e8f0] text-xs focus:outline-none placeholder:text-[#2d3748]"
              autoFocus
            />
            {limitReached && (
              <span className="text-[9px] font-mono uppercase tracking-wider text-[#f59e0b]">Máx {MAX_SELECTION}</span>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="px-3 py-4 text-center text-[#475569] text-xs">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[#475569] text-xs">Sin resultados</div>
            ) : (
              Object.entries(grouped).map(([category, list]) => (
                <div key={category}>
                  <div className="sticky top-0 bg-[#0a0e1a] px-3 py-1.5 border-y border-[#1f2937] text-[10px] font-mono uppercase tracking-wider text-[#22d3ee]">
                    {category}
                  </div>
                  <ul>
                    {list.map((it) => {
                      const selected = selectedSet.has(it.symbol);
                      const disabled = !selected && limitReached;
                      return (
                        <li key={it.symbol}>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => toggle(it.symbol)}
                            title={disabled ? `Máximo ${MAX_SELECTION} instrumentos` : undefined}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                              selected ? "bg-[#34d399]/5 text-[#34d399]" : "text-[#e2e8f0] hover:bg-[#1f2937]/50"
                            } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                          >
                            <span
                              aria-hidden="true"
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${
                                selected
                                  ? "border-[#34d399] bg-[#34d399] text-[#0a0e1a]"
                                  : "border-[#1f2937] bg-[#0a0e1a]"
                              }`}
                            >
                              {selected ? "✓" : ""}
                            </span>
                            <span className="font-mono">{it.display_name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
