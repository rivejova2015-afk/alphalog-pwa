// Unit tests for src/lib/push/webpush.server.ts.
//
// Web-push wrapper con VAPID + error mapping (410=EXPIRED, 404=NOT_FOUND).
// Validates:
//   - sendPushToSubscription no-op cuando VAPID keys no configuradas.
//   - sendPushToSubscription invokes webpush.sendNotification con payload JSON
//     incluyendo defaults (icon, badge, tag, data).
//   - 410 status → throws 'SUBSCRIPTION_EXPIRED'.
//   - 404 status → throws 'SUBSCRIPTION_NOT_FOUND'.
//   - Otros WebPushError → re-throw original.
//   - sendPushToSubscriptions returns {sent:0, failed:0} cuando VAPID off.
//   - sendPushToSubscriptions aggregates counters por subscription.
//   - getVapidPublicKey throws cuando no está configurada.

import { describe, it, expect, vi, beforeEach } from "vitest";

class FakeWebPushError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "WebPushError";
  }
}

const { setVapidDetailsMock, sendNotificationMock } = vi.hoisted(() => ({
  setVapidDetailsMock:  vi.fn(),
  sendNotificationMock: vi.fn(),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails:  setVapidDetailsMock,
    sendNotification: sendNotificationMock,
    WebPushError:     FakeWebPushError,
  },
  WebPushError: FakeWebPushError,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

const VALID_SUBSCRIPTION = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys:     { p256dh: "p256dh-key", auth: "auth-key" },
};

describe("webpush.server — VAPID configured", () => {
  let sendPushToSubscription: typeof import("../webpush.server").sendPushToSubscription;
  let sendPushToSubscriptions: typeof import("../webpush.server").sendPushToSubscriptions;
  let getVapidPublicKey:        typeof import("../webpush.server").getVapidPublicKey;

  beforeEach(async () => {
    setVapidDetailsMock.mockReset();
    sendNotificationMock.mockReset();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
    process.env.VAPID_PRIVATE_KEY            = "test-private-key";
    process.env.VAPID_SUBJECT                = "mailto:test@alphalog.io";

    // Reset module cache so the env vars are re-read on import.
    vi.resetModules();
    const mod = await import("../webpush.server");
    sendPushToSubscription = mod.sendPushToSubscription;
    sendPushToSubscriptions = mod.sendPushToSubscriptions;
    getVapidPublicKey        = mod.getVapidPublicKey;
  });

  it("module init calls webpush.setVapidDetails con los env values", () => {
    expect(setVapidDetailsMock).toHaveBeenCalledWith(
      "mailto:test@alphalog.io",
      "test-public-key",
      "test-private-key",
    );
  });

  it("sendPushToSubscription envía payload JSON con defaults", async () => {
    sendNotificationMock.mockResolvedValue(undefined);
    await sendPushToSubscription(VALID_SUBSCRIPTION, { title: "Hello", body: "World" });

    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    const [sub, msg] = sendNotificationMock.mock.calls[0];
    expect(sub).toBe(VALID_SUBSCRIPTION);
    const parsed = JSON.parse(msg as string);
    expect(parsed).toMatchObject({
      title: "Hello",
      body:  "World",
      icon:  "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag:   "alphalog-notification",
      data:  {},
    });
  });

  it("sendPushToSubscription respeta custom icon/badge/tag/data", async () => {
    sendNotificationMock.mockResolvedValue(undefined);
    await sendPushToSubscription(VALID_SUBSCRIPTION, {
      title: "T", body: "B",
      icon: "/custom-icon.png", badge: "/badge.png",
      tag: "my-tag", data: { url: "/dashboard" },
    });
    const msg = JSON.parse(sendNotificationMock.mock.calls[0][1] as string);
    expect(msg).toMatchObject({
      icon: "/custom-icon.png", badge: "/badge.png", tag: "my-tag",
      data: { url: "/dashboard" },
    });
  });

  it("status 410 → throws 'SUBSCRIPTION_EXPIRED'", async () => {
    sendNotificationMock.mockRejectedValue(new FakeWebPushError("Gone", 410));
    await expect(
      sendPushToSubscription(VALID_SUBSCRIPTION, { title: "x", body: "y" }),
    ).rejects.toThrow("SUBSCRIPTION_EXPIRED");
  });

  it("status 404 → throws 'SUBSCRIPTION_NOT_FOUND'", async () => {
    sendNotificationMock.mockRejectedValue(new FakeWebPushError("Not found", 404));
    await expect(
      sendPushToSubscription(VALID_SUBSCRIPTION, { title: "x", body: "y" }),
    ).rejects.toThrow("SUBSCRIPTION_NOT_FOUND");
  });

  it("status 500 (other WebPushError) → re-throws original", async () => {
    sendNotificationMock.mockRejectedValue(new FakeWebPushError("server error", 500));
    await expect(
      sendPushToSubscription(VALID_SUBSCRIPTION, { title: "x", body: "y" }),
    ).rejects.toThrow("server error");
  });

  it("Non-WebPushError exception → re-throws as-is", async () => {
    sendNotificationMock.mockRejectedValue(new Error("net::ERR_TIMEOUT"));
    await expect(
      sendPushToSubscription(VALID_SUBSCRIPTION, { title: "x", body: "y" }),
    ).rejects.toThrow("net::ERR_TIMEOUT");
  });

  it("sendPushToSubscriptions aggregates counters: 2 sent + 1 failed", async () => {
    sendNotificationMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new FakeWebPushError("gone", 410));

    const subs = [VALID_SUBSCRIPTION, VALID_SUBSCRIPTION, VALID_SUBSCRIPTION];
    const result = await sendPushToSubscriptions(subs, { title: "T", body: "B" });
    expect(result).toEqual({ sent: 2, failed: 1 });
  });

  it("sendPushToSubscriptions con array vacío → {sent:0, failed:0}", async () => {
    const result = await sendPushToSubscriptions([], { title: "T", body: "B" });
    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("getVapidPublicKey returns el env var configurado", () => {
    expect(getVapidPublicKey()).toBe("test-public-key");
  });
});

describe("webpush.server — VAPID NOT configured", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    vi.resetModules();
  });

  it("sendPushToSubscription es no-op silencioso cuando VAPID off", async () => {
    setVapidDetailsMock.mockReset();
    sendNotificationMock.mockReset();
    const mod = await import("../webpush.server");
    await mod.sendPushToSubscription(VALID_SUBSCRIPTION, { title: "x", body: "y" });
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("sendPushToSubscriptions returns {sent:0, failed:0} cuando VAPID off", async () => {
    setVapidDetailsMock.mockReset();
    sendNotificationMock.mockReset();
    const mod = await import("../webpush.server");
    const result = await mod.sendPushToSubscriptions(
      [VALID_SUBSCRIPTION],
      { title: "x", body: "y" },
    );
    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("getVapidPublicKey throws cuando NEXT_PUBLIC_VAPID_PUBLIC_KEY no está configurada", async () => {
    const mod = await import("../webpush.server");
    expect(() => mod.getVapidPublicKey()).toThrow(/VAPID public key not configured/i);
  });
});
