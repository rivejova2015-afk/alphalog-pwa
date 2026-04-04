"use client";

import { useEffect, useState } from "react";
import { Bot, Trash2, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type MemoryItem = {
  id: string;
  memory_type: string;
  content: string;
  importance_score: number;
  asset: string | null;
  created_at: string;
};

type Settings = {
  assistant_name: string;
  default_asset: "XAUUSD" | "US500";
};

const TYPE_LABELS: Record<string, string> = {
  pattern: "Patrón",
  preference: "Preferencia",
  error: "Error recurrente",
  insight: "Insight",
  style: "Estilo",
};

const TYPE_COLORS: Record<string, string> = {
  pattern: "text-blue-400 bg-blue-900/30",
  preference: "text-purple-400 bg-purple-900/30",
  error: "text-red-400 bg-red-900/30",
  insight: "text-emerald-400 bg-emerald-900/30",
  style: "text-amber-400 bg-amber-900/30",
};

export default function AssistantSettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    assistant_name: "AlphaAnalyst",
    default_asset: "XAUUSD",
  });
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingMemory, setLoadingMemory] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    fetch("/api/terminal/assistant/settings")
      .then((r) => r.json())
      .then((d) => { if (d.settings) setSettings(d.settings as Settings); })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));

    fetch("/api/terminal/assistant/memory")
      .then((r) => r.json())
      .then((d) => { if (d.memory) setMemory(d.memory as MemoryItem[]); })
      .catch(() => {})
      .finally(() => setLoadingMemory(false));
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/terminal/assistant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) toast.success("Configuración guardada");
      else toast.error("Error al guardar");
    } catch {
      toast.error("Error de red");
    } finally {
      setSavingSettings(false);
    }
  };

  const deleteMemoryItem = async (id: string) => {
    try {
      await fetch(`/api/terminal/assistant/memory?id=${id}`, { method: "DELETE" });
      setMemory((prev) => prev.filter((m) => m.id !== id));
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const deleteAllMemory = async () => {
    if (!confirm("¿Eliminar toda la memoria del asistente? Esta acción no se puede deshacer.")) return;
    setDeletingAll(true);
    try {
      const res = await fetch("/api/terminal/assistant/memory?all=true", { method: "DELETE" });
      if (res.ok) {
        setMemory([]);
        toast.success("Memoria borrada");
      } else {
        toast.error("Error al borrar");
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setDeletingAll(false);
    }
  };

  const counts = memory.reduce<Record<string, number>>((acc, m) => {
    acc[m.memory_type] = (acc[m.memory_type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/terminal"
          className="text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Volver al terminal"
        >
          <ArrowLeft size={18} />
        </Link>
        <Bot size={20} className="text-emerald-400" />
        <h1 className="text-lg font-semibold">Configuración del Asistente</h1>
      </div>

      {/* Settings section */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Preferencias</h2>
        {loadingSettings ? (
          <p className="text-sm text-slate-500">Cargando...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5" htmlFor="assistant-name">
                Nombre del asistente
              </label>
              <input
                id="assistant-name"
                type="text"
                value={settings.assistant_name}
                onChange={(e) => setSettings((s) => ({ ...s, assistant_name: e.target.value }))}
                maxLength={50}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-700 transition-colors"
                placeholder="AlphaAnalyst"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5" htmlFor="default-asset">
                Instrumento por defecto
              </label>
              <select
                id="default-asset"
                value={settings.default_asset}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    default_asset: e.target.value as "XAUUSD" | "US500",
                  }))
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-700 transition-colors"
              >
                <option value="XAUUSD">XAUUSD (Gold)</option>
                <option value="US500">US500 (S&amp;P 500)</option>
              </select>
            </div>
            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 text-sm rounded-lg border border-emerald-800/40 disabled:opacity-40 transition-colors"
            >
              <Save size={14} />
              {savingSettings ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}
      </section>

      {/* Memory section */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-300">Memoria del Trader</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {memory.length} {memory.length === 1 ? "item" : "items"} ·{" "}
              {Object.entries(counts)
                .map(([type, count]) => `${count} ${TYPE_LABELS[type] ?? type}`)
                .join(" · ")}
            </p>
          </div>
          {memory.length > 0 && (
            <button
              onClick={deleteAllMemory}
              disabled={deletingAll}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 disabled:opacity-40 transition-colors"
            >
              <Trash2 size={13} />
              {deletingAll ? "Borrando..." : "Borrar todo"}
            </button>
          )}
        </div>

        {loadingMemory ? (
          <p className="text-sm text-slate-500">Cargando...</p>
        ) : memory.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            Sin memoria registrada aún. El asistente aprende de tus conversaciones.
          </p>
        ) : (
          <div className="space-y-2">
            {memory.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 bg-slate-800/60 rounded-lg group"
              >
                <span
                  className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    TYPE_COLORS[item.memory_type] ?? "text-slate-400 bg-slate-700"
                  }`}
                >
                  {TYPE_LABELS[item.memory_type] ?? item.memory_type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 leading-relaxed">{item.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-600">
                      Importancia: {item.importance_score}
                    </span>
                    {item.asset && (
                      <span className="text-[10px] text-slate-600">· {item.asset}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteMemoryItem(item.id)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                  aria-label="Eliminar este item de memoria"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
