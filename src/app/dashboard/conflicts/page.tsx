'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle, RefreshCw, ArrowLeft, RotateCw, Clipboard } from 'lucide-react';
import { toast } from 'sonner';
import { getOutboxManager } from '@/lib/alphacore/offline/outbox';
import type { IDBOutboxEntry } from '@/lib/alphacore/offline/idb';

/**
 * Conflicts resolution page.
 *
 * A conflict appears when an outbox entry exhausts its retry budget against
 * a server-side error (typically 409/412 — the server has a newer version).
 * Three resolutions are offered:
 *   - "Usar versión del servidor": discard the local change, the row server-
 *     side wins. Implemented via OutboxManager.resolveConflict(id, 'server').
 *   - "Forzar versión local": re-queue with status='pending', the local
 *     payload will be retried next sync. Implemented via OutboxManager.resolveConflict(id, 'local').
 *   - "Reintentar ahora": same payload, immediate sync attempt. Useful when
 *     the conflict was actually a transient 5xx, not a real version mismatch.
 *     Implemented via OutboxManager.retryEntry(id).
 *
 * We intentionally do NOT show a side-by-side diff vs the server payload:
 * fetching the "current server state" would require a table → endpoint
 * mapping that doesn't scale with the 69 tables and would bit-rot every
 * time the API shape changes. The metadata we surface (lastError, retries,
 * createdAt, fingerprint) is enough for the single-user owner to make the
 * call; payload preview + copy-to-clipboard covers forensic cases.
 */
export default function ConflictsPage() {
  const router = useRouter();
  const [conflicts, setConflicts] = useState<IDBOutboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);

  const fetchConflicts = useCallback(async () => {
    try {
      const mgr = getOutboxManager();
      const entries = await mgr.getConflictEntries();
      setConflicts(entries);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron cargar los conflictos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConflicts();
  }, [fetchConflicts]);

  const handleResolve = async (entryId: string, resolution: 'local' | 'server') => {
    setBusyEntryId(entryId);
    try {
      const mgr = getOutboxManager();
      await mgr.resolveConflict(entryId, resolution);
      toast.success(
        resolution === 'server'
          ? 'Cambio local descartado. Versión del servidor aplicada.'
          : 'Cambio local re-encolado para sincronización.'
      );
      await fetchConflicts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo resolver el conflicto');
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleRetry = async (entryId: string) => {
    setBusyEntryId(entryId);
    try {
      const mgr = getOutboxManager();
      await mgr.retryEntry(entryId);
      toast.success('Reintento exitoso. Conflicto resuelto.');
      await fetchConflicts();
    } catch (err) {
      // retryEntry throws on failure but keeps the entry in conflict/failed
      // status — surface the error and let the user pick local/server.
      toast.error(
        err instanceof Error
          ? `El reintento falló: ${err.message}`
          : 'El reintento falló. Elegí "Usar servidor" o "Forzar local".'
      );
      await fetchConflicts();
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleCopyPayload = async (entry: IDBOutboxEntry) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry.payload, null, 2));
      toast.success('Payload copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar el payload');
    }
  };

  const handleResolveAllAsServer = async () => {
    // Sequential to keep ordering predictable and surface per-entry errors.
    for (const conflict of conflicts) {
      // eslint-disable-next-line no-await-in-loop
      await handleResolve(conflict.id, 'server');
    }
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

  const endpointLabel = (entry: IDBOutboxEntry): string => {
    const endpoint = entry.metadata?.endpoint;
    if (typeof endpoint === 'string' && endpoint.length > 0) return endpoint;
    return `/api/alphacore/${entry.table}/${entry.operation}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-slate-800 transition text-slate-400 hover:text-slate-100"
            aria-label="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <AlertTriangle size={22} className="text-amber-400" />
            <h1 className="text-xl font-semibold text-slate-100">Conflictos de sincronización</h1>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-400 mb-6">
          Estos cambios locales no se pudieron sincronizar porque el servidor ya tiene una versión más reciente,
          o porque agotaron los reintentos contra un error transitorio.
          {' '}
          <span className="text-slate-300">Reintentá</span> si pensás que fue un error pasajero,
          o elegí qué versión conservar.
        </p>

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
            <p className="text-slate-500 text-sm mt-1">Todo está sincronizado correctamente.</p>
            <button
              onClick={() => router.back()}
              className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg transition"
            >
              Volver
            </button>
          </div>
        )}

        {/* Conflict list */}
        {!loading && conflicts.length > 0 && (
          <div className="space-y-4">
            {conflicts.map((entry) => {
              const isBusy = busyEntryId === entry.id;
              return (
                <article
                  key={entry.id}
                  className="bg-slate-900 border border-amber-700/40 rounded-xl p-5"
                  aria-busy={isBusy}
                >
                  {/* Entry meta */}
                  <header className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono bg-slate-800 text-amber-300 px-2 py-0.5 rounded">
                        {entry.table}
                      </span>
                      <span className="text-xs text-slate-400 capitalize">{entry.operation}</span>
                      <span className="text-xs text-slate-500 font-mono">
                        {endpointLabel(entry)}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                  </header>

                  {/* Retry / fingerprint info */}
                  <div className="mb-3 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Reintentos: {entry.retryCount ?? 0}/{entry.maxRetries ?? '?'}</span>
                    {entry.metadata?.fingerprint && (
                      <span className="font-mono">fp: {String(entry.metadata.fingerprint).slice(0, 12)}</span>
                    )}
                  </div>

                  {/* Payload preview */}
                  <div className="bg-slate-800/60 rounded-lg p-3 mb-3 text-xs font-mono text-slate-300 max-h-40 overflow-y-auto">
                    <pre className="whitespace-pre-wrap break-all">
                      {JSON.stringify(entry.payload, null, 2)}
                    </pre>
                  </div>

                  <div className="mb-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleCopyPayload(entry)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition"
                      aria-label="Copiar payload al portapapeles"
                    >
                      <Clipboard size={12} />
                      Copiar payload
                    </button>
                  </div>

                  {/* Error message */}
                  {entry.lastError && (
                    <p className="text-xs text-red-400 mb-3 break-words">
                      <span className="font-semibold">Último error:</span> {entry.lastError}
                    </p>
                  )}

                  {/* Resolution actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleRetry(entry.id)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCw size={14} className={isBusy ? 'animate-spin' : ''} />
                      Reintentar ahora
                    </button>
                    <button
                      onClick={() => void handleResolve(entry.id, 'server')}
                      disabled={isBusy}
                      className="flex-1 min-w-[10rem] px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Usar versión del servidor
                    </button>
                    <button
                      onClick={() => void handleResolve(entry.id, 'local')}
                      disabled={isBusy}
                      className="flex-1 min-w-[10rem] px-3 py-2 bg-amber-700 hover:bg-amber-600 text-slate-950 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Forzar versión local
                    </button>
                  </div>
                </article>
              );
            })}

            {/* Resolve all as server */}
            {conflicts.length > 1 && (
              <button
                onClick={() => void handleResolveAllAsServer()}
                disabled={busyEntryId !== null}
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
