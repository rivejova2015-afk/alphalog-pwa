'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Play, Copy, Check } from 'lucide-react';
import type { PracticeExercise, ExerciseSubmission } from '@/lib/securities/schemas';

interface ExerciseWorkspaceProps {
  exerciseId: string;
}

export function ExerciseWorkspace({ exerciseId }: ExerciseWorkspaceProps) {
  const [exercise, setExercise] = useState<PracticeExercise | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<ExerciseSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchExercise = async () => {
      try {
        const res = await fetch(`/api/securities/exercises/${exerciseId}`);
        if (!res.ok) throw new Error('Failed to fetch exercise');
        const data = await res.json();
        setExercise(data);
        setCode(data.code_template || '');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load exercise';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchExercise();
  }, [exerciseId]);

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.error('Please write some code before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/securities/exercises/${exerciseId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) throw new Error('Submission failed');
      const data = await res.json();
      setSubmission(data);

      if (data.passed) {
        toast.success(`🎉 All tests passed! +${data.xp_earned} XP`);
      } else {
        toast.error(`${data.failed_tests_count} test(s) failed. Try again!`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  if (loading) {
    return <Skeleton className="h-96" />;
  }

  if (!exercise) {
    return <div className="text-center py-8 text-gray-500">Exercise not found</div>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 h-full">
      {/* Problem Statement */}
      <Card className="p-6 overflow-y-auto max-h-96 lg:max-h-full">
        <h3 className="font-semibold text-lg mb-2">{exercise.title}</h3>
        <p className="text-sm text-gray-600 mb-4">{exercise.description}</p>

        <div className="mb-4">
          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium capitalize">
            {exercise.difficulty}
          </span>
          <span className="ml-2 inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
            {exercise.language}
          </span>
        </div>

        {exercise.hints && exercise.hints.length > 0 && (
          <details className="mb-4">
            <summary className="cursor-pointer font-medium text-sm text-blue-600 hover:text-blue-700">
              💡 Show Hints
            </summary>
            <ul className="mt-3 space-y-2">
              {exercise.hints.map((hint, idx) => (
                <li key={idx} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-blue-600 flex-shrink-0">•</span>
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {exercise.test_cases && exercise.test_cases.length > 0 && (
          <div className="mt-4">
            <p className="font-medium text-sm mb-2">Test Cases:</p>
            <div className="space-y-2 text-xs font-mono bg-gray-50 p-3 rounded overflow-x-auto">
              {exercise.test_cases.slice(0, 3).map((tc, idx) => (
                <div key={idx} className="text-gray-600">
                  Input: {tc.input} → Expected: {tc.expected}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Code Editor & Results */}
      <div className="flex flex-col gap-4 h-full lg:max-h-full">
        <Card className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium">Your Solution</label>
            <button
              onClick={() => copyCode(code, 'Code')}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Copy code"
            >
              <Copy className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 font-mono text-sm p-3 border border-gray-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Write your code here..."
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4" />
            {submitting ? 'Running...' : 'Run Tests'}
          </button>
        </Card>

        {/* Submission Results */}
        {submission && (
          <Card className={`p-4 ${submission.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {submission.passed ? (
                <>
                  <Check className="w-5 h-5 text-green-600" />
                  <p className="font-semibold text-green-700">All tests passed!</p>
                </>
              ) : (
                <>
                  <span className="text-lg">❌</span>
                  <p className="font-semibold text-red-700">{submission.failed_tests_count} test(s) failed</p>
                </>
              )}
            </div>
            {submission.feedback && (
              <p className="text-sm text-gray-700 mt-2">{submission.feedback}</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
