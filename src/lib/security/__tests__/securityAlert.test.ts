// Unit tests for src/lib/security/securityAlert.ts.
//
// triggerSecurityAlert es fire-and-forget hacia /api/push/notify-user.
// Validates:
//   - Silently skips cuando faltan env vars (INTERNAL_API_SECRET o
//     SECURITY_ALERT_USER_ID).
//   - fetch invoked con method=POST + Bearer auth + ownerUserId.
//   - title = "[Security] <Event Label>" con underscores convertidos a
//     palabras tituladas.
//   - body = "IP: X | Path: Y" cuando ip/path presentes; eventLabel cuando
//     no hay context details.
//   - tag = "security-<event>".
//   - body.data incluye type='security_event' + event + timestamp.
//   - Catch silencioso cuando fetch throws.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerSecurityAlert } from "../securityAlert";

describe("triggerSecurityAlert", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.INTERNAL_API_SECRET = "internal-secret";
    process.env.SECURITY_ALERT_USER_ID = "owner-uuid";
    process.env.NEXT_PUBLIC_APP_URL = "https://test.alphalog.io";
  });

  it("silently skips cuando INTERNAL_API_SECRET no está configurado", async () => {
    delete process.env.INTERNAL_API_SECRET;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await triggerSecurityAlert("csrf_failure", { ip: "1.2.3.4" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("silently skips cuando SECURITY_ALERT_USER_ID no está configurado", async () => {
    delete process.env.SECURITY_ALERT_USER_ID;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await triggerSecurityAlert("csrf_failure", { ip: "1.2.3.4" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("invoca fetch con POST + Bearer auth + ownerUserId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await triggerSecurityAlert("csrf_failure", { ip: "1.2.3.4", path: "/api/x" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.alphalog.io/api/push/notify-user");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer internal-secret");

    const body = JSON.parse(init.body as string);
    expect(body.userId).toBe("owner-uuid");
  });

  it("title='[Security] Csrf Failure' (event labels titulados)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await triggerSecurityAlert("csrf_failure", { ip: "1.2.3.4" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.title).toBe("[Security] Csrf Failure");
  });

  it("body = 'IP: X | Path: Y' cuando ip + path presentes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await triggerSecurityAlert("repeated_401", { ip: "203.0.113.42", path: "/api/secret" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.body).toBe("IP: 203.0.113.42 | Path: /api/secret");
  });

  it("body = solo 'IP: X' cuando path está ausente", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await triggerSecurityAlert("ip_blocked", { ip: "1.2.3.4" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.body).toBe("IP: 1.2.3.4");
  });

  it("body = eventLabel cuando NO hay ip ni path en context", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await triggerSecurityAlert("honeypot_hit", {});
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.body).toBe("Honeypot Hit");
  });

  it("tag = 'security-<event>'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await triggerSecurityAlert("db_tampering_detected", { path: "/x" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.tag).toBe("security-db_tampering_detected");
  });

  it("data incluye type='security_event' + event + timestamp ISO", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await triggerSecurityAlert("canary_modified", {});

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.data.type).toBe("security_event");
    expect(body.data.event).toBe("canary_modified");
    expect(body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("default a 'https://alphalog.io' cuando NEXT_PUBLIC_APP_URL no está set", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await triggerSecurityAlert("ip_blocked", {});
    expect(fetchMock.mock.calls[0][0]).toBe("https://alphalog.io/api/push/notify-user");
  });

  it("catch silencioso cuando fetch throws sync (no-throw guarantee)", async () => {
    globalThis.fetch = vi.fn(() => { throw new Error("sync throw"); }) as unknown as typeof fetch;
    await expect(triggerSecurityAlert("csrf_failure", {})).resolves.toBeUndefined();
  });
});
