import { Metadata } from 'next';
import { Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Code2, Zap, Target } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Practice Exercises - CyberSec Academy',
  description: 'Interactive coding challenges to practice your cybersecurity skills.',
};

async function ExercisesList() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/securities/exercises`, {
      cache: 'revalidate',
    });
    if (!res.ok) throw new Error('Failed to fetch exercises');
    const exercises = await res.json();

    // Group by difficulty
    const grouped = {
      basic: exercises.filter((e: any) => e.difficulty === 'basic'),
      intermediate: exercises.filter((e: any) => e.difficulty === 'intermediate'),
      advanced: exercises.filter((e: any) => e.difficulty === 'advanced'),
    };

    return (
      <div className="space-y-8">
        {Object.entries(grouped).map(([difficulty, items]: [string, any]) => (
          <div key={difficulty}>
            <h3 className="text-xl font-bold text-gray-900 mb-4 capitalize flex items-center gap-2">
              {difficulty === 'basic' && <Target className="w-5 h-5 text-blue-600" />}
              {difficulty === 'intermediate' && <Zap className="w-5 h-5 text-yellow-600" />}
              {difficulty === 'advanced' && <Code2 className="w-5 h-5 text-red-600" />}
              {difficulty} Level
            </h3>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((exercise: any) => (
                <Link key={exercise.id} href={`/securities/cybersec/practice/${exercise.id}`}>
                  <Card className="p-4 h-full hover:shadow-md transition-shadow cursor-pointer">
                    <h4 className="font-semibold text-sm mb-2 line-clamp-2 hover:text-blue-600">
                      {exercise.title}
                    </h4>
                    <p className="text-xs text-gray-600 line-clamp-3 mb-3">{exercise.description}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded">{exercise.language}</span>
                      <span className="capitalize">{exercise.difficulty}</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  } catch (err) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Unable to load exercises. Please try again later.</p>
      </div>
    );
  }
}

export default function PracticePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Practice Exercises</h1>
          <p className="text-gray-600">
            260+ interactive coding challenges across 86 security modules. Solve real-world scenarios in Python,
            JavaScript, C, Assembly, and more.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="space-y-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-8 w-32 mb-4" />
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <Skeleton key={j} className="h-32" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          }
        >
          <ExercisesList />
        </Suspense>
      </div>
    </div>
  );
}
