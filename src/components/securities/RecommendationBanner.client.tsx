'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Lightbulb, ChevronRight, X } from 'lucide-react';

interface Recommendation {
  type: 'next_module' | 'review_weak' | 'unlock_badge' | 'practice_more' | 'explore_specialty';
  title: string;
  description: string;
  action_label: string;
  action_url?: string;
  priority: 'high' | 'medium' | 'low';
  module_id?: string;
}

interface RecommendationBannerProps {
  onDismiss?: () => void;
}

export function RecommendationBanner({ onDismiss }: RecommendationBannerProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const res = await fetch('/api/securities/recommendations');
        if (!res.ok) throw new Error('Failed to fetch recommendations');
        const data = await res.json();
        setRecommendations(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load recommendations';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  if (loading || dismissed || recommendations.length === 0) {
    return null;
  }

  const recommendation = recommendations[currentIndex];
  const priorityColors = {
    high: 'bg-red-50 border-red-200',
    medium: 'bg-yellow-50 border-yellow-200',
    low: 'bg-blue-50 border-blue-200',
  };

  const priorityIcons = {
    high: '🔥',
    medium: '⚡',
    low: '💡',
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleNext = () => {
    if (currentIndex < recommendations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <Card className={`p-4 flex items-start gap-4 ${priorityColors[recommendation.priority]}`}>
      <div className="text-2xl flex-shrink-0">{priorityIcons[recommendation.priority]}</div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm mb-1">{recommendation.title}</h3>
        <p className="text-sm text-gray-700 mb-3">{recommendation.description}</p>

        <div className="flex flex-wrap gap-2">
          {recommendation.action_url ? (
            <a
              href={recommendation.action_url}
              className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
            >
              {recommendation.action_label}
              <ChevronRight className="w-4 h-4" />
            </a>
          ) : (
            <button
              onClick={() => window.location.href = `/securities/cybersec/modules/${recommendation.module_id}`}
              className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
            >
              {recommendation.action_label}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {recommendations.length > 1 && (
            <button
              onClick={handleNext}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Next ({currentIndex + 1}/{recommendations.length})
            </button>
          )}
        </div>
      </div>

      <button
        onClick={handleDismiss}
        className="p-1 hover:bg-white/50 rounded transition-colors flex-shrink-0 text-gray-500 hover:text-gray-700"
        title="Dismiss"
      >
        <X className="w-5 h-5" />
      </button>
    </Card>
  );
}
