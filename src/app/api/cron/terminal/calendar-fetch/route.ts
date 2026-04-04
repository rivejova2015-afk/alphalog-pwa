/**
 * GET /api/cron/terminal/calendar-fetch
 * Schedule: every Monday at 6am UTC (0 6 * * 1)
 *
 * Fetches high-impact economic events from Finnhub /calendar/economic
 * and inserts into terminal_events (encrypted name). Deduplicates by
 * event name + timestamp within ±1 hour.
 *
 * Security: x-cron-secret header or Authorization: Bearer
 */

import { createClient } from '@supabase/supabase-js';
import { encryptText } from '@/lib/security/encryption';
import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const USER_ID        = '381e268e-a042-4612-8b39-7a120ace17d6';
const FETCH_TIMEOUT  = 12_000;
const LOOK_AHEAD_DAYS = 14; // fetch next 2 weeks

const FinnhubEventSchema = z.object({
  event:  z.string(),
  time:   z.string().optional(),
  impact: z.string().optional(),
  country: z.string().optional(),
});

const FinnhubCalendarSchema = z.object({
  economicCalendar: z.array(FinnhubEventSchema).optional(),
});

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

async function handleCalendarFetch(request: NextRequest) {
  // Auth
  const expectedSecret = process.env.CRON_SECRET;
  const xCronSecret    = request.headers.get('x-cron-secret');
  const authHeader     = request.headers.get('authorization') ?? '';
  const bearerToken    = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token          = xCronSecret || bearerToken;

  let authorized = false;
  try {
    if (token && expectedSecret) {
      const a = Buffer.from(token);
      const b = Buffer.from(expectedSecret);
      authorized = a.length === b.length && timingSafeEqual(a, b);
    }
  } catch {
    authorized = false;
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY not configured' }, { status: 500 });
  }

  const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Date range: today → today + LOOK_AHEAD_DAYS
  const fromDate = new Date();
  const toDate   = new Date(Date.now() + LOOK_AHEAD_DAYS * 24 * 60 * 60 * 1000);
  const fmt      = (d: Date) => d.toISOString().split('T')[0];

  let rawEvents: z.infer<typeof FinnhubEventSchema>[] = [];

  try {
    const res = await fetchWithTimeout(
      `https://finnhub.io/api/v1/calendar/economic?from=${fmt(fromDate)}&to=${fmt(toDate)}&token=${finnhubKey}`,
      FETCH_TIMEOUT
    );
    if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);

    const json   = await res.json();
    const parsed = FinnhubCalendarSchema.safeParse(json);
    if (!parsed.success) throw new Error('Finnhub calendar schema mismatch');

    rawEvents = parsed.data.economicCalendar ?? [];
  } catch (e) {
    console.error('[calendar-fetch] Finnhub error:', e);
    return NextResponse.json({ error: 'Failed to fetch calendar', details: String(e) }, { status: 502 });
  }

  // Filter: high impact only (case-insensitive)
  const highImpact = rawEvents.filter(
    (e) => (e.impact ?? '').toLowerCase() === 'high'
  );

  if (highImpact.length === 0) {
    return NextResponse.json({ ok: true, fetched: rawEvents.length, inserted: 0, skipped: 0 });
  }

  // Load existing events in the window to dedup (by timestamp ±1h)
  const { data: existingEvents } = await supabase
    .from('terminal_events')
    .select('timestamp_utc')
    .eq('user_id', USER_ID)
    .gte('timestamp_utc', fromDate.toISOString())
    .lte('timestamp_utc', toDate.toISOString())
    .is('deleted_at', null);

  const existingTimestamps = (existingEvents ?? []).map(
    (e: { timestamp_utc: string }) => new Date(e.timestamp_utc).getTime()
  );

  function isDuplicate(ts: number): boolean {
    const ONE_HOUR = 60 * 60 * 1000;
    return existingTimestamps.some((t) => Math.abs(t - ts) <= ONE_HOUR);
  }

  let inserted = 0;
  let skipped  = 0;

  for (const event of highImpact) {
    if (!event.event || !event.time) {
      skipped++;
      continue;
    }

    const ts = new Date(event.time).getTime();
    if (isNaN(ts)) {
      skipped++;
      continue;
    }

    if (isDuplicate(ts)) {
      skipped++;
      continue;
    }

    const rawName = event.event.slice(0, 200);
    let encryptedName: string;
    try {
      encryptedName = encryptText(rawName) ?? rawName;
    } catch {
      encryptedName = rawName;
    }

    const { error } = await supabase.from('terminal_events').insert({
      user_id:       USER_ID,
      instrument_id: null, // global macro event — not instrument-specific
      name:          encryptedName,
      impact:        'high',
      timestamp_utc: new Date(ts).toISOString(),
    });

    if (error) {
      console.error('[calendar-fetch] Insert error:', error.message);
      skipped++;
    } else {
      inserted++;
      existingTimestamps.push(ts); // prevent dupes within same batch
    }
  }

  // Log to app_logs
  await supabase.from('app_logs').insert({
    user_id: USER_ID,
    level:   'info',
    area:    'calendar_pipeline',
    message: `Calendar sync complete: ${inserted} inserted, ${skipped} skipped of ${highImpact.length} high-impact events`,
    meta: { fetched: rawEvents.length, high_impact: highImpact.length, inserted, skipped },
  });

  return NextResponse.json({
    ok:         true,
    fetched:    rawEvents.length,
    high_impact: highImpact.length,
    inserted,
    skipped,
  });
}

export const GET  = handleCalendarFetch;
export const POST = handleCalendarFetch;
