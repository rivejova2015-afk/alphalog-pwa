'use client';

/**
 * System Diagnostics Component
 * Displays current system status (SW, offline, push, outbox, etc.)
 */

import React, { useEffect, useState } from 'react';
import { getOfflineBridge } from '@/lib/alphacore/offline/offlineBridge';

interface OutboxStats {
  total: number;
  pending: number;
  synced: number;
  failed: number;
  conflicts: number;
}

interface SystemStatus {
  online: boolean;
  serviceWorkerRegistered: boolean;
  manifestDetected: boolean;
  pushPermission: string;
  pushSubscribed: boolean;
  buildVersion?: string;
  outbox?: OutboxStats;
}

export function SystemDiagnostics() {
  const [status, setStatus] = useState<SystemStatus>({
    online: true,
    serviceWorkerRegistered: false,
    manifestDetected: false,
    pushPermission: 'default',
    pushSubscribed: false,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectStatus = async () => {
      try {
        // Online status
        const online = navigator.onLine;

        // Service Worker
        let swRegistered = false;
        if (navigator.serviceWorker) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          swRegistered = registrations.length > 0;
        }

        // Manifest
        let manifestDetected = false;
        try {
          const response = await fetch('/manifest.json', { method: 'HEAD' });
          manifestDetected = response.ok;
        } catch {
          manifestDetected = false;
        }

        // Push
        const pushPermission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
        let pushSubscribed = false;
        if (navigator.serviceWorker) {
          try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            pushSubscribed = !!subscription;
          } catch {
            pushSubscribed = false;
          }
        }

        // Outbox stats
        let outboxStats: OutboxStats | undefined;
        try {
          const bridge = getOfflineBridge();
          outboxStats = await bridge.getOutboxStatus();
        } catch (error) {
          console.warn('Failed to get outbox stats:', error);
        }

        setStatus({
          online,
          serviceWorkerRegistered: swRegistered,
          manifestDetected,
          pushPermission,
          pushSubscribed,
          buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION,
          outbox: outboxStats,
        });
      } catch (error) {
        console.error('Error detecting system status:', error);
      } finally {
        setLoading(false);
      }
    };

    detectStatus();

    // Refresh outbox stats periodically
    const refreshInterval = setInterval(() => {
      getOfflineBridge()
        .getOutboxStatus()
        .then((outboxStats) => {
          setStatus((prev) => ({ ...prev, outbox: outboxStats }));
        })
        .catch(() => {
          // Silent fail
        });
    }, 5000); // Every 5s

    // Listen to online/offline events
    const handleOnline = () => setStatus(prev => ({ ...prev, online: true }));
    const handleOffline = () => setStatus(prev => ({ ...prev, online: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const StatusBadge = ({ active, label }: { active: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
      <span className={active ? 'text-green-700' : 'text-gray-600'}>{label}</span>
    </div>
  );

  const handleSyncNow = async () => {
    try {
      const bridge = getOfflineBridge();
      const result = await bridge.syncNow();
      alert(`Sync complete: ${result.synced} synced, ${result.failed} failed, ${result.conflicts} conflicts`);
      // Refresh stats
      const outboxStats = await bridge.getOutboxStatus();
      setStatus((prev) => ({ ...prev, outbox: outboxStats }));
    } catch (error) {
      alert(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
      <h3 className="font-semibold text-sm text-gray-900">System Diagnostics</h3>

      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : (
        <div className="space-y-3">
          <StatusBadge active={status.online} label={`Connection: ${status.online ? 'Online' : 'Offline'}`} />
          <StatusBadge active={status.serviceWorkerRegistered} label={`Service Worker: ${status.serviceWorkerRegistered ? 'Registered' : 'Not registered'}`} />
          <StatusBadge active={status.manifestDetected} label={`Manifest: ${status.manifestDetected ? 'Detected' : 'Not found'}`} />
          <StatusBadge
            active={status.pushSubscribed}
            label={`Push: ${status.pushSubscribed ? 'Subscribed' : `${status.pushPermission}`}`}
          />

          {status.outbox && (
            <div className="pt-2 border-t space-y-2">
              <div className="text-xs font-semibold text-gray-700">Outbox Queue</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-gray-600">Pending: {status.outbox.pending}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-gray-600">Synced: {status.outbox.synced}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-gray-600">Failed: {status.outbox.failed}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="text-gray-600">Conflicts: {status.outbox.conflicts}</span>
                </div>
              </div>
              {(status.outbox.pending > 0 || status.outbox.failed > 0) && (
                <button
                  onClick={handleSyncNow}
                  className="w-full mt-2 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded transition-colors"
                >
                  Sync Now
                </button>
              )}
            </div>
          )}

          {status.buildVersion && (
            <div className="text-xs text-gray-500 pt-2 border-t">
              Build: <code className="bg-white px-2 py-1 rounded">{status.buildVersion}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
