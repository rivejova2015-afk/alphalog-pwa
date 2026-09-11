'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { Lock, Check } from 'lucide-react';
import type { Badge } from '@/lib/securities/schemas';

interface BadgesDisplayProps {
  userBadgeIds?: string[];
}

export function BadgesDisplay({ userBadgeIds = [] }: BadgesDisplayProps) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const res = await fetch('/api/securities/badges');
        if (!res.ok) throw new Error('Failed to fetch badges');
        const data = await res.json();
        setBadges(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load badges';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchBadges();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (badges.length === 0) {
    return <EmptyState title="No badges available" description="Start learning to unlock badges!" />;
  }

  const earnedBadges = badges.filter((b) => userBadgeIds.includes(b.id));
  const lockedBadges = badges.filter((b) => !userBadgeIds.includes(b.id));

  return (
    <div className="space-y-6">
      {earnedBadges.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-3">Earned Badges</h3>
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
            {earnedBadges.map((badge) => (
              <Card key={badge.id} className="p-4 text-center hover:shadow-md transition-shadow relative">
                <div className="text-4xl mb-2">{badge.icon}</div>
                <p className="text-xs font-semibold mb-1 line-clamp-2">{badge.name}</p>
                <p className="text-xs text-gray-600 mb-2">{badge.xp_reward} XP</p>
                <Check className="w-4 h-4 text-green-600 mx-auto" />
              </Card>
            ))}
          </div>
        </div>
      )}

      {lockedBadges.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-3">Locked Badges</h3>
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
            {lockedBadges.map((badge) => (
              <div key={badge.id} title={badge.trigger_condition}>
                <Card className="p-4 text-center opacity-50 hover:opacity-75 transition-opacity relative cursor-help">
                  <div className="text-4xl mb-2 opacity-50">{badge.icon}</div>
                  <p className="text-xs font-semibold mb-1 line-clamp-2">{badge.name}</p>
                  <p className="text-xs text-gray-600 mb-2">{badge.xp_reward} XP</p>
                  <Lock className="w-4 h-4 text-gray-400 mx-auto" />
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
