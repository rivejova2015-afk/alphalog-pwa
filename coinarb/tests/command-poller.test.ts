import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the pg-client module so getPg() inside the poller resolves against a
// fake tagged-template `sql` function. postgres.js tagged calls are invoked
// as `fn(stringsArray, ...values)` (stringsArray has a `.raw` property); the
// dynamic `pg(row)` insert helper is invoked as a plain function call with a
// single plain-object argument (no `.raw`). We tell those apart and route
// SELECT/UPDATE/INSERT into queues the tests can assert against.
type Row = Record<string, unknown>;

const selectQueue: Row[][] = [];
const inserts: { table: string; row: Row }[] = [];
const updates: { text: string; values: unknown[] }[] = [];

function isTemplateStrings(x: unknown): x is TemplateStringsArray {
  return Array.isArray(x) && 'raw' in (x as object);
}

function mockSql(stringsOrRow: TemplateStringsArray | Row, ...values: unknown[]) {
  if (!isTemplateStrings(stringsOrRow)) {
    // pg(row) dynamic-insert helper — return a marker fragment carrying the row.
    return { __insertRow: stringsOrRow };
  }

  const text = stringsOrRow.join(' ? ').replace(/\s+/g, ' ').trim();

  if (/^SELECT/i.test(text)) {
    return Promise.resolve(selectQueue.shift() ?? []);
  }
  if (/^UPDATE/i.test(text)) {
    updates.push({ text, values });
    return Promise.resolve([]);
  }
  if (/^INSERT/i.test(text)) {
    const fragment = values.find(
      (v): v is { __insertRow: Row } => !!v && typeof v === 'object' && '__insertRow' in (v as object),
    );
    const table = /INSERT INTO (\w+)/i.exec(text)?.[1] ?? 'unknown';
    inserts.push({ table, row: fragment?.__insertRow ?? {} });
    return Promise.resolve([]);
  }
  return Promise.resolve([]);
}

vi.mock('../src/pg-client.js', () => ({
  getPg: () => mockSql,
}));

// Now safe to import the poller — the import will pick up our mock.
const { CommandPoller } = await import('../src/ops/command-poller.js');
const config = await import('../src/core/config.js');

describe('CommandPoller.process', () => {
  beforeEach(() => {
    selectQueue.length = 0;
    inserts.length = 0;
    updates.length = 0;
    if (config.TRADING_PAUSED) config.setTradingPaused(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('update_parameters applies thresholds and acks DONE', async () => {
    selectQueue.push([{
      id: 'cmd-1', bot_id: 'bot-a', command_type: 'update_parameters',
      payload: { parameters: { mtf_confidence_min: 0.42 } },
      status: 'pending', created_at: '2026-01-01',
    }]);

    const p = new CommandPoller();
    // call the private poll() via type bypass; cleanest path for unit test
    await (p as unknown as { poll: () => Promise<void> }).poll();

    expect(config.MTF_CONFIDENCE_MIN).toBe(0.42);
    const bcUpdate = updates.find(u => /bot_commands/i.test(u.text));
    expect(bcUpdate).toBeTruthy();
    expect(bcUpdate?.values[0]).toBe('DONE');
    const ack = inserts.find(i => i.table === 'bot_command_status');
    expect(ack).toBeTruthy();
    expect(ack?.row.status).toBe('DONE');
  });

  it('pause command flips TRADING_PAUSED and acks DONE', async () => {
    selectQueue.push([{
      id: 'cmd-2', bot_id: 'bot-a', command_type: 'pause',
      payload: { source: 'ui' }, status: 'pending', created_at: '2026-01-01',
    }]);

    const p = new CommandPoller();
    await (p as unknown as { poll: () => Promise<void> }).poll();

    expect(config.TRADING_PAUSED).toBe(true);
    const bcUpdate = updates.find(u => /bot_commands/i.test(u.text));
    expect(bcUpdate?.values[0]).toBe('DONE');
  });

  it('resume command flips TRADING_PAUSED back to false', async () => {
    config.setTradingPaused(true);
    selectQueue.push([{
      id: 'cmd-3', bot_id: 'bot-a', command_type: 'resume',
      payload: { source: 'ui' }, status: 'pending', created_at: '2026-01-01',
    }]);

    const p = new CommandPoller();
    await (p as unknown as { poll: () => Promise<void> }).poll();
    expect(config.TRADING_PAUSED).toBe(false);
  });

  it('unsupported command_type acks FAILED with explanatory message', async () => {
    selectQueue.push([{
      id: 'cmd-4', bot_id: 'bot-a', command_type: 'rocket_launch',
      payload: {}, status: 'pending', created_at: '2026-01-01',
    }]);

    const p = new CommandPoller();
    await (p as unknown as { poll: () => Promise<void> }).poll();

    const bcUpdate = updates.find(u => /bot_commands/i.test(u.text));
    expect(bcUpdate?.values[0]).toBe('FAILED');
    const ack = inserts.find(i => i.table === 'bot_command_status');
    expect(ack?.row.status).toBe('FAILED');
    expect(ack?.row.message as string).toContain('unsupported command_type: rocket_launch');
  });

  it('no commands → no insert/update activity', async () => {
    selectQueue.push([]);
    const p = new CommandPoller();
    await (p as unknown as { poll: () => Promise<void> }).poll();
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it('inFlight guard prevents concurrent poll runs', async () => {
    selectQueue.push([]);
    selectQueue.push([]);

    const p = new CommandPoller();
    const poll = (p as unknown as { poll: () => Promise<void> }).poll;
    // Fire two polls concurrently; the second should bail before hitting Postgres.
    const [, ] = await Promise.all([poll.call(p), poll.call(p)]);
    // Only one of the queue entries should have been consumed.
    expect(selectQueue.length).toBe(1);
  });
});
