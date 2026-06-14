// Unit tests for src/lib/treasury/pushNotifications.ts.
//
// sendThresholdPush: notifica retiro disponible + actualiza last_threshold_
// push_cycle_start. Validates:
//   - returns false sin subscriptions o subError.
//   - Parsea subscriptions string-JSON (DB legacy) AND objetos directos.
//   - Filtra subscriptions corruptas.
//   - sendPushToSubscriptions invoked con payload {title, body, tag, data}.
//   - last_threshold_push_cycle_start update tras sent>0.
//   - returns true cuando sent>0; false cuando sent=0.
//   - Catch silencioso cuando supabase throws.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendPushMock } = vi.hoisted(() => ({
  sendPushMock: vi.fn(),
}));

vi.mock("../../push/webpush.server", () => ({
  sendPushToSubscriptions: sendPushMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

import { sendThresholdPush } from "../pushNotifications";

interface FakeSubRow {
  subscription: string | object;
}

function mockSupabase({
  subs,
  subError,
  updateError,
}: {
  subs?:        FakeSubRow[] | null;
  subError?:    { message: string };
  updateError?: { message: string };
}) {
  const updates: Array<{ patch: unknown; accountId: string | null }> = [];
  return {
    from: (table: string) => {
      if (table === "push_subscriptions") {
        const proxy: Record<string, unknown> = {};
        proxy.select = () => proxy;
        proxy.eq     = () => proxy;
        proxy.is     = () => proxy;
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: subs ?? null, error: subError ?? null }).then(resolve);
        return proxy;
      }
      if (table === "treasury_configs") {
        const proxy: Record<string, unknown> = {};
        proxy.update = (patch: unknown) => {
          let capturedId: string | null = null;
          const upd: Record<string, unknown> = {};
          upd.eq = (col: string, val: string) => {
            if (col === "account_id") capturedId = val;
            return upd;
          };
          upd.then = (resolve: (v: unknown) => unknown) => {
            updates.push({ patch, accountId: capturedId });
            return Promise.resolve({ error: updateError ?? null }).then(resolve);
          };
          return upd;
        };
        return proxy;
      }
      return {};
    },
    _updates: updates,
  };
}

const PAYLOAD = {
  accountId:      "acc-1",
  accountName:    "Main account",
  userId:         "u1",
  cycleStartDate: "2026-06-01",
};

describe("sendThresholdPush", () => {
  beforeEach(() => {
    sendPushMock.mockReset();
  });

  it("returns false cuando subError", async () => {
    const sb = mockSupabase({ subs: null, subError: { message: "rls denied" } });
    const result = await sendThresholdPush(PAYLOAD, sb);
    expect(result).toBe(false);
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("returns false cuando no hay subscriptions (array vacío)", async () => {
    const sb = mockSupabase({ subs: [] });
    const result = await sendThresholdPush(PAYLOAD, sb);
    expect(result).toBe(false);
  });

  it("returns false cuando todas las subscriptions son corruptas (JSON inválido)", async () => {
    const sb = mockSupabase({ subs: [{ subscription: "{not-json" }] });
    const result = await sendThresholdPush(PAYLOAD, sb);
    expect(result).toBe(false);
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("parsea subscription string-JSON (DB legacy)", async () => {
    sendPushMock.mockResolvedValue({ sent: 1, failed: 0 });
    const sub = { endpoint: "https://fcm/x", keys: { auth: "a", p256dh: "p" } };
    const sb = mockSupabase({ subs: [{ subscription: JSON.stringify(sub) }] });

    await sendThresholdPush(PAYLOAD, sb);
    expect(sendPushMock).toHaveBeenCalledWith([sub], expect.any(Object));
  });

  it("parsea subscription como object directo (cuando ya viene parseado)", async () => {
    sendPushMock.mockResolvedValue({ sent: 1, failed: 0 });
    const sub = { endpoint: "https://fcm/x", keys: { auth: "a", p256dh: "p" } };
    const sb = mockSupabase({ subs: [{ subscription: sub }] });

    await sendThresholdPush(PAYLOAD, sb);
    expect(sendPushMock).toHaveBeenCalledWith([sub], expect.any(Object));
  });

  it("envía payload con title + body + tag + data correctos", async () => {
    sendPushMock.mockResolvedValue({ sent: 1, failed: 0 });
    const sb = mockSupabase({ subs: [{ subscription: { endpoint: "x", keys: { auth: "a", p256dh: "p" } } }] });

    await sendThresholdPush(PAYLOAD, sb);
    const [, payload] = sendPushMock.mock.calls[0];
    expect(payload).toMatchObject({
      title: "✅ Umbral alcanzado",
      body:  "Ya puedes retirar en Main account",
      tag:   "threshold-acc-1",
    });
    expect(payload.data).toMatchObject({
      accountId:   "acc-1",
      accountName: "Main account",
      action:      "openTreasuryTab",
      tab:         "cashflow",
    });
  });

  it("sent>0 → returns true Y actualiza last_threshold_push_cycle_start", async () => {
    sendPushMock.mockResolvedValue({ sent: 2, failed: 0 });
    const sb = mockSupabase({ subs: [{ subscription: { endpoint: "x", keys: { auth: "a", p256dh: "p" } } }] });

    const result = await sendThresholdPush(PAYLOAD, sb);
    expect(result).toBe(true);
    expect(sb._updates).toHaveLength(1);
    expect(sb._updates[0].patch).toMatchObject({ last_threshold_push_cycle_start: "2026-06-01" });
    expect(sb._updates[0].accountId).toBe("acc-1");
  });

  it("sent=0 (todas las subs fallaron) → returns false sin actualizar", async () => {
    sendPushMock.mockResolvedValue({ sent: 0, failed: 1 });
    const sb = mockSupabase({ subs: [{ subscription: { endpoint: "x", keys: { auth: "a", p256dh: "p" } } }] });
    const result = await sendThresholdPush(PAYLOAD, sb);
    expect(result).toBe(false);
    expect(sb._updates).toHaveLength(0);
  });

  it("update error no rompe el return true (logged pero non-blocking)", async () => {
    sendPushMock.mockResolvedValue({ sent: 1, failed: 0 });
    const sb = mockSupabase({
      subs: [{ subscription: { endpoint: "x", keys: { auth: "a", p256dh: "p" } } }],
      updateError: { message: "update boom" },
    });
    const result = await sendThresholdPush(PAYLOAD, sb);
    expect(result).toBe(true);
  });

  it("catch silencioso cuando supabase throws unexpected", async () => {
    const badSb = {
      from: () => { throw new Error("supabase exploded"); },
    } as unknown as Parameters<typeof sendThresholdPush>[1];
    const result = await sendThresholdPush(PAYLOAD, badSb);
    expect(result).toBe(false);
    expect(sendPushMock).not.toHaveBeenCalled();
  });
});
