'use client';

/**
 * Recent Errors Component
 * Displays latest errors from queue or app_logs
 */

import React, { useEffect, useState, useCallback } from 'react';
import { getUnsentLogs } from '@/lib/alphashield/queue';

interface LogEntry {
  id: string;
  level: string;
  area: string;
  message: string;
  fingerprint: string;
  created_at: string;
  timestamp: number;
}

export function RecentErrors() {
  const [errors, setErrors] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadErrors = useCallback(async () => {
    try {
      setLoading(true);
      const logs = await getUnsentLogs();

      // Filter errors and format
      const errorLogs: LogEntry[] = logs
        .filter(log => log.level === 'error')
        .slice(0, 20)
        .map(log => ({
          id: log.id,
          level: log.level,
          area: log.area,
          message: log.message,
          fingerprint: log.fingerprint,
          created_at: new Date(log.timestamp).toLocaleString(),
          timestamp: log.timestamp,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      setErrors(errorLogs);
    } catch (error) {
      console.error('Error loading errors:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadErrors();

    // Refresh every 5 seconds
    const interval = setInterval(loadErrors, 5000);

    return () => clearInterval(interval);
  }, [loadErrors]);

  if (loading) {
    return (
      <div className="p-4 border rounded-lg bg-slate-50">
        <div className="text-sm text-gray-500">Loading errors...</div>
      </div>
    );
  }

  if (errors.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-slate-50">
        <div className="text-sm text-gray-500">✓ No errors logged</div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-white">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm text-gray-900">Recent Errors ({errors.length})</h3>
      </div>

      <div className="divide-y max-h-96 overflow-y-auto">
        {errors.map(error => (
          <div key={error.id} className="p-3 hover:bg-gray-50 cursor-pointer transition" onClick={() => setSelectedId(selectedId === error.id ? null : error.id)}>
            {/* Summary */}
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{error.area}</p>
                    <p className="text-xs text-gray-600 truncate">{error.message}</p>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">{error.created_at}</span>
                </div>
              </div>
            </div>

            {/* Details (expandable) */}
            {selectedId === error.id && (
              <div className="mt-2 ml-4 pt-2 border-t space-y-1">
                <div className="text-xs">
                  <span className="text-gray-600">Fingerprint: </span>
                  <code className="text-gray-800 bg-gray-100 px-1 rounded text-xs">
                    {error.fingerprint.substring(0, 20)}...
                  </code>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t bg-gray-50 text-xs text-gray-500">
        Showing latest 20 errors from queue
      </div>
    </div>
  );
}
