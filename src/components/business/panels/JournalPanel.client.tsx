// src/components/business/panels/JournalPanel.client.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, ChevronDown, ChevronUp, CloudOff } from "lucide-react";
import {
  enqueueOfflineMutation,
  getPendingForTable,
  isNetworkError,
} from "@/lib/alphacore/offline/networkFallback";
import { deleteOutboxEntry } from "@/lib/alphacore/offline/idb";
import type { IDBOutboxEntry } from "@/lib/alphacore/offline/idb";

type Mood = "excellent" | "good" | "neutral" | "bad" | "terrible";

interface JournalEntry {
  id: string;
  text: string;
  mood: Mood | null;
  mood_score: number | null;
  tags: string[] | null;
  lessons_learned: string | null;
  action_items: string[] | null;
  market_conditions: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

interface EntryForm {
  text: string;
  mood: Mood | "";
  mood_score: number;
  tags: string;
  lessons_learned: string;
  action_items: string;
  market_conditions: string;
}

const INITIAL_FORM: EntryForm = {
  text: "",
  mood: "",
  mood_score: 5,
  tags: "",
  lessons_learned: "",
  action_items: "",
  market_conditions: "",
};

const MOOD_LABELS: Record<Mood, { label: string; color: string; emoji: string }> = {
  excellent: { label: "Excelente", color: "text-emerald-400", emoji: "🔥" },
  good: { label: "Bueno", color: "text-green-400", emoji: "😊" },
  neutral: { label: "Neutral", color: "text-slate-400", emoji: "😐" },
  bad: { label: "Malo", color: "text-yellow-400", emoji: "😕" },
  terrible: { label: "Terrible", color: "text-red-400", emoji: "😞" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Marker injected into the optimistic id so the rest of the component can
// tell server-backed rows from outbox-pending rows without a separate flag.
const PENDING_ID_PREFIX = "pending:";

function isPendingId(id: string): boolean {
  return id.startsWith(PENDING_ID_PREFIX);
}

function outboxEntryToOptimistic(entry: IDBOutboxEntry): JournalEntry {
  const p = (entry.payload || {}) as Partial<{
    text: string;
    mood: Mood;
    mood_score: number;
    tags: string[];
    lessons_learned: string;
    action_items: string[];
    market_conditions: string;
    is_private: boolean;
  }>;
  const createdAtIso = new Date(entry.createdAt).toISOString();
  return {
    id: `${PENDING_ID_PREFIX}${entry.id}`,
    text: typeof p.text === "string" ? p.text : "",
    mood: (p.mood as Mood) ?? null,
    mood_score: typeof p.mood_score === "number" ? p.mood_score : null,
    tags: Array.isArray(p.tags) ? p.tags : null,
    lessons_learned: typeof p.lessons_learned === "string" ? p.lessons_learned : null,
    action_items: Array.isArray(p.action_items) ? p.action_items : null,
    market_conditions: typeof p.market_conditions === "string" ? p.market_conditions : null,
    is_private: p.is_private ?? false,
    created_at: createdAtIso,
    updated_at: createdAtIso,
  };
}

export default function JournalPanel() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [pendingEntries, setPendingEntries] = useState<IDBOutboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EntryForm>(INITIAL_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refreshPending = useCallback(async () => {
    try {
      const pending = await getPendingForTable("journal_entries");
      setPendingEntries(pending);
    } catch {
      // Reading the outbox is best-effort — never block the UI on it.
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/journal");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      toast.error("No se pudieron cargar las entradas del diario");
    } finally {
      setLoading(false);
    }
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  // Watch for connection restored — give the outbox a few seconds to drain,
  // then refresh both server entries and the pending list so the UI flips
  // optimistic rows back to real ones automatically.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      window.setTimeout(() => void fetchEntries(), 3500);
    };
    window.addEventListener("online", onOnline);
    // Poll the outbox periodically so successful background syncs flush
    // the pending badge even without an `online` event (eg. flaky wifi
    // that stays "online" but recovers a hung request).
    const intervalId = window.setInterval(() => void refreshPending(), 7000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(intervalId);
    };
  }, [fetchEntries, refreshPending]);

  const optimisticEntries = useMemo(
    () => pendingEntries.map(outboxEntryToOptimistic),
    [pendingEntries]
  );

  // Merged view: pending rows on top (most recent intent first), then server.
  const allEntries = useMemo(
    () => [...optimisticEntries, ...entries],
    [optimisticEntries, entries]
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.text.trim()) {
      toast.error("El texto del diario es obligatorio");
      return;
    }
    const payload = {
      text: form.text.trim(),
      mood: form.mood || undefined,
      mood_score: form.mood_score || undefined,
      tags: form.tags
        ? form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      lessons_learned: form.lessons_learned.trim() || undefined,
      action_items: form.action_items
        ? form.action_items
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      market_conditions: form.market_conditions.trim() || undefined,
    };
    try {
      setSaving(true);
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Error al guardar");
      }
      toast.success("Entrada guardada");
      setForm(INITIAL_FORM);
      setShowForm(false);
      await fetchEntries();
    } catch (err) {
      // Network failure (offline, captive portal, etc.) → enqueue so the
      // OutboxManager drains it the moment connectivity is back. Anything
      // that isn't a transport error is a real server-side problem and
      // re-queueing it would just fail again on sync.
      if (isNetworkError(err)) {
        try {
          await enqueueOfflineMutation({
            endpoint: "/api/journal",
            method: "POST",
            table: "journal_entries",
            payload: payload as Record<string, unknown>,
            operation: "create",
          });
          await refreshPending();
          setForm(INITIAL_FORM);
          setShowForm(false);
          toast.info("Sin conexión — se guardó offline y se sincronizará al volver.");
        } catch {
          toast.error("No hay red y tampoco se pudo guardar offline.");
        }
      } else {
        toast.error(err instanceof Error ? err.message : "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    // Pending entries live only in the IDB outbox — there's no server row to
    // delete yet, so we just cancel the outbox enqueue.
    if (isPendingId(id)) {
      const outboxId = id.slice(PENDING_ID_PREFIX.length);
      try {
        await deleteOutboxEntry(outboxId);
        setConfirmDeleteId(null);
        toast.success("Entrada pendiente descartada");
        await refreshPending();
      } catch {
        toast.error("No se pudo descartar la entrada pendiente");
      }
      return;
    }

    try {
      const res = await fetch(`/api/journal`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Error al eliminar");
      setConfirmDeleteId(null);
      toast.success("Entrada eliminada");
      await fetchEntries();
    } catch (err) {
      if (isNetworkError(err)) {
        try {
          await enqueueOfflineMutation({
            endpoint: "/api/journal",
            method: "DELETE",
            table: "journal_entries",
            payload: { id },
            operation: "delete",
          });
          setConfirmDeleteId(null);
          // Hide the row immediately so the user sees the delete intent
          // reflected — it will reconcile when the outbox drains.
          setEntries((prev) => prev.filter((entry) => entry.id !== id));
          toast.info("Sin conexión — el borrado se sincronizará al volver.");
        } catch {
          toast.error("No hay red y tampoco se pudo encolar el borrado.");
        }
      } else {
        toast.error("No se pudo eliminar la entrada");
      }
    }
  }

  function setField<K extends keyof EntryForm>(key: K, value: EntryForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-slate-400" />
          <div>
            <h2 className="text-xl font-semibold text-slate-50">Diario de Trading</h2>
            <p className="text-sm text-slate-400">
              Registra reflexiones, aprendizajes y estado de ánimo.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Nueva entrada
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={(e) => void handleSave(e)}
          className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5 space-y-4"
        >
          <h3 className="text-base font-semibold text-slate-100">Nueva entrada</h3>

          {/* Text */}
          <label className="block text-sm text-slate-300">
            Entrada *
            <textarea
              value={form.text}
              onChange={(e) => setField("text", e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 resize-y"
              placeholder="¿Qué pasó hoy? ¿Cómo te fue en el trading?"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Mood */}
            <label className="block text-sm text-slate-300">
              Estado de ánimo
              <select
                value={form.mood}
                onChange={(e) => setField("mood", e.target.value as Mood | "")}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">— Sin especificar</option>
                {(Object.entries(MOOD_LABELS) as [Mood, (typeof MOOD_LABELS)[Mood]][]).map(
                  ([key, { label, emoji }]) => (
                    <option key={key} value={key}>
                      {emoji} {label}
                    </option>
                  )
                )}
              </select>
            </label>

            {/* Mood score */}
            <label className="block text-sm text-slate-300">
              Puntuación ({form.mood_score}/10)
              <input
                type="range"
                min={1}
                max={10}
                value={form.mood_score}
                onChange={(e) => setField("mood_score", Number(e.target.value))}
                className="mt-3 w-full accent-blue-500"
              />
            </label>

            {/* Tags */}
            <label className="block text-sm text-slate-300">
              Tags (separados por coma)
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setField("tags", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
                placeholder="disciplina, risk_management, FOMO"
              />
            </label>

            {/* Market conditions */}
            <label className="block text-sm text-slate-300">
              Condiciones de mercado
              <input
                type="text"
                value={form.market_conditions}
                onChange={(e) => setField("market_conditions", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
                placeholder="Tendencia alcista, alta volatilidad..."
              />
            </label>
          </div>

          {/* Lessons learned */}
          <label className="block text-sm text-slate-300">
            Lecciones aprendidas
            <textarea
              value={form.lessons_learned}
              onChange={(e) => setField("lessons_learned", e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none"
              placeholder="¿Qué aprendiste hoy?"
            />
          </label>

          {/* Action items */}
          <label className="block text-sm text-slate-300">
            Próximos pasos (separados por coma)
            <input
              type="text"
              value={form.action_items}
              onChange={(e) => setField("action_items", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
              placeholder="Revisar límites de riesgo, backtestear setup..."
            />
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? "Guardando…" : "Guardar entrada"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(INITIAL_FORM);
              }}
              className="rounded-xl border border-slate-700 px-5 py-2 text-sm text-slate-300 hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Entries list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse h-24 rounded-2xl border border-slate-700/40 bg-slate-800/60"
            />
          ))}
        </div>
      ) : allEntries.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-8 text-center">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            Aún no hay entradas. Crea tu primera entrada del diario.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allEntries.map((entry) => {
            const moodMeta = entry.mood ? MOOD_LABELS[entry.mood] : null;
            const isExpanded = expandedId === entry.id;
            const isPending = isPendingId(entry.id);
            return (
              <div
                key={entry.id}
                className={`rounded-2xl border overflow-hidden ${
                  isPending
                    ? "border-amber-700/50 bg-amber-950/20"
                    : "border-slate-700/60 bg-slate-900/70"
                }`}
              >
                {/* Entry header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-slate-800/40 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-slate-500">{formatDate(entry.created_at)}</span>
                      {isPending && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] font-medium text-amber-300"
                          title="Esta entrada aún no se sincronizó con el servidor"
                        >
                          <CloudOff className="w-3 h-3" />
                          Sincronizando
                        </span>
                      )}
                      {moodMeta && (
                        <span className={`text-xs font-medium ${moodMeta.color}`}>
                          {moodMeta.emoji} {moodMeta.label}
                          {entry.mood_score !== null && ` · ${entry.mood_score}/10`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-200 line-clamp-2">{entry.text}</p>
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-slate-700/40 pt-4 space-y-3">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{entry.text}</p>

                    {entry.market_conditions && (
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Condiciones de mercado</p>
                        <p className="text-sm text-slate-300">{entry.market_conditions}</p>
                      </div>
                    )}

                    {entry.lessons_learned && (
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Lecciones aprendidas</p>
                        <p className="text-sm text-slate-300">{entry.lessons_learned}</p>
                      </div>
                    )}

                    {entry.action_items && entry.action_items.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Próximos pasos</p>
                        <ul className="space-y-0.5">
                          {entry.action_items.map((item, i) => (
                            <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                              <span className="text-slate-600 mt-0.5">·</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={() => setConfirmDeleteId(entry.id)}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition"
                        aria-label="Eliminar entrada"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar entrada
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación"
        >
          <div className="bg-slate-900 border border-red-800/60 rounded-xl p-5 w-full max-w-sm shadow-xl">
            <p className="text-slate-100 font-medium mb-1">¿Eliminar esta entrada?</p>
            <p className="text-slate-400 text-sm mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => void handleDelete(confirmDeleteId)}
                className="flex-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition"
              >
                Eliminar
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
