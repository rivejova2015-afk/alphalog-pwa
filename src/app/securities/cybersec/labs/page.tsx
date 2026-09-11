import { Metadata } from 'next';
import { Suspense } from 'react';
import { LabLauncher } from '@/components/securities';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Virtual Labs - CyberSec Academy',
  description: 'Hands-on virtual lab environments for practical cybersecurity training.',
};

export default function LabsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Virtual Labs</h1>
          <p className="text-gray-600">
            Launch pre-configured virtual lab environments to practice real-world security scenarios. Each lab
            includes tools, vulnerable applications, and guided objectives.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          }
        >
          <LabLauncher />
        </Suspense>
      </div>
    </div>
  );
}
