"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { JournalEntryForm } from "@/components/journal/JournalEntryForm.client";
import { JournalEntryList } from "@/components/journal/JournalEntryList.client";
import type { JournalEntry } from "@/lib/alphacore/contracts";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export default function JournalPTWorkspace() {
  const [loadingUser, setLoadingUser] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (mounted) {
          setUserId(user?.id ?? null);
        }
      } finally {
        if (mounted) {
          setLoadingUser(false);
        }
      }
    };

    void loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const listKey = useMemo(() => `${userId || "guest"}:${refreshToken}`, [refreshToken, userId]);

  if (loadingUser) {
    return (
      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6 text-slate-400">
        Cargando Journal PT...
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="rounded-2xl border border-amber-800/70 bg-amber-950/20 p-6 text-amber-200">
        Sesion no disponible. Inicia sesion para usar Journal PT.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold text-slate-100">Journal PT Workspace</h2>
        <p className="mt-1 text-sm text-slate-400">
          Registra sesiones, emociones y acciones para mejorar consistencia.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Nueva entrada
          </h3>
          <JournalEntryForm
            userId={userId}
            onSuccess={() => {
              setRefreshToken((prev) => prev + 1);
            }}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Entradas recientes
            </h3>
            <JournalEntryList
              key={listKey}
              userId={userId}
              onSelectEntry={(entry) => setSelectedEntry(entry)}
            />
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Detalle
            </h3>
            {!selectedEntry ? (
              <p className="text-sm text-slate-400">
                Selecciona una entrada para ver su detalle.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-slate-300 whitespace-pre-wrap">{selectedEntry.text}</p>
                <p className="text-slate-500">Fecha: {formatDate(selectedEntry.created_at)}</p>
                {selectedEntry.mood && (
                  <p className="text-slate-500">Mood: {selectedEntry.mood}</p>
                )}
                {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedEntry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-slate-700/70 bg-slate-800/80 px-2 py-0.5 text-xs text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
