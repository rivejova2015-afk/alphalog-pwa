'use client';

/**
 * Journal Entry List Component
 * Displays list of journal entries with infinite scroll
 */

import { useState, useEffect } from 'react';
import type { JournalEntry } from '@/lib/alphacore/contracts';
import { logger } from '@/lib/alphashield/logger';

interface JournalEntryListProps {
  userId: string;
  onSelectEntry?: (entry: JournalEntry) => void;
}

export function JournalEntryList({ userId, onSelectEntry }: JournalEntryListProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const response = await fetch('/api/journal');
        if (!response.ok) {
          throw new Error('Failed to load entries');
        }

        const data = (await response.json()) as JournalEntry[];
        setEntries(data || []);
      } catch (err) {
        await logger.error(
          'journal',
          'Error fetching entries',
          err instanceof Error ? err : undefined
        );
        setError(err instanceof Error ? err.message : 'Failed to load entries');
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [userId]);

  if (loading) {
    return (
      <div className="p-4 text-center text-slate-400">
        Loading entries...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-400">
        Error: {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-4">📓</div>
        <h3 className="text-lg font-medium text-slate-300 mb-2">No entries yet</h3>
        <p className="text-sm text-slate-500">
          Create your first journal entry to get started
        </p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getMoodEmoji = (mood: string | null | undefined) => {
    if (!mood) return '😐';
    const moodMap: Record<string, string> = {
      excellent: '🤩',
      good: '😊',
      neutral: '😐',
      bad: '😔',
      terrible: '😫'
    };
    return moodMap[mood] || '😐';
  };

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          onClick={() => onSelectEntry?.(entry)}
          className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-cyan-500 transition-colors cursor-pointer"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{getMoodEmoji(entry.mood)}</span>
              <span className="text-xs text-slate-500">{formatDate(entry.created_at)}</span>
            </div>
            {entry.mood_score && (
              <div className="text-xs font-medium text-slate-400">
                {entry.mood_score}/10
              </div>
            )}
          </div>
          
          <p className="text-slate-300 text-sm line-clamp-3 mb-2">
            {entry.text}
          </p>

          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded"
                >
                  {tag}
                </span>
              ))}
              {entry.tags.length > 3 && (
                <span className="text-xs px-2 py-0.5 text-slate-500">
                  +{entry.tags.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
