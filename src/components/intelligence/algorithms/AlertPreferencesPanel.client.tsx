"use client";

// Compact, collapsible settings panel for user-configurable alert
// thresholds (Wave 5 item 22 — first cut: coinarb-heartbeat only). Reads/
// writes /api/algorithms/alert-preferences.

import { useEffect, useState } from "react";
import { Bell, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Preferences {
  coinarb_heartbeat_stale_sec: number;
  coinarb_heartbeat_dedup_minutes: number;
}

export function AlertPreferencesPanel() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || prefs) return;
    fetch("/api/algorithms/alert-preferences", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        setPrefs(json.preferences);
        setIsDefault(Boolean(json.isDefault));
      })
      .catch(() => toast.error("No se pudieron cargar las preferencias de alertas"));
  }, [open, prefs]);

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await fetch("/api/algorithms/alert-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Error al guardar");
        return;
      }
      setPrefs(json.preferences);
      setIsDefault(false);
      toast.success("Preferencias de alertas guardadas");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-[#151b28] border border-[#1f2937] rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Bell size={13} /> Alertas
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#1f2937] pt-3">
          <p className="text-[10px] text-[#475569] leading-relaxed">
            Umbrales de heartbeat de Coinarb (crypto). El resto de los crons de monitoreo
            (MT5, SLO) siguen usando defaults fijos por ahora.
          </p>
          {!prefs ? (
            <div className="h-16 bg-slate-800/40 rounded animate-pulse" />
          ) : (
            <>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  Heartbeat stale (segundos) {isDefault && <span className="text-slate-600">— default</span>}
                </span>
                <input
                  type="number"
                  min={60}
                  max={3600}
                  value={prefs.coinarb_heartbeat_stale_sec}
                  onChange={(e) => setPrefs({ ...prefs, coinarb_heartbeat_stale_sec: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 rounded bg-[#0a0e1a] border border-[#1f2937] text-slate-100 text-sm focus:border-cyan-700 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  Ventana de dedup (minutos)
                </span>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={prefs.coinarb_heartbeat_dedup_minutes}
                  onChange={(e) => setPrefs({ ...prefs, coinarb_heartbeat_dedup_minutes: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 rounded bg-[#0a0e1a] border border-[#1f2937] text-slate-100 text-sm focus:border-cyan-700 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
