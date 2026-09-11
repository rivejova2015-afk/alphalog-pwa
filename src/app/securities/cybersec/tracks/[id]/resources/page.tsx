import { Metadata } from 'next';
import { Suspense } from 'react';
import { ResourcesPanel } from '@/components/securities';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface TrackResourcesPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Track Resources - CyberSec Academy',
  description: 'Curated learning resources for this career track.',
};

export default async function TrackResourcesPage({ params }: TrackResourcesPageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            href="/securities/cybersec/tracks"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tracks
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Learning Resources</h1>
          <p className="text-gray-600">
            Curated materials including papers, videos, tools, CTF challenges, and textbooks to deepen your
            understanding of each module.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          }
        >
          <ResourcesPanel />
        </Suspense>
      </div>
    </div>
  );
}
