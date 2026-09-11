'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { Play, StopCircle, Clock, AlertCircle } from 'lucide-react';
import type { Lab } from '@/lib/securities/schemas';

interface LabLauncherProps {
  moduleId?: string;
}

export function LabLauncher({ moduleId }: LabLauncherProps) {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState<Record<string, boolean>>({});
  const [launching, setLaunching] = useState<string | null>(null);

  useEffect(() => {
    const fetchLabs = async () => {
      try {
        const params = new URLSearchParams();
        if (moduleId) params.append('module', moduleId);

        const res = await fetch(`/api/securities/labs?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch labs');
        const data = await res.json();
        setLabs(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load labs';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchLabs();
  }, [moduleId]);

  const handleLaunchLab = async (labId: string) => {
    setLaunching(labId);
    try {
      const res = await fetch('/api/securities/labs/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_id: labId }),
      });

      if (!res.ok) throw new Error('Failed to launch lab');
      const data = await res.json();
      setActiveSessions((prev) => ({ ...prev, [labId]: true }));
      toast.success('Lab environment started! Access it at the link below.');

      // Store session for reference
      if (data.access_url) {
        window.open(data.access_url, '_blank');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to launch lab';
      toast.error(msg);
    } finally {
      setLaunching(null);
    }
  };

  const handleStopLab = async (labId: string) => {
    try {
      const res = await fetch('/api/securities/labs/sessions/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_id: labId }),
      });

      if (!res.ok) throw new Error('Failed to stop lab');
      setActiveSessions((prev) => ({ ...prev, [labId]: false }));
      toast.success('Lab environment stopped');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to stop lab';
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (labs.length === 0) {
    return <EmptyState title="No labs available" description="Check back soon for hands-on lab environments." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {labs.map((lab) => {
        const isActive = activeSessions[lab.id] || false;
        const isLaunching = launching === lab.id;

        return (
          <Card key={lab.id} className={`p-6 ${isActive ? 'border-green-200 bg-green-50' : ''}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg">{lab.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{lab.description}</p>
              </div>
              {isActive && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                  <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                  Active
                </span>
              )}
            </div>

            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Est. time: {lab.estimated_duration_minutes || 'N/A'} min</span>
              </div>
              {lab.difficulty && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="capitalize">Difficulty: {lab.difficulty}</span>
                </div>
              )}
            </div>

            {lab.objectives && lab.objectives.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-700 mb-2">Objectives:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  {lab.objectives.map((obj, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-gray-400 flex-shrink-0">•</span>
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => (isActive ? handleStopLab(lab.id) : handleLaunchLab(lab.id))}
              disabled={isLaunching}
              className={`w-full py-2 px-4 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                isActive
                  ? 'bg-red-100 hover:bg-red-200 text-red-700'
                  : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300'
              }`}
            >
              {isActive ? (
                <>
                  <StopCircle className="w-4 h-4" />
                  Stop Lab
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {isLaunching ? 'Launching...' : 'Launch Lab'}
                </>
              )}
            </button>
          </Card>
        );
      })}
    </div>
  );
}
