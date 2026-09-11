'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { Trophy, Medal } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  email: string;
  xp_total: number;
  modules_completed: number;
  badges_count: number;
  current_user_rank?: number;
}

interface LeaderboardPanelProps {
  limit?: number;
}

export function LeaderboardPanel({ limit = 10 }: LeaderboardPanelProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/securities/leaderboard?limit=${limit}`);
        if (!res.ok) throw new Error('Failed to fetch leaderboard');
        const data = await res.json();
        setEntries(data.entries || []);
        setCurrentUserEntry(data.current_user || null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load leaderboard';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [limit]);

  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return <EmptyState title="Leaderboard empty" description="Start learning to appear on the leaderboard!" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-yellow-600" />
        <h3 className="font-semibold text-lg">Top Learners</h3>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => {
          const medal = getMedalIcon(entry.rank);

          return (
            <Card key={entry.rank} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {medal || entry.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-sm">{entry.email.split('@')[0]}</p>
                  <p className="text-xs text-gray-600">
                    {entry.modules_completed} modules • {entry.badges_count} badges
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-lg text-blue-600">{entry.xp_total}</p>
                <p className="text-xs text-gray-500">XP</p>
              </div>
            </Card>
          );
        })}
      </div>

      {currentUserEntry && (
        <Card className="p-4 bg-blue-50 border-blue-200 mt-6">
          <p className="text-sm text-gray-600 mb-2">Your Position</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {currentUserEntry.rank}
              </div>
              <div>
                <p className="font-semibold text-sm">#{currentUserEntry.rank}</p>
                <p className="text-xs text-gray-600">{currentUserEntry.xp_total} XP</p>
              </div>
            </div>
            <Medal className="w-5 h-5 text-blue-600" />
          </div>
        </Card>
      )}
    </div>
  );
}
