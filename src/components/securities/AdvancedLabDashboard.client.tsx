'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Play, Plus, AlertCircle, Lock } from 'lucide-react';

interface LabEnvironment {
  id: string;
  lab_id: string;
  status: 'provisioning' | 'running' | 'paused' | 'terminated';
  docker_image: string;
  created_at: string;
  snapshot_count: number;
}

export function AdvancedLabDashboard() {
  const [labs, setLabs] = useState<LabEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [launchingLabId, setLaunchingLabId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLabs = async () => {
      try {
        const res = await fetch('/api/securities/labs/advanced');
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
  }, []);

  const handleLaunchLab = async (labId: string) => {
    setLaunchingLabId(labId);
    try {
      const res = await fetch('/api/securities/labs/advanced/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_id: labId }),
      });

      if (!res.ok) throw new Error('Failed to provision lab');
      const data = await res.json();
      setLabs((prev) =>
        prev.map((l) => (l.id === data.id ? { ...l, status: 'running' } : l)),
      );
      toast.success('Lab environment provisioned!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Provisioning failed';
      toast.error(msg);
    } finally {
      setLaunchingLabId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advanced Labs</h2>
          <p className="text-sm text-gray-600">Docker-based security environments with snapshots</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
          <Plus className="w-4 h-4" />
          New Lab
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {labs.map((lab) => (
          <Card
            key={lab.id}
            className={`p-6 hover:shadow-lg transition-shadow ${
              lab.status === 'running' ? 'border-green-200 bg-green-50' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">{lab.lab_id}</h3>
                <p className="text-xs text-gray-600 font-mono mt-1">
                  {lab.docker_image}
                </p>
              </div>
              {lab.status === 'running' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                  <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                  Running
                </span>
              )}
            </div>

            <div className="space-y-2 mb-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Lock className="w-4 h-4" />
                <span>Private environment</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <AlertCircle className="w-4 h-4" />
                <span>{lab.snapshot_count} snapshots</span>
              </div>
            </div>

            <div className="flex gap-2">
              {lab.status !== 'running' ? (
                <button
                  onClick={() => handleLaunchLab(lab.id)}
                  disabled={launchingLabId === lab.id}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-2 rounded font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  {launchingLabId === lab.id ? 'Provisioning...' : 'Launch'}
                </button>
              ) : (
                <button className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded font-medium text-sm">
                  Connect
                </button>
              )}
              <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded font-medium text-sm">
                Snapshots
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
