/**
 * Raw postgres.js client for the coinarb bot's self-hosted Postgres tables.
 *
 * Only the 16 bot-critical tables (see docs/superpowers/specs design doc in
 * alphalog-pwa) live here — this bot's calls are simple single-table
 * inserts/selects/updates, so we use the tagged-template client directly
 * instead of a Supabase-compatible chainable shim.
 */

import postgres from 'postgres';

let client: ReturnType<typeof postgres> | null = null;

export function getPg() {
  if (client) return client;

  const url = process.env.ALPHALOG_PG_URL;
  if (!url) throw new Error('Missing ALPHALOG_PG_URL');

  client = postgres(url, { max: 5 });
  return client;
}
