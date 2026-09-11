'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { CheckCircle, Lock, AlertCircle } from 'lucide-react';

interface ModuleNode {
  module_id: string;
  module_name: string;
  completed: boolean;
  prerequisites_met: boolean;
  prerequisite_count: number;
  dependents_count: number;
}

interface PrerequisiteGraphProps {
  moduleId?: string;
}

export function PrerequisiteGraph({ moduleId }: PrerequisiteGraphProps) {
  const [modules, setModules] = useState<ModuleNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const params = new URLSearchParams();
        if (moduleId) params.append('module', moduleId);

        const res = await fetch(`/api/securities/prerequisites?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch prerequisites');
        const data = await res.json();
        setModules(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load prerequisites';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchGraph();
  }, [moduleId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (modules.length === 0) {
    return <EmptyState title="No prerequisites" description="This module has no prerequisites." />;
  }

  const completed = modules.filter((m) => m.completed);
  const availableToUnlock = modules.filter((m) => !m.completed && m.prerequisites_met);
  const locked = modules.filter((m) => !m.completed && !m.prerequisites_met);

  return (
    <div className="space-y-6">
      {completed.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-3 text-green-700">Completed Prerequisites</h4>
          <div className="space-y-2">
            {completed.map((module) => (
              <div key={module.module_id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{module.module_name}</p>
                  {module.dependents_count > 0 && (
                    <p className="text-xs text-green-600">Unlocks {module.dependents_count} module(s)</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {availableToUnlock.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-3 text-blue-700">Ready to Unlock</h4>
          <div className="space-y-2">
            {availableToUnlock.map((module) => (
              <div key={module.module_id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{module.module_name}</p>
                  <p className="text-xs text-blue-600">Complete this to unlock {module.dependents_count} module(s)</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-3 text-gray-600">Locked</h4>
          <div className="space-y-2">
            {locked.map((module) => (
              <div key={module.module_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 opacity-75">
                <Lock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-700">{module.module_name}</p>
                  <p className="text-xs text-gray-500">Requires {module.prerequisite_count} prerequisite(s)</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
