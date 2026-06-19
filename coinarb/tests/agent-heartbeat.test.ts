import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildAgentHeartbeatPayload, syncAgentHeartbeat } from '../src/ops/agent-heartbeat.js';

describe('buildAgentHeartbeatPayload', () => {
  const originalFlyMachine = process.env.FLY_MACHINE_ID;
  const originalFlyAlloc = process.env.FLY_ALLOC_ID;

  beforeEach(() => {
    delete process.env.FLY_MACHINE_ID;
    delete process.env.FLY_ALLOC_ID;
  });

  afterEach(() => {
    if (originalFlyMachine !== undefined) process.env.FLY_MACHINE_ID = originalFlyMachine;
    if (originalFlyAlloc !== undefined) process.env.FLY_ALLOC_ID = originalFlyAlloc;
  });

  it('returns RUNNING when not paused', () => {
    const payload = buildAgentHeartbeatPayload(false, new Date('2026-06-19T15:00:00Z'));
    expect(payload.status).toBe('RUNNING');
    expect(payload.last_heartbeat_at).toBe('2026-06-19T15:00:00.000Z');
  });

  it('returns PAUSED when paused', () => {
    const payload = buildAgentHeartbeatPayload(true);
    expect(payload.status).toBe('PAUSED');
  });

  it('reads FLY_MACHINE_ID when set', () => {
    process.env.FLY_MACHINE_ID = 'machine-abc';
    const payload = buildAgentHeartbeatPayload(false);
    expect(payload.fly_instance_id).toBe('machine-abc');
  });

  it('falls back to FLY_ALLOC_ID', () => {
    process.env.FLY_ALLOC_ID = 'alloc-xyz';
    const payload = buildAgentHeartbeatPayload(false);
    expect(payload.fly_instance_id).toBe('alloc-xyz');
  });

  it('returns null fly_instance_id when neither env var is set', () => {
    const payload = buildAgentHeartbeatPayload(false);
    expect(payload.fly_instance_id).toBeNull();
  });
});

describe('syncAgentHeartbeat', () => {
  it('returns ok:false when userId is undefined', async () => {
    const calls: string[] = [];
    const supabase = { from: (t: string) => { calls.push(t); return {} as never; } };
    const result = await syncAgentHeartbeat(supabase as never, undefined, false);
    expect(result).toEqual({ ok: false, error: 'no user_id' });
    expect(calls).toEqual([]); // no DB call
  });

  it('UPDATE coinarb_agents WHERE user_id with the payload', async () => {
    const captured: { table?: string; payload?: unknown; whereCol?: string; whereVal?: string } = {};
    const supabase = {
      from: (t: string) => {
        captured.table = t;
        return {
          update: (p: unknown) => {
            captured.payload = p;
            return {
              eq: async (col: string, val: string) => {
                captured.whereCol = col;
                captured.whereVal = val;
                return { error: null };
              },
            };
          },
        };
      },
    };
    const result = await syncAgentHeartbeat(supabase as never, 'user-1', false);
    expect(result.ok).toBe(true);
    expect(captured.table).toBe('coinarb_agents');
    expect(captured.whereCol).toBe('user_id');
    expect(captured.whereVal).toBe('user-1');
    expect((captured.payload as { status: string }).status).toBe('RUNNING');
  });

  it('surfaces Supabase errors as ok:false with message', async () => {
    const supabase = {
      from: () => ({
        update: () => ({
          eq: async () => ({ error: { message: 'permission denied' } }),
        }),
      }),
    };
    const result = await syncAgentHeartbeat(supabase as never, 'user-1', true);
    expect(result).toEqual({ ok: false, error: 'permission denied' });
  });
});
