'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface CalendarMonthProps {
  currentMonth: Date;
  events: CalendarEvent[];
  configs: TreasuryConfig[];
  accounts: Account[];
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onCreateEvent: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export default function CalendarMonth({
  currentMonth,
  events,
  configs,
  accounts,
  onPreviousMonth,
  onNextMonth,
  onCreateEvent,
  onEventClick,
}: CalendarMonthProps) {
  // Get calendar grid for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of month and number of days in month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

    // Build calendar grid
    const days: Array<{ date: Date | null; dayOfMonth: number | null }> = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: null, dayOfMonth: null });
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        dayOfMonth: day,
      });
    }

    return days;
  }, [currentMonth]);

  // Format date as YYYY-MM-DD
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date | null): CalendarEvent[] => {
    if (!date) return [];
    const dateStr = formatDateString(date);
    return events.filter((e) => e.event_date === dateStr && !e.deleted_at);
  };

  // Get withdrawal day for a specific date
  const getWithdrawalDaysForDate = (date: Date | null): Array<{ accountId: string; accountName?: string }> => {
    if (!date) return [];
    const dayOfMonth = date.getDate();

    return configs
      .filter((c) => c.withdrawal_day === dayOfMonth)
      .map((c) => {
        const account = accounts.find((a) => a.id === c.account_id);
        return {
          accountId: c.account_id,
          accountName: account?.name,
        };
      });
  };

  // Month and year display
  const monthName = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Week day headers
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{monthName}</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreviousMonth}
            className="border-slate-700 hover:bg-slate-800"
          >
            ← Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNextMonth}
            className="border-slate-700 hover:bg-slate-800"
          >
            Next →
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="space-y-2">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-slate-400 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const dayEvents = getEventsForDate(day.date);
            const withdrawalDays = getWithdrawalDaysForDate(day.date);
            const isToday =
              day.date &&
              new Date().toDateString() === day.date.toDateString();

            if (!day.date) {
              // Empty cell
              return (
                <div
                  key={`empty-${index}`}
                  className="bg-slate-900/50 aspect-square rounded"
                />
              );
            }

            return (
              <div
                key={formatDateString(day.date)}
                className={`
                  aspect-square rounded border cursor-pointer transition-colors
                  ${
                    isToday
                      ? 'bg-blue-900/40 border-blue-500'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }
                `}
                onClick={() => onCreateEvent(day.date!)}
              >
                <div className="p-2 h-full flex flex-col text-xs">
                  {/* Day number */}
                  <div className={`font-semibold ${isToday ? 'text-blue-400' : 'text-white'}`}>
                    {day.dayOfMonth}
                  </div>

                  {/* Withdrawal days */}
                  <div className="mt-1 space-y-0.5 flex-1 overflow-y-auto">
                    {withdrawalDays.map((wd) => (
                      <div
                        key={wd.accountId}
                        className="bg-purple-900/60 text-purple-200 px-1 py-0.5 rounded text-xs truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        💳 {wd.accountName || 'Account'}
                      </div>
                    ))}

                    {/* Custom events */}
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`
                          px-1 py-0.5 rounded text-xs truncate cursor-pointer hover:opacity-80
                          ${
                            event.kind === 'payout_day'
                              ? 'bg-green-900/60 text-green-200'
                              : event.kind === 'payout_cycle'
                              ? 'bg-blue-900/60 text-blue-200'
                              : 'bg-slate-700 text-slate-200'
                          }
                        `}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        title={event.title}
                      >
                        {event.push_enabled ? '🔔 ' : ''}
                        {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-4 border-t border-slate-800">
        <div>💳 Withdrawal Day (from config)</div>
        <div>🔔 Push notification enabled</div>
        <div className="flex gap-1 items-center">
          <div className="w-2 h-2 bg-purple-600 rounded"></div>
          Withdrawal days
        </div>
        <div className="flex gap-1 items-center">
          <div className="w-2 h-2 bg-green-600 rounded"></div>
          Payout days
        </div>
      </div>
    </div>
  );
}
