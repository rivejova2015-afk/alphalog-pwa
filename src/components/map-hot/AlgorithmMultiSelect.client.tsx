'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { toast } from 'sonner';

interface AlgorithmItem {
  id: string;
  name: string;
  status: string | null;
  market_type: string | null;
  platform: string | null;
}

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  maxLimit?: number;
}

const DEFAULT_MAX = 20;

export function AlgorithmMultiSelect({ value, onChange, maxLimit = DEFAULT_MAX }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AlgorithmItem[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/algorithms/lite', { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as AlgorithmItem[];
        if (cancelled) return;
        setItems(json);
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : 'Error loading algorithms');
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, search]);

  const grouped = useMemo(() => {
    const map: Record<string, AlgorithmItem[]> = {};
    for (const it of filtered) {
      const key = it.market_type || 'other';
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    return map;
  }, [filtered]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedItems = useMemo(
    () => items.filter((it) => selectedSet.has(it.id)),
    [items, selectedSet]
  );
  const limitReached = value.length >= maxLimit;

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(value.filter((s) => s !== id));
    } else {
      if (limitReached) return;
      onChange([...value, id]);
    }
  };

  const remove = (id: string) => onChange(value.filter((s) => s !== id));

  const statusColor = (status: string | null): string => {
    if (status === 'live') return '#22d3ee';
    if (status === 'paper') return '#eab308';
    if (status === 'paused') return '#94a3b8';
    return '#475569';
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded bg-[#151b28] border border-[#1f2937] hover:border-[#eab308]/30 px-3 py-2 text-sm transition-colors"
      >
        <span className="text-[#94a3b8]">
          {value.length === 0
            ? 'Link algorithms…'
            : `${value.length} algorithm${value.length === 1 ? '' : 's'} linked`}
        </span>
        <ChevronDown size={14} className={`text-[#475569] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedItems.map((it) => {
            const color = statusColor(it.status);
            return (
              <span
                key={it.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-mono"
                style={{
                  borderColor: `${color}40`,
                  backgroundColor: `${color}10`,
                  color,
                }}
              >
                {it.name}
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  aria-label={`Unlink ${it.name}`}
                  className="hover:text-[#e2e8f0] transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-2 max-h-80 overflow-hidden rounded border border-[#1f2937] bg-[#0a0e1a] shadow-xl flex flex-col">
          <div className="flex items-center gap-2 border-b border-[#1f2937] px-3 py-2 flex-shrink-0">
            <Search size={12} className="text-[#475569]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search algorithm…"
              className="w-full bg-transparent text-[#e2e8f0] text-xs focus:outline-none placeholder:text-[#2d3748]"
              autoFocus
            />
            {limitReached && (
              <span className="text-[9px] font-mono uppercase tracking-wider text-[#f59e0b]">
                Max {maxLimit}
              </span>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="px-3 py-4 text-center text-[#475569] text-xs">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[#475569] text-xs">
                {items.length === 0 ? 'No algorithms yet — create one in /intelligence/algorithms' : 'No results'}
              </div>
            ) : (
              Object.entries(grouped).map(([category, list]) => (
                <div key={category}>
                  <div className="sticky top-0 bg-[#0a0e1a] px-3 py-1.5 border-y border-[#1f2937] text-[10px] font-mono uppercase tracking-wider text-[#22d3ee]">
                    {category}
                  </div>
                  <ul>
                    {list.map((it) => {
                      const selected = selectedSet.has(it.id);
                      const disabled = !selected && limitReached;
                      const color = statusColor(it.status);
                      return (
                        <li key={it.id}>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => toggle(it.id)}
                            title={disabled ? `Max ${maxLimit} algorithms` : undefined}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                              selected ? 'bg-[#eab308]/5 text-[#eab308]' : 'text-[#e2e8f0] hover:bg-[#1f2937]/50'
                            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <span
                              aria-hidden="true"
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] flex-shrink-0 ${
                                selected
                                  ? 'border-[#eab308] bg-[#eab308] text-[#0a0e1a]'
                                  : 'border-[#1f2937] bg-[#0a0e1a]'
                              }`}
                            >
                              {selected ? '✓' : ''}
                            </span>
                            <span className="font-mono flex-1 truncate">{it.name}</span>
                            {it.status && (
                              <span
                                className="text-[9px] font-mono uppercase tracking-wider flex-shrink-0"
                                style={{ color }}
                              >
                                {it.status}
                              </span>
                            )}
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
