import { Metadata } from 'next';
import { TrackSelector } from '@/components/securities';

export const metadata: Metadata = {
  title: 'Career Tracks - CyberSec Academy',
  description: 'Choose a learning path and track your progress through structured cybersecurity modules.',
};

export default function TracksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Career Tracks</h1>
          <p className="text-gray-600">
            Choose a learning path tailored to your goals. Each track guides you through carefully sequenced
            modules to build deep expertise in a specific cybersecurity domain.
          </p>
        </div>

        <TrackSelector />
      </div>
    </div>
  );
}
