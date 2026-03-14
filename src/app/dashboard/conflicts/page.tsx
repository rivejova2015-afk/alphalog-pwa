'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { getOutboxManager } from '@/lib/alphacore/offline/outbox';
import type { IDBOutboxEntry } from '@/lib/alphacore/offline/idb';

export default function ConflictsPage() {
  const router = useRouter();
  const [conflicts, setConflicts] = useState<IDBOutboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConflicts = useCallback(async () => {
    try {
      const mgr = getOutboxManager();
      const entries = await mgr.getConflictEntries();
      setConflicts(entries);
    } catch (err) {
      console.error('[ConflictsPage] Failed to load conflicts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  const handleResolve = async (entryId: string, resolution: 'local' | 'server') => {
    setResolving(entryId);
    setMessage(null);
    try {
      const mgr = getOutboxManager();
      await mgr.resolveConflict(entryId, resolution);
      setMessage({
        type: 'success',
        text: resolution === 'server'
          ? 'Cambio local descartado. Version del servidor aplicada.'
          : 'Cambio local re-encolado para sincronizacion.',
      });
      await fetchConflicts();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error desconocido' });
    } finally {
      setResolving(null);
    }
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-slate-800 transition text-slate-400 hover:text-slate-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <AlertTriangle size={22} className="text-amber-400" />
            <h1 className="text-xl font-semibold text-slate-100">Conflictos de Sincronizacion</h1>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-400 mb-6">
          Estos cambios locales no se pudieron sincronizar porque el servidor ya tiene una version mas reciente.
          Elige que version conservar para cada conflicto.
        </p>

        {/* Feedback message */}
        {message && (
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-6 text-sm ${
              message.type === 'success'
                ? 'bg-emerald-900/40 border border-emerald-700/50 text-emerald-200'
                : 'bg-red-900/40 border border-red-700/50 text-red-200'
            }`}
          >
            {message.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {message.text}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw size={20} className="animate-spin mr-2" />
            Cargando conflictos...
          </div>
        )}

        {/* Empty state */}
        {!loading && conflicts.length === 0 && (
          <div className="text-center py-16">
            <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">No hay conflictos pendientes</p>
            <p className="text-slate-500 text-sm mt-1">Todo esta sincronizado correctamente.</p>
            <button
              onClick={() => router.back()}
              className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg transition"
            >
              Volver al Dashboard
            </button>
          </div>
        )}

        {/* Conflict list */}
        {!loading && conflicts.length > 0 && (
          <div className="space-y-4">
            {conflicts.map((entry) => (
              <div
                key={entry.id}
                className="bg-slate-900 border border-amber-700/40 rounded-xl p-5"
              >
                {/* Entry meta */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs font-mono bg-slate-800 text-amber-300 px-2 py-0.5 rounded">
                      {entry.table}
                    </span>
                    <span className="ml-2 text-xs text-slate-400 capitalize">{entry.operation}</span>
                  </div>
                  <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                </div>

                {/* Payload preview */}
                <div className="bg-slate-800/60 rounded-lg p-3 mb-4 text-xs font-mono text-slate-300 max-h-32 overflow-y-auto">
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(entry.payload, null, 2)}
                  </pre>
                </div>

                {/* Error message */}
                {entry.lastError && (
                  <p className="text-xs text-red-400 mb-3">
                    Error: {entry.lastError}
                  </p>
                )}

                {/* Resolution actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleResolve(entry.id, 'server')}
                    disabled={resolving === entry.id}
                    className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resolving === entry.id ? (
                      <RefreshCw size={14} className="animate-spin mx-auto" />
                    ) : (
                      'Usar version del servidor'
                    )}
                  </button>
                  <button
                    onClick={() => handleResolve(entry.id, 'local')}
                    disabled={resolving === entry.id}
                    className="flex-1 px-3 py-2 bg-amber-700 hover:bg-amber-600 text-slate-950 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resolving === entry.id ? (
                      <RefreshCw size={14} className="animate-spin mx-auto" />
                    ) : (
                      'Forzar version local'
                    )}
                  </button>
                </div>
              </div>
            ))}

            {/* Resolve all as server */}
            {conflicts.length > 1 && (
              <button
                onClick={async () => {
                  for (const c of conflicts) {
                    await handleResolve(c.id, 'server');
                  }
                }}
                disabled={resolving !== null}
                className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition disabled:opacity-50"
              >
                Descartar todos (usar servidor)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
