'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Account, TreasuryConfig } from '@/lib/treasury/calculations';
import { isOffline, getTreasuryOfflineData } from '@/lib/offline/snapshot';
import CalendarMonth from '@/components/treasury/calendar/CalendarMonth.client';
import EventModal from '@/components/treasury/calendar/EventModal.client';

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

interface CalendarioPanelProps {
  accounts: Account[];
  configs: TreasuryConfig[];
  events: CalendarEvent[];
  onRefresh?: () => Promise<void>;
}

export default function CalendarioPanel({
  accounts = [],
  configs = [],
  events = [],
  onRefresh,
}: CalendarioPanelProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineData, setOfflineData] = useState<unknown>(null);
  const [displayAccounts, setDisplayAccounts] = useState(accounts);
  const [displayConfigs, setDisplayConfigs] = useState(configs);
  const [displayEvents, setDisplayEvents] = useState(events);

  // Load offline data if not online
  useEffect(() => {
    const loadOfflineData = async () => {
      if (isOffline()) {
        setOfflineMode(true);
        const data = await getTreasuryOfflineData();
        if (data) {
          setOfflineData(data);
          setDisplayAccounts((data.accounts || []) as Account[]);
          setDisplayConfigs((data.configs || []) as TreasuryConfig[]);
          setDisplayEvents((data.calendar_events || []) as CalendarEvent[]);
        }
      } else {
        setOfflineMode(false);
        setDisplayAccounts(accounts);
        setDisplayConfigs(configs);
        setDisplayEvents(events);
      }
    };

    loadOfflineData();
  }, [accounts, configs, events]);

  // Handle month navigation
  const handlePreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  }, []);

  // Handle creating new event modal
  const handleCreateEvent = useCallback((date: Date) => {
    if (offlineMode) {
      setError('Cannot create events in offline mode');
      return;
    }
    setSelectedEvent(null);
    setIsModalOpen(true);
  }, [offlineMode]);

  // Handle event click
  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(offlineMode ? false : true); // View-only in offline mode
  }, [offlineMode]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  }, []);

  // Handle event save (from modal)
  const handleEventSave = useCallback(
    async (eventData: Partial<CalendarEvent>) => {
      if (offlineMode) {
        setError('Cannot save events in offline mode');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        if (selectedEvent?.id) {
          // Update existing event
          const res = await fetch(`/api/treasury/calendar-events/${selectedEvent.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to update event');
          }
        } else {
          // Create new event
          const res = await fetch('/api/treasury/calendar-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to create event');
          }
        }

        // Close modal and refresh
        handleModalClose();
        if (onRefresh) {
          await onRefresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    },
    [selectedEvent, handleModalClose, onRefresh, offlineMode]
  );

  // Handle event delete
  const handleEventDelete = useCallback(
    async (eventId: string) => {
      if (offlineMode) {
        setError('Cannot delete events in offline mode');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`/api/treasury/calendar-events/${eventId}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to delete event');
        }

        handleModalClose();
        if (onRefresh) {
          await onRefresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    },
    [handleModalClose, onRefresh, offlineMode]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium mb-2">Treasury Calendar</h3>
          <p className="text-sm text-slate-400">
            Monthly view with withdrawal days and custom events
          </p>
        </div>
        {offlineMode && (
          <Badge className="bg-yellow-600 text-yellow-200">
            🔌 Offline (Read-only)
          </Badge>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 text-sm">Error: {error}</p>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <CalendarMonth
          currentMonth={currentMonth}
          events={displayEvents}
          configs={displayConfigs}
          accounts={displayAccounts}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onCreateEvent={offlineMode ? () => setError('Cannot create events in offline mode') : handleCreateEvent}
          onEventClick={handleEventClick}
        />
      </div>

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-400 text-sm">
          ℹ️ Calendar shows withdrawal days per account (based on your treasury
          config) and custom events. {!offlineMode && 'Click on any day to add events.'} Events marked
          with 🔔 have push notifications enabled.
        </p>
      </div>

      {/* Event Modal */}
      {isModalOpen && !offlineMode && (
        <EventModal
          event={selectedEvent || undefined}
          accounts={displayAccounts}
          configs={displayConfigs}
          isLoading={isLoading}
          onSave={handleEventSave}
          onDelete={handleEventDelete}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
