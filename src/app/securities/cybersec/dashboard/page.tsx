import { Metadata } from 'next';
import { Suspense } from 'react';
import { ProgressDashboard, RecommendationBanner } from '@/components/securities';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Dashboard - CyberSec Academy',
  description: 'Your learning progress and statistics.',
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Learning Dashboard</h1>
          <p className="text-gray-600">Track your progress, view recommendations, and celebrate your achievements.</p>
        </div>

        <Suspense fallback={<Skeleton className="h-12 w-full" />}>
          <RecommendationBanner />
        </Suspense>

        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          }
        >
          <ProgressDashboard />
        </Suspense>
      </div>
    </div>
  );
}
