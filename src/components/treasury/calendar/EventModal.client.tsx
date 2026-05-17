'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui';
import type { Account, TreasuryConfig } from '@/lib/treasury/calculations';

interface CalendarEvent {
  id: string;
  user_id: string;
  account_id: string;
  event_date: string; // YYYY-MM-DD
  title: string;
  kind: 'payout_cycle' | 'payout_day' | 'note';
  push_enabled: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface EventModalProps {
  event?: CalendarEvent;
  accounts: Account[];
  configs: TreasuryConfig[];
  isLoading: boolean;
  onSave: (eventData: Partial<CalendarEvent>) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
  onClose: () => void;
}

export default function EventModal({
  event,
  accounts,
  configs,
  isLoading,
  onSave,
  onDelete,
  onClose,
}: EventModalProps) {
  const [accountId, setAccountId] = useState(event?.account_id || '');
  const [eventDate, setEventDate] = useState(event?.event_date || '');
  const [title, setTitle] = useState(event?.title || '');
  const [kind, setKind] = useState<'payout_cycle' | 'payout_day' | 'note'>(
    event?.kind || 'note'
  );
  const [pushEnabled, setPushEnabled] = useState(event?.push_enabled ?? true);
  const [error, setError] = useState<string | null>(null);

  // Get available accounts for this user
  const availableAccounts = accounts;

  const handleSave = async () => {
    try {
      setError(null);

      // Validate inputs
      if (!accountId) {
        setError('Please select an account');
        return;
      }
      if (!eventDate) {
        setError('Please select a date');
        return;
      }
      if (!title.trim()) {
        setError('Please enter a title');
        return;
      }

      await onSave({
        account_id: accountId,
        event_date: eventDate,
        title: title.trim(),
        kind,
        push_enabled: pushEnabled,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!event) return;
    try {
      setError(null);
      await onDelete(event.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-white">
        <CardHeader>
          <CardTitle>
            {event ? 'Edit Event' : 'Create Event'}
          </CardTitle>
          <p className="text-slate-400 text-sm mt-2">
            {event
              ? 'Update the event details below'
              : 'Add a new calendar event for your account'}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error message */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Account selector */}
          <div className="space-y-2">
            <label htmlFor="account" className="block text-sm font-medium text-white">
              Account *
            </label>
            <select
              id="account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={isLoading}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">Select account</option>
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name || account.id}
                </option>
              ))}
            </select>
          </div>

          {/* Date input */}
          <div className="space-y-2">
            <label htmlFor="date" className="block text-sm font-medium text-white">
              Date *
            </label>
            <Input
              id="date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              disabled={isLoading}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          {/* Title input */}
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-white">
              Title *
            </label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              disabled={isLoading}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          {/* Kind selector */}
          <div className="space-y-2">
            <label htmlFor="kind" className="block text-sm font-medium text-white">
              Type
            </label>
            <select
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'payout_cycle' | 'payout_day' | 'note')}
              disabled={isLoading}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="note">Note</option>
              <option value="payout_day">Payout Day</option>
              <option value="payout_cycle">Payout Cycle</option>
            </select>
          </div>

          {/* Push notification toggle */}
          <div className="flex items-center gap-3 pt-2">
            <input
              id="push-enabled"
              type="checkbox"
              checked={pushEnabled}
              onChange={(e) => setPushEnabled(e.target.checked)}
              disabled={isLoading}
              className="w-4 h-4 rounded"
            />
            <label
              htmlFor="push-enabled"
              className="text-sm font-medium text-white cursor-pointer"
            >
              Enable push notification reminder
            </label>
          </div>
        </CardContent>

        {/* Footer with buttons */}
        <div className="border-t border-slate-800 p-4 flex gap-2 justify-between">
          {event && (
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={isLoading}
              className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-500/30"
            >
              Delete
            </Button>
          )}
          <div className="flex gap-2 flex-1 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="border-slate-700 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar evento"
        message="Esta acción no se puede deshacer."
        variant="danger"
        confirmLabel="Eliminar"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
