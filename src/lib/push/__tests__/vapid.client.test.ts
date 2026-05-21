import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Reset module cache between tests so process.env changes take effect
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getVapidPublicKey", () => {
  it("retorna NEXT_PUBLIC_VAPID_PUBLIC_KEY cuando está seteada", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-vapid-key-123");
    const { getVapidPublicKey } = await import("../vapid.client");
    expect(getVapidPublicKey()).toBe("test-vapid-key-123");
  });

  it("retorna null cuando env var está vacía o ausente", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    const { getVapidPublicKey } = await import("../vapid.client");
    expect(getVapidPublicKey()).toBeNull();
  });
});

describe("isPushSupported", () => {
  beforeEach(() => {
    // Reset to minimal browser-like globals
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true, writable: true });
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true, writable: true });
    Object.defineProperty(globalThis, "Notification", { value: undefined, configurable: true, writable: true });
  });

  it("false cuando navigator vacío (sin serviceWorker)", async () => {
    const { isPushSupported } = await import("../vapid.client");
    expect(isPushSupported()).toBe(false);
  });

  it("false cuando Notification.permission != 'granted'", async () => {
    Object.defineProperty(globalThis, "navigator", { value: { serviceWorker: {} }, configurable: true, writable: true });
    Object.defineProperty(globalThis, "window", {
      value: { PushManager: function () {}, Notification: { permission: "default" } },
      configurable: true, writable: true,
    });
    Object.defineProperty(globalThis, "Notification", { value: { permission: "default" }, configurable: true, writable: true });
    const { isPushSupported } = await import("../vapid.client");
    expect(isPushSupported()).toBe(false);
  });

  it("true cuando todo está presente y permission='granted'", async () => {
    Object.defineProperty(globalThis, "navigator", { value: { serviceWorker: {} }, configurable: true, writable: true });
    Object.defineProperty(globalThis, "window", {
      value: { PushManager: function () {}, Notification: { permission: "granted" } },
      configurable: true, writable: true,
    });
    Object.defineProperty(globalThis, "Notification", { value: { permission: "granted" }, configurable: true, writable: true });
    const { isPushSupported } = await import("../vapid.client");
    expect(isPushSupported()).toBe(true);
  });
});

describe("subscribeToPush", () => {
  it("throw cuando serviceWorker no está disponible", async () => {
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true, writable: true });
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true, writable: true });
    const { subscribeToPush } = await import("../vapid.client");
    await expect(subscribeToPush()).rejects.toThrow(/not supported/);
  });

  it("throw VAPID_MISSING cuando key vacía", async () => {
    Object.defineProperty(globalThis, "navigator", { value: { serviceWorker: {} }, configurable: true, writable: true });
    Object.defineProperty(globalThis, "window", { value: { PushManager: function () {} }, configurable: true, writable: true });
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    const { subscribeToPush } = await import("../vapid.client");
    try {
      await subscribeToPush();
      expect.fail("Should have thrown");
    } catch (err) {
      const e = err as Error & { code?: string };
      expect(e.code).toBe("VAPID_MISSING");
    }
  });
});

describe("sendTestPushNotification", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("POST a /api/push/test con subscriptionId", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const { sendTestPushNotification } = await import("../vapid.client");
    await sendTestPushNotification("sub-123");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/push/test",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: "sub-123" }),
      }),
    );
  });

  it("throw cuando response.ok=false", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      statusText: "Internal Server Error",
    });
    const { sendTestPushNotification } = await import("../vapid.client");
    await expect(sendTestPushNotification("s1")).rejects.toThrow(/Failed to send test notification/);
  });
});
