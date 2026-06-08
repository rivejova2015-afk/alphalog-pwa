'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getOfflineBridge } from '@/lib/alphacore/offline/offlineBridge';
import { logError, logInfo } from '@/lib/log';

/**
 * Outbox Status Badge Component
 * 
 * Shows offline queue status:
 * - Number of pending mutations
 * - Sync status (idle, syncing, conflicts)
 * - Manual sync and retry buttons
 * 
 * Usage:
 * <OutboxStatus />
 */
interface OutboxStats {
  total: number;
  pending: number;
  synced: number;
  failed: number;
  conflicts: number;
  oldestCreatedAt?: number;
}

export default function OutboxStatus() {
  const router = useRouter();
  const [stats, setStats] = useState<OutboxStats | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Poll outbox status every 2 seconds
  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const bridge = getOfflineBridge();
        const status = await bridge.getOutboxStatus();
        if (isMounted) {
          setStats(status);
        }
      } catch (error) {
        logError('OutboxStatus', { component: 'outboxStatus.fetch', message: 'Failed to get outbox status', error: error instanceof Error ? error.message : String(error) });
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const bridge = getOfflineBridge();
      const result = await bridge.syncNow();
      setLastSyncTime(new Date());
      logInfo('OutboxStatus', 'Sync result', { component: 'outboxStatus.syncNow.result', payload: result as unknown as Record<string, unknown> });
    } catch (error) {
      logError('OutboxStatus', { component: 'outboxStatus.syncNow.failed', message: 'Sync failed', error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      const bridge = getOfflineBridge();
      const status = await bridge.getOutboxStatus();
      logInfo('OutboxStatus', 'Retrying failed entries', { component: 'outboxStatus.retry', payload: status as unknown as Record<string, unknown> });
    } catch (error) {
      logError('OutboxStatus', { component: 'outboxStatus.retry.failed', message: 'Retry failed', error: error instanceof Error ? error.message : String(error) });
    }
  };

  // Don't show if no pending mutations
  if (!stats || stats.total === 0) {
    return null;
  }

  const { total, pending, synced, failed, conflicts } = stats;
  const isOnline = navigator?.onLine ?? true;

  // Determine status color and icon
  let statusColor = 'text-emerald-200';
  let statusBg = 'bg-emerald-600/10';
  let statusIcon = '✓';
  let statusText = 'Synced';

  if (conflicts > 0) {
    statusColor = 'text-amber-200';
    statusBg = 'bg-amber-600/10';
    statusIcon = '⚠';
    statusText = 'Conflicts';
  } else if (failed > 0) {
    statusColor = 'text-red-200';
    statusBg = 'bg-red-600/10';
    statusIcon = '✗';
    statusText = 'Failed';
  } else if (pending > 0) {
    statusColor = isSyncing ? 'text-blue-200' : 'text-amber-200';
    statusBg = isSyncing ? 'bg-blue-600/10' : 'bg-amber-600/10';
    statusIcon = isSyncing ? '↻' : '↑';
    statusText = isSyncing ? 'Syncing' : 'Pending';
  } else if (!isOnline) {
    statusColor = 'text-slate-300';
    statusBg = 'bg-slate-800/60';
    statusIcon = '⊘';
    statusText = 'Offline';
  }

  return (
    <div className="relative inline-block">
      {/* Badge Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`${statusBg} ${statusColor} px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-80 transition border border-current border-opacity-20`}
      >
        <span className={isSyncing ? 'animate-spin' : ''}>{statusIcon}</span>
        <span>{statusText}</span>
        {total > 0 && (
          <span className="ml-2 px-2 py-0.5 bg-current bg-opacity-10 rounded text-xs font-bold">
            {total}
          </span>
        )}
      </button>

      {/* Details Menu */}
      {showMenu && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-900/90 border border-slate-700/60 rounded-2xl shadow-[0_18px_40px_rgba(2,4,10,0.5)] z-40">
          <div className="p-4">
            {/* Status Summary */}
            <div className="mb-4 pb-4 border-b border-slate-700/60">
              <h3 className="text-sm font-bold text-slate-100 mb-3">
                📊 Outbox Status
              </h3>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-blue-600/10 border border-blue-500/30 p-2 rounded-lg">
                  <span className="text-slate-400">Total</span>
                  <p className="font-bold text-blue-200 text-lg">{total}</p>
                </div>
                <div className="bg-emerald-600/10 border border-emerald-500/30 p-2 rounded-lg">
                  <span className="text-slate-400">Synced</span>
                  <p className="font-bold text-emerald-200 text-lg">{synced}</p>
                </div>
                <div className="bg-amber-600/10 border border-amber-500/30 p-2 rounded-lg">
                  <span className="text-slate-400">Pending</span>
                  <p className="font-bold text-amber-200 text-lg">{pending}</p>
                </div>
                <div className="bg-red-600/10 border border-red-500/30 p-2 rounded-lg">
                  <span className="text-slate-400">Failed</span>
                  <p className="font-bold text-red-200 text-lg">{failed}</p>
                </div>
                {conflicts > 0 && (
                  <div className="col-span-2 bg-amber-600/10 border border-amber-500/30 p-2 rounded-lg">
                    <span className="text-slate-400">Conflicts</span>
                    <p className="font-bold text-amber-200 text-lg">
                      {conflicts}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Status Indicator */}
            <div className="mb-4 pb-4 border-b border-slate-700/60">
              <div className="text-xs">
                <p className="text-slate-400 mb-1">
                  {isOnline ? '🟢 Online' : '🔴 Offline'}
                </p>
                {lastSyncTime && (
                  <p className="text-slate-400 text-xs">
                    Last sync: {lastSyncTime.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {pending > 0 && isOnline && (
                <button
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 bg-blue-600 text-slate-950 text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {isSyncing ? (
                    <>
                      <span className="animate-spin">↻</span>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <span>↑</span>
                      Sync Now
                    </>
                  )}
                </button>
              )}

              {failed > 0 && isOnline && (
                <button
                  onClick={handleRetryFailed}
                  className="w-full px-3 py-2 bg-red-600 text-slate-950 text-sm font-medium rounded-lg hover:bg-red-700 transition"
                >
                  🔄 Retry Failed ({failed})
                </button>
              )}

              {conflicts > 0 && (
                <button
                  onClick={() => router.push('/dashboard/conflicts')}
                  className="w-full px-3 py-2 bg-amber-600 text-slate-950 text-sm font-medium rounded-lg hover:bg-amber-700 transition"
                >
                  ⚠️ Resolve Conflicts ({conflicts})
                </button>
              )}

              {!isOnline && (
                <div className="px-3 py-2 bg-slate-900/70 border border-slate-700/60 text-slate-300 text-sm rounded text-center">
                  ⊘ Waiting for connection...
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="mt-4 pt-4 border-t border-slate-700/60 text-xs text-slate-400">
              <p>
                Mutations are automatically synced when you go online.
                <br />
                Use &quot;Sync Now&quot; to force an immediate sync.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showMenu && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}
