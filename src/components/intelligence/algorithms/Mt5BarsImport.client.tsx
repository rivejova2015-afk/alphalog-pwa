"use client";

import { useRef, useState } from "react";
import { Upload, FileText, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  algorithmId: string;
  onSuccess?: () => void;
}

// Mirror of the parser's filename regex (longest-first, lookahead for boundary).
const FILENAME_RE = /^([A-Z0-9]+)[._\-](M15|M30|M5|M1|H4|H1|MN1|D1|W1)(?=[._\-]|$)/i;
const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"] as const;
type Tf = typeof TIMEFRAMES[number];

interface FileEntry {
  file: File;
  symbol: string;
  tf: Tf | "";
  status: "pending" | "uploading" | "ok" | "error";
  message?: string;
  bars?: number;
}

function detectFromName(name: string): { symbol: string; tf: Tf } | null {
  const base = name.replace(/^.*[\\/]/, "");
  const m = base.match(FILENAME_RE);
  if (!m) return null;
  return { symbol: m[1].toUpperCase(), tf: m[2].toUpperCase() as Tf };
}

export function Mt5BarsImport({ algorithmId, onSuccess }: Props) {
  const [open, setOpen]               = useState(false);
  const [tzOffset, setTzOffset]       = useState("0");
  const [entries, setEntries]         = useState<FileEntry[]>([]);
  const [running, setRunning]         = useState(false);
  const [dragOver, setDragOver]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: FileEntry[] = [];
    for (const f of Array.from(files)) {
      if (!f.name.toLowerCase().endsWith(".csv")) continue;
      const det = detectFromName(f.name);
      next.push({
        file: f,
        symbol: det?.symbol ?? "",
        tf: det?.tf ?? "",
        status: "pending",
      });
    }
    setEntries((prev) => [...prev, ...next]);
  }

  function updateEntry(idx: number, patch: Partial<FileEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function removeEntry(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  async function uploadOne(idx: number, entry: FileEntry): Promise<boolean> {
    if (!entry.symbol || !entry.tf) {
      updateEntry(idx, { status: "error", message: "Falta symbol o timeframe" });
      return false;
    }
    updateEntry(idx, { status: "uploading", message: undefined });
    const fd = new FormData();
    fd.append("file", entry.file);
    fd.append("symbol", entry.symbol);
    fd.append("timeframe", entry.tf);
    fd.append("tz_offset_minutes", String(Number(tzOffset) || 0));

    try {
      const res = await fetch(`/api/algorithms/${algorithmId}/bars-import`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        updateEntry(idx, { status: "error", message: json.error ?? `HTTP ${res.status}` });
        return false;
      }
      updateEntry(idx, { status: "ok", bars: json.bars_inserted, message: undefined });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      updateEntry(idx, { status: "error", message: msg });
      return false;
    }
  }

  async function runAll() {
    if (entries.length === 0) {
      toast.error("Arrastrá uno o más CSVs primero");
      return;
    }
    setRunning(true);
    let okCount = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.status === "ok") continue;  // skip already-imported
      const ok = await uploadOne(i, entry);
      if (ok) okCount++;
    }
    setRunning(false);
    if (okCount > 0) {
      toast.success(`${okCount} archivo${okCount === 1 ? "" : "s"} importado${okCount === 1 ? "" : "s"}`);
      onSuccess?.();
    } else {
      toast.error("Ningún archivo importado — revisá los errores");
    }
  }

  return (
    <div className="bg-[#0a0e1a] border border-[#22d3ee]/20 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-mono uppercase tracking-wider text-[#22d3ee] hover:bg-[#22d3ee]/5 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Upload size={12} /> Importar barras MT5 (CSV)
          {entries.length > 0 && <span className="text-[10px] text-[#475569]">— {entries.length} archivo{entries.length === 1 ? "" : "s"}</span>}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="p-3 border-t border-[#22d3ee]/20 space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center py-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
              dragOver ? "border-[#22d3ee] bg-[#22d3ee]/5" : "border-[#1f2937] hover:border-[#475569]"
            }`}
          >
            <Upload size={18} className="text-[#475569] mb-1.5" />
            <p className="text-[11px] text-[#94a3b8]">Arrastrá CSVs de MT5 acá o click para abrir</p>
            <p className="text-[9px] text-[#475569] mt-1">Formato: <code>SYMBOL_TF.csv</code> (ej. <code>XAUUSD_M15.csv</code>)</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[10px] text-[#475569] uppercase tracking-wider">
              TZ offset (min)
              <input
                type="number"
                value={tzOffset}
                onChange={(e) => setTzOffset(e.target.value)}
                step="30"
                className="ml-2 w-20 rounded bg-[#0a0e1a] border border-[#1f2937] text-[#e2e8f0] text-xs px-2 py-1 focus:outline-none"
                title="Offset del broker contra UTC en minutos. GMT+2 = 120, GMT+3 = 180. Default 0 (UTC)."
              />
            </label>
            <button
              type="button"
              onClick={runAll}
              disabled={running || entries.length === 0}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#22d3ee] hover:bg-[#1ab8d2] text-[#0a0e1a] text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {running ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {running ? "Importando…" : "Importar todos"}
            </button>
          </div>

          {entries.length > 0 && (
            <div className="border border-[#1f2937] rounded-lg overflow-hidden">
              <table className="w-full text-[10px] font-mono">
                <thead className="text-[#475569] bg-[#151b28]">
                  <tr>
                    <th className="text-left py-1 px-2">Archivo</th>
                    <th className="text-left py-1 px-2">Símbolo</th>
                    <th className="text-left py-1 px-2">TF</th>
                    <th className="text-right py-1 px-2">Estado</th>
                    <th className="text-right py-1 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i} className="border-t border-[#1f2937]">
                      <td className="py-1 px-2 text-[#94a3b8] truncate max-w-[200px]" title={e.file.name}>
                        <span className="inline-flex items-center gap-1"><FileText size={10} /> {e.file.name}</span>
                      </td>
                      <td className="py-1 px-2">
                        <input
                          value={e.symbol}
                          onChange={(ev) => updateEntry(i, { symbol: ev.target.value.toUpperCase() })}
                          placeholder="?"
                          className="w-20 bg-transparent border border-[#1f2937] rounded px-1 py-0.5 text-[#e2e8f0] focus:outline-none focus:border-[#475569]"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <select
                          value={e.tf}
                          onChange={(ev) => updateEntry(i, { tf: ev.target.value as Tf })}
                          className="w-16 bg-[#0a0e1a] border border-[#1f2937] rounded px-1 py-0.5 text-[#e2e8f0] focus:outline-none"
                        >
                          <option value="">?</option>
                          {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                        </select>
                      </td>
                      <td className="py-1 px-2 text-right">
                        {e.status === "pending" && <span className="text-[#475569]">listo</span>}
                        {e.status === "uploading" && <Loader2 size={11} className="inline-block animate-spin text-[#22d3ee]" />}
                        {e.status === "ok" && (
                          <span className="text-[#34d399] inline-flex items-center gap-1">
                            <CheckCircle2 size={11} /> {e.bars} bars
                          </span>
                        )}
                        {e.status === "error" && (
                          <span className="text-[#ef4444] inline-flex items-center gap-1" title={e.message}>
                            <XCircle size={11} /> {e.message?.slice(0, 30) ?? "error"}
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeEntry(i)}
                          disabled={running}
                          className="text-[#475569] hover:text-[#ef4444] transition-colors text-[10px]"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
