import { Metadata } from 'next';
import { Suspense } from 'react';
import { LeaderboardPanel } from '@/components/securities';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Leaderboard - CyberSec Academy',
  description: 'Global rankings of top cybersecurity learners.',
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Global Leaderboard</h1>
          <p className="text-gray-600">
            Compete with fellow learners. Earn XP through quizzes, exercises, and completed modules to climb the
            rankings and unlock achievements.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          }
        >
          <LeaderboardPanel limit={50} />
        </Suspense>
      </div>
    </div>
  );
}
