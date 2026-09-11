import { Metadata } from 'next';
import { Suspense } from 'react';
import { BadgesDisplay } from '@/components/securities';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Badges - CyberSec Academy',
  description: 'Unlock achievements as you progress through the cybersecurity curriculum.',
};

async function BadgesContent() {
  try {
    // Fetch user's badge IDs if authenticated
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/securities/progress`, {
      cache: 'revalidate',
    });

    if (!res.ok) {
      return <BadgesDisplay userBadgeIds={[]} />;
    }

    const progress = await res.json();
    return <BadgesDisplay userBadgeIds={progress.badge_ids || []} />;
  } catch {
    return <BadgesDisplay userBadgeIds={[]} />;
  }
}

export default function BadgesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Badges & Achievements</h1>
          <p className="text-gray-600">
            Earn badges by completing modules, passing quizzes, solving exercises, and reaching learning
            milestones. Each badge represents mastery of a key cybersecurity concept.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          }
        >
          <BadgesContent />
        </Suspense>
      </div>
    </div>
  );
}
