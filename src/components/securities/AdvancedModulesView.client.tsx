'use client';

import { useEffect, useState } from 'react';
import { ModulesAdvancedGrid } from './ModulesAdvancedGrid.client';
import { toast } from 'sonner';

interface Module {
  id: string;
  module_number: number;
  title: string;
  description: string;
  difficulty_level: string;
  estimated_hours: number;
  industry_relevance: string[];
  learning_outcomes: string[];
  concept_count?: number;
  lesson_count?: number;
}

export function AdvancedModulesView() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const res = await fetch('/api/securities/modules/advanced', {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!res.ok) {
          throw new Error('Failed to fetch modules');
        }

        const data = await res.json();
        setModules(data.modules || []);
      } catch (error) {
        console.error('Error fetching advanced modules:', error);
        toast.error('Failed to load advanced modules');
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Advanced Security Modules</h2>
        <p className="text-sm text-gray-600">
          Final tier of CyberSec Academy: Specialized domains in cutting-edge security
        </p>
      </div>

      <ModulesAdvancedGrid modules={modules} loading={loading} />
    </div>
  );
}
