import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @supabase/supabase-js's createClient so getSupabase() inside the
// poller resolves against our fake client. We build a fluent query builder
// whose terminal methods return the data we want per query.
type QueueEntry = { table: string; ops: string[]; result: { data: unknown; error?: { message: string } | null } };
const queryQueue: QueueEntry[] = [];
const inserts: Record<string, unknown>[] = [];
const updates: { table: string; payload: Record<string, unknown>; eqs: [string, unknown][] }[] = [];

function makeBuilder(table: string) {
  const ops: string[] = [];
  const eqs: [string, unknown][] = [];

  const builder: {
    [k: string]: (...args: unknown[]) => unknown;
  } & PromiseLike<unknown> = {
    select(_cols: string) { ops.push(`select:${_cols}`); return builder; },
    eq(col: string, val: unknown) { ops.push(`eq:${col}=${val}`); eqs.push([col, val]); return builder; },
    in(col: string, vals: unknown[]) { ops.push(`in:${col}=${JSON.stringify(vals)}`); return builder; },
    order(col: string, _opts?: unknown) { ops.push(`order:${col}`); return builder; },
    limit(n: number) { ops.push(`limit:${n}`); return builder; },
    update(payload: Record<string, unknown>) {
      ops.push('update');
      updates.push({ table, payload, eqs });
      return builder;
    },
    insert(payload: Record<string, unknown>) {
      ops.push('insert');
      inserts.push({ table, ...payload });
      // insert resolves to { error: null }
      return Promise.resolve({ error: null });
    },
    maybeSingle() { ops.push('maybeSingle'); return resolve(); },
    then(onFulfilled: (v: unknown) => unknown) { return resolve().then(onFulfilled); },
  };

  function resolve() {
    const next = queryQueue.shift();
    if (!next || next.table !== table) {
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve(next.result);
  }

  return builder;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => makeBuilder(table),
  }),
}));

// Now safe to import the poller — the import will pick up our mock.
const { CommandPoller } = await import('../src/ops/command-poller.js');
const config = await import('../src/core/config.js');

// Required by getSupabase() before it's called.
process.env.SUPABASE_URL ??= 'http://test';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-key';

describe('CommandPoller.process', () => {
  beforeEach(() => {
    queryQueue.length = 0;
    inserts.length = 0;
    updates.length = 0;
    if (config.TRADING_PAUSED) config.setTradingPaused(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('update_parameters applies thresholds and acks DONE', async () => {
    queryQueue.push({
      table: 'bot_commands',
      ops: [],
      result: {
        data: [{
          id: 'cmd-1', bot_id: 'bot-a', command_type: 'update_parameters',
          payload: { parameters: { mtf_confidence_min: 0.42 } },
          status: 'pending', created_at: '2026-01-01',
        }],
        error: null,
      },
    });

    const p = new CommandPoller();
    // call the private poll() via type bypass; cleanest path for unit test
    await (p as unknown as { poll: () => Promise<void> }).poll();

    expect(config.MTF_CONFIDENCE_MIN).toBe(0.42);
    expect(updates.find(u => u.table === 'bot_commands' && u.payload.status === 'DONE')).toBeTruthy();
    const ack = inserts.find(i => i.table === 'bot_command_status');
    expect(ack).toBeTruthy();
    expect((ack as Record<string, unknown>).status).toBe('DONE');
  });

  it('pause command flips TRADING_PAUSED and acks DONE', async () => {
    queryQueue.push({
      table: 'bot_commands',
      ops: [],
      result: {
        data: [{
          id: 'cmd-2', bot_id: 'bot-a', command_type: 'pause',
          payload: { source: 'ui' }, status: 'pending', created_at: '2026-01-01',
        }],
        error: null,
      },
    });

    const p = new CommandPoller();
    await (p as unknown as { poll: () => Promise<void> }).poll();

    expect(config.TRADING_PAUSED).toBe(true);
    expect(updates.find(u => u.payload.status === 'DONE')).toBeTruthy();
  });

  it('resume command flips TRADING_PAUSED back to false', async () => {
    config.setTradingPaused(true);
    queryQueue.push({
      table: 'bot_commands',
      ops: [],
      result: {
        data: [{
          id: 'cmd-3', bot_id: 'bot-a', command_type: 'resume',
          payload: { source: 'ui' }, status: 'pending', created_at: '2026-01-01',
        }],
        error: null,
      },
    });

    const p = new CommandPoller();
    await (p as unknown as { poll: () => Promise<void> }).poll();
    expect(config.TRADING_PAUSED).toBe(false);
  });

  it('unsupported command_type acks FAILED with explanatory message', async () => {
    queryQueue.push({
      table: 'bot_commands',
      ops: [],
      result: {
        data: [{
          id: 'cmd-4', bot_id: 'bot-a', command_type: 'rocket_launch',
          payload: {}, status: 'pending', created_at: '2026-01-01',
        }],
        error: null,
      },
    });

    const p = new CommandPoller();
    await (p as unknown as { poll: () => Promise<void> }).poll();

    const update = updates.find(u => u.table === 'bot_commands');
    expect(update?.payload.status).toBe('FAILED');
    const ack = inserts.find(i => i.table === 'bot_command_status') as Record<string, unknown>;
    expect(ack.status).toBe('FAILED');
    expect((ack.message as string)).toContain('unsupported command_type: rocket_launch');
  });

  it('no commands → no insert/update activity', async () => {
    queryQueue.push({ table: 'bot_commands', ops: [], result: { data: [], error: null } });
    const p = new CommandPoller();
    await (p as unknown as { poll: () => Promise<void> }).poll();
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it('inFlight guard prevents concurrent poll runs', async () => {
    queryQueue.push({ table: 'bot_commands', ops: [], result: { data: [], error: null } });
    queryQueue.push({ table: 'bot_commands', ops: [], result: { data: [], error: null } });

    const p = new CommandPoller();
    const poll = (p as unknown as { poll: () => Promise<void> }).poll;
    // Fire two polls concurrently; the second should bail before hitting Supabase.
    const [, ] = await Promise.all([poll.call(p), poll.call(p)]);
    // Only one of the queue entries should have been consumed.
    expect(queryQueue.length).toBe(1);
  });
});
