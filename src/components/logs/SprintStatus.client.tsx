'use client';

import { useState, useEffect } from 'react';
import type { AuditReport } from '@/lib/alphashield/sprintAudit';

interface SprintStatusProps {
  onAuditComplete?: (report: AuditReport) => void;
}

export default function SprintStatus({ onAuditComplete }: SprintStatusProps) {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSprintId, setExpandedSprintId] = useState<number | null>(null);

  // Fetch last audit on mount
  useEffect(() => {
    fetchLastAudit();
  }, []);

  const fetchLastAudit = async () => {
    try {
      const res = await fetch('/api/alphashield/audit', { method: 'GET' });
      const data = await res.json();

      if (data.ok && data.report) {
        setReport(data.report);
        setError(null);
      }
    } catch (err) {
      console.error('[SprintStatus] Failed to fetch last audit:', err);
    }
  };

  const runAudit = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/alphashield/audit', { method: 'POST' });
      const data = await res.json();

      if (data.ok && data.report) {
        setReport(data.report);
        onAuditComplete?.(data.report);
      } else {
        setError(data.error || 'Audit failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[SprintStatus] Audit error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: 'ok' | 'partial' | 'missing') => {
    switch (status) {
      case 'ok':
        return <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">✅ Complete</span>;
      case 'partial':
        return <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-semibold">⚠️ Partial</span>;
      case 'missing':
        return <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">❌ Missing</span>;
    }
  };

  const getCompletenessColor = (completeness: number) => {
    if (completeness === 100) return 'bg-green-500';
    if (completeness >= 75) return 'bg-blue-500';
    if (completeness >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sprint Status</h2>
          <p className="text-sm text-gray-500 mt-1">
            {report ? `Last updated: ${new Date(report.generatedAt).toLocaleString()}` : 'No audit data yet'}
          </p>
        </div>
        <button
          onClick={runAudit}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="inline-block animate-spin">⟳</span>
              Running Audit...
            </>
          ) : (
            <>
              <span>🔄</span>
              Run Audit
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p className="font-semibold">Audit Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Summary */}
      {report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-500 font-semibold">Total</p>
              <p className="text-2xl font-bold mt-1">{report.summary.totalSprints}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-xs text-gray-500 font-semibold">✅ Complete</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{report.summary.okSprints}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-xs text-gray-500 font-semibold">⚠️ Partial</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">{report.summary.partialSprints}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-xs text-gray-500 font-semibold">❌ Missing</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{report.summary.missingSprints}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-xs text-gray-500 font-semibold">Overall</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{report.summary.overallCompleteness}%</p>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Overall Progress</span>
              <span className="text-sm text-gray-500">{report.summary.overallCompleteness}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${getCompletenessColor(report.summary.overallCompleteness)}`}
                style={{ width: `${report.summary.overallCompleteness}%` }}
              />
            </div>
          </div>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">📋 Recommendations</h3>
              <ul className="space-y-1">
                {report.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="flex-shrink-0">{rec.charAt(0) === '✅' ? '✅' : rec.charAt(0) === '⚠️' ? '⚠️' : '👍'}</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sprints Details */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">🎯 Sprint Details</h3>
            {report.sprints.map((sprint) => (
              <div
                key={sprint.id}
                className="border rounded-lg overflow-hidden"
              >
                {/* Sprint Header */}
                <button
                  onClick={() =>
                    setExpandedSprintId(
                      expandedSprintId === sprint.id ? null : sprint.id,
                    )
                  }
                  className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {getStatusBadge(sprint.status)}
                    <div className="text-left">
                      <p className="font-semibold text-sm">Sprint {sprint.id}: {sprint.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{sprint.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-lg">{sprint.completeness}%</p>
                      <p className="text-xs text-gray-500">{sprint.checks.length} checks</p>
                    </div>
                    <span className="text-gray-400">
                      {expandedSprintId === sprint.id ? '▼' : '▶'}
                    </span>
                  </div>
                </button>

                {/* Sprint Details */}
                {expandedSprintId === sprint.id && (
                  <div className="p-4 bg-white border-t space-y-4">
                    {/* Completeness Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold">Completeness</span>
                        <span className="text-gray-500">{sprint.completeness}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${getCompletenessColor(sprint.completeness)}`}
                          style={{ width: `${sprint.completeness}%` }}
                        />
                      </div>
                    </div>

                    {/* Checks */}
                    <div className="space-y-2">
                      <p className="font-semibold text-sm">Checks</p>
                      <ul className="space-y-1">
                        {sprint.checks.map((check, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-xs text-gray-700 p-2 bg-gray-50 rounded"
                          >
                            <span className="flex-shrink-0 mt-0.5">
                              {check.ok ? '✅' : '❌'}
                            </span>
                            <div className="flex-1">
                              <p className="font-semibold">{check.name}</p>
                              <p className="text-gray-500 mt-0.5">{check.detail}</p>
                              {check.fileRefs.length > 0 && (
                                <p className="text-gray-400 mt-1 text-xs">
                                  📁 {check.fileRefs.join(', ')}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* No Data */}
      {!report && !loading && (
        <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-blue-700 font-semibold">No audit data yet</p>
          <p className="text-sm text-blue-600 mt-1">
            Click &quot;Run Audit&quot; to generate the first status report
          </p>
        </div>
      )}
    </div>
  );
}
