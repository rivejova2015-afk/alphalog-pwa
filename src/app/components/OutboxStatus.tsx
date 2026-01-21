'use client';

import { useEffect, useState } from 'react';
import { getOfflineBridge } from '@/lib/alphacore/offline/offlineBridge';

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
        console.error('Failed to get outbox status:', error);
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
      console.log('Sync result:', result);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      const bridge = getOfflineBridge();
      const status = await bridge.getOutboxStatus();
      console.log('Retrying failed entries:', status);
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  // Don't show if no pending mutations
  if (!stats || stats.total === 0) {
    return null;
  }

  const { total, pending, synced, failed, conflicts } = stats;
  const isOnline = navigator?.onLine ?? true;

  // Determine status color and icon
  let statusColor = 'text-green-600';
  let statusBg = 'bg-green-50';
  let statusIcon = '✓';
  let statusText = 'Synced';

  if (conflicts > 0) {
    statusColor = 'text-yellow-600';
    statusBg = 'bg-yellow-50';
    statusIcon = '⚠';
    statusText = 'Conflicts';
  } else if (failed > 0) {
    statusColor = 'text-red-600';
    statusBg = 'bg-red-50';
    statusIcon = '✗';
    statusText = 'Failed';
  } else if (pending > 0) {
    statusColor = isSyncing ? 'text-blue-600' : 'text-orange-600';
    statusBg = isSyncing ? 'bg-blue-50' : 'bg-orange-50';
    statusIcon = isSyncing ? '↻' : '↑';
    statusText = isSyncing ? 'Syncing' : 'Pending';
  } else if (!isOnline) {
    statusColor = 'text-gray-600';
    statusBg = 'bg-gray-50';
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
        <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-40">
          <div className="p-4">
            {/* Status Summary */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-800 mb-3">
                📊 Outbox Status
              </h3>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-blue-50 p-2 rounded">
                  <span className="text-gray-600">Total</span>
                  <p className="font-bold text-blue-700 text-lg">{total}</p>
                </div>
                <div className="bg-green-50 p-2 rounded">
                  <span className="text-gray-600">Synced</span>
                  <p className="font-bold text-green-700 text-lg">{synced}</p>
                </div>
                <div className="bg-orange-50 p-2 rounded">
                  <span className="text-gray-600">Pending</span>
                  <p className="font-bold text-orange-700 text-lg">{pending}</p>
                </div>
                <div className="bg-red-50 p-2 rounded">
                  <span className="text-gray-600">Failed</span>
                  <p className="font-bold text-red-700 text-lg">{failed}</p>
                </div>
                {conflicts > 0 && (
                  <div className="col-span-2 bg-yellow-50 p-2 rounded">
                    <span className="text-gray-600">Conflicts</span>
                    <p className="font-bold text-yellow-700 text-lg">
                      {conflicts}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Status Indicator */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <div className="text-xs">
                <p className="text-gray-600 mb-1">
                  {isOnline ? '🟢 Online' : '🔴 Offline'}
                </p>
                {lastSyncTime && (
                  <p className="text-gray-600 text-xs">
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
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
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
                  className="w-full px-3 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition"
                >
                  🔄 Retry Failed ({failed})
                </button>
              )}

              {conflicts > 0 && (
                <button
                  onClick={() => {
                    // TODO: Navigate to conflict resolution UI
                    console.log('Navigate to conflicts');
                  }}
                  className="w-full px-3 py-2 bg-yellow-600 text-white text-sm font-medium rounded hover:bg-yellow-700 transition"
                >
                  ⚠️ Resolve Conflicts ({conflicts})
                </button>
              )}

              {!isOnline && (
                <div className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded text-center">
                  ⊘ Waiting for connection...
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600">
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
