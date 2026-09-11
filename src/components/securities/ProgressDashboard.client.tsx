'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Zap, Award, BookOpen, Target, Flame } from 'lucide-react';

interface ProgressData {
  modules_completed: number;
  quiz_scores: { average: number; total: number };
  exercises_completed: number;
  xp_total: number;
  streak_days: number;
  specialties: string[];
  badge_ids: string[];
}

export function ProgressDashboard() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await fetch('/api/securities/progress');
        if (!res.ok) throw new Error('Failed to fetch progress');
        const data = await res.json();
        setProgress(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load progress';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!progress) {
    return <div className="text-center py-8 text-gray-500">Unable to load progress data</div>;
  }

  const metrics = [
    {
      label: 'Modules Completed',
      value: progress.modules_completed,
      icon: BookOpen,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'XP Earned',
      value: progress.xp_total,
      icon: Zap,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      label: 'Exercises',
      value: progress.exercises_completed,
      icon: Target,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Badges Earned',
      value: progress.badge_ids.length,
      icon: Award,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'Day Streak',
      value: progress.streak_days,
      icon: Flame,
      color: 'bg-red-100 text-red-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        {metrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <Card key={idx} className="p-4">
              <div className={`inline-flex p-2 rounded-lg mb-2 ${metric.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-sm text-gray-600 mb-1">{metric.label}</p>
              <p className="text-2xl font-bold">{metric.value}</p>
            </Card>
          );
        })}
      </div>

      {progress.specialties.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Your Specialties</h3>
          <div className="flex flex-wrap gap-2">
            {progress.specialties.map((specialty) => (
              <span key={specialty} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {specialty}
              </span>
            ))}
          </div>
        </Card>
      )}

      {progress.quiz_scores.total > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Quiz Performance</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${Math.min((progress.quiz_scores.average / 100) * 100, 100)}%` }}
                />
              </div>
            </div>
            <p className="text-lg font-semibold">{progress.quiz_scores.average.toFixed(1)}%</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">{progress.quiz_scores.total} quizzes completed</p>
        </Card>
      )}
    </div>
  );
}
