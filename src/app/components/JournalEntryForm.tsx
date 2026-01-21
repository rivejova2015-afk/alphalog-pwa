'use client';

import { useState } from 'react';
import { createJournalEntry, validateJournalEntry } from '@/lib/alphacore/journal';
import type { CreateJournalEntryInput } from '@/lib/alphacore/journal';

/**
 * Journal Entry Form Component (Pilot Example)
 * 
 * Demonstrates:
 * - Form validation before submission
 * - Offline-first mutations
 * - Pre-submission dedup checks
 * - Error handling
 * - Success feedback
 * 
 * This is a minimal example. Real UI should include:
 * - Rich text editor
 * - Tag autocomplete
 * - Trade linking
 * - Draft auto-save
 */
export default function JournalEntryForm({ userId }: { userId: string }) {
  // Form state
  const [text, setText] = useState('');
  type Mood = CreateJournalEntryInput['mood'];
  const [mood, setMood] = useState<Mood | undefined>(undefined);
  const [moodScore, setMoodScore] = useState<number>(5);
  const [tags, setTags] = useState(''); // CSV format
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [actionItems, setActionItems] = useState(''); // CSV format

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous messages
    setValidationErrors([]);
    setSuccessMessage('');
    setErrorMessage('');

    // Build input
    const input: CreateJournalEntryInput = {
      text: text.trim(),
      mood: mood,
      mood_score: moodScore || undefined,
      tags: tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0) || undefined,
      lessons_learned: lessonsLearned.trim() || undefined,
      action_items: actionItems
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0) || undefined
    };

    // Validate before submission
    const errors = validateJournalEntry(input);
    if (errors.length > 0) {
      setValidationErrors(errors.map(e => `${e.field}: ${e.message}`));
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createJournalEntry(input, userId);

      if (result.error) {
        setErrorMessage(result.error.message);
      } else {
        setSuccessMessage(
          `✓ Journal entry created! ${
            result.status === 'optimistic'
              ? '(Syncing in background...)'
              : '(Synced)'
          }`
        );
        // Reset form
        setText('');
        setMood(undefined);
        setMoodScore(5);
        setTags('');
        setLessonsLearned('');
        setActionItems('');

        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-6">📝 Journal Entry</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Main Text Area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What&apos;s on your mind? *
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your journal entry here..."
            rows={5}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500 mt-1">
            {text.length} / 50,000 characters
          </p>
        </div>

        {/* Mood Section */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mood (Optional)
            </label>
            <select
              value={mood ?? ''}
              onChange={(e) => {
                const v = e.target.value as Mood | '';
                setMood(v === '' ? undefined : (v as Mood));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
            >
              <option value="">-- Select mood --</option>
              <option value="excellent">😄 Excellent</option>
              <option value="good">😊 Good</option>
              <option value="neutral">😐 Neutral</option>
              <option value="bad">😟 Bad</option>
              <option value="terrible">😢 Terrible</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mood Score: {moodScore}/10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={moodScore}
              onChange={(e) => setMoodScore(parseInt(e.target.value))}
              className="w-full"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags (Optional, comma-separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g., winning_day, risk_management, discipline"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
          />
        </div>

        {/* Lessons Learned */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Lessons Learned (Optional)
          </label>
          <textarea
            value={lessonsLearned}
            onChange={(e) => setLessonsLearned(e.target.value)}
            placeholder="What did you learn today?"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={isSubmitting}
          />
        </div>

        {/* Action Items */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Action Items (Optional, comma-separated)
          </label>
          <textarea
            value={actionItems}
            onChange={(e) => setActionItems(e.target.value)}
            placeholder="e.g., review risk limits, backtest strategy, study price action"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={isSubmitting}
          />
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm font-medium text-red-800 mb-2">
              ❌ Validation Errors:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-800">❌ {errorMessage}</p>
          </div>
        )}

        {/* Offline Indicator */}
        {!navigator?.onLine && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="text-sm text-yellow-800">
              ⊘ You are offline. Your entry will be saved locally and synced
              when you reconnect.
            </p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting || text.trim().length === 0}
            className="flex-1 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin mr-2">↻</span>
                Saving...
              </>
            ) : (
              '💾 Save Entry'
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setText('');
              setMood(undefined);
              setMoodScore(5);
              setTags('');
              setLessonsLearned('');
              setActionItems('');
              setValidationErrors([]);
              setSuccessMessage('');
              setErrorMessage('');
            }}
            className="px-6 py-2 bg-gray-300 text-gray-800 font-medium rounded-lg hover:bg-gray-400 transition"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}
