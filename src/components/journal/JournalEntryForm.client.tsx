'use client';

/**
 * Journal Entry Form Component
 * Create and edit journal entries with offline-first support
 */

import { useState } from 'react';
import { validateJournalEntry } from '@/lib/alphacore/journal';
import type { CreateJournalEntryInput } from '@/lib/alphacore/journal';

interface JournalEntryFormProps {
  userId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function JournalEntryForm({ userId, onSuccess, onCancel }: JournalEntryFormProps) {
  const [text, setText] = useState('');
  const [mood, setMood] = useState<CreateJournalEntryInput['mood']>(undefined);
  const [moodScore, setMoodScore] = useState(5);
  const [tags, setTags] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [actionItems, setActionItems] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setValidationErrors([]);
    setErrorMessage('');

    const input: CreateJournalEntryInput = {
      text: text.trim(),
      mood,
      mood_score: moodScore || undefined,
      tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0) || undefined,
      lessons_learned: lessonsLearned.trim() || undefined,
      action_items: actionItems.split(',').map(t => t.trim()).filter(t => t.length > 0) || undefined,
    };

    const errors = validateJournalEntry(input);
    if (errors.length > 0) {
      setValidationErrors(errors.map(e => `${e.field}: ${e.message}`));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setErrorMessage(error?.error || 'Failed to create entry');
        return;
      }

      // Clear form
      setText('');
      setMood(undefined);
      setMoodScore(5);
      setTags('');
      setLessonsLearned('');
      setActionItems('');
      onSuccess?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const moods: Array<{ value: CreateJournalEntryInput['mood']; emoji: string; label: string }> = [
    { value: 'excellent', emoji: '🤩', label: 'Excellent' },
    { value: 'good', emoji: '😊', label: 'Good' },
    { value: 'neutral', emoji: '😐', label: 'Neutral' },
    { value: 'bad', emoji: '😔', label: 'Bad' },
    { value: 'terrible', emoji: '😫', label: 'Terrible' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-3">
          <h4 className="font-medium text-red-400 mb-2">Validation Errors:</h4>
          <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-3 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Entry Text */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Entry <span className="text-red-400">*</span>
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write about your day, trades, lessons learned..."
          rows={6}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          disabled={isSubmitting}
        />
        <div className="text-xs text-slate-500 mt-1">
          {text.length} / 50000 characters (min 10)
        </div>
      </div>

      {/* Mood Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Mood
        </label>
        <div className="flex gap-2">
          {moods.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(m.value)}
              className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                mood === m.value
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
              disabled={isSubmitting}
            >
              <div className="text-2xl mb-1">{m.emoji}</div>
              <div className="text-xs">{m.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Mood Score */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Mood Score: {moodScore}/10
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={moodScore}
          onChange={(e) => setMoodScore(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          disabled={isSubmitting}
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Tags (comma-separated)
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g., trading, discipline, review"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          disabled={isSubmitting}
        />
      </div>

      {/* Lessons Learned */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Lessons Learned
        </label>
        <textarea
          value={lessonsLearned}
          onChange={(e) => setLessonsLearned(e.target.value)}
          placeholder="Key insights from today..."
          rows={3}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          disabled={isSubmitting}
        />
      </div>

      {/* Action Items */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Action Items (comma-separated)
        </label>
        <input
          type="text"
          value={actionItems}
          onChange={(e) => setActionItems(e.target.value)}
          placeholder="e.g., Review strategy, Practice patience"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          disabled={isSubmitting}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || text.trim().length < 10}
          className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
        >
          {isSubmitting ? 'Saving...' : 'Create Entry'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
