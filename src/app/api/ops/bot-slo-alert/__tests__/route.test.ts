// Integration test for /api/ops/bot-slo-alert POST handler.
//
// Endpoint que recibe el report del bot-slo-monitor cron y lo escala a
// Sentry. Covers:
//   1. 500 cuando OPS_ALERT_TOKEN no está configurado.
//   2. 401 cuando x-ops-token != OPS_ALERT_TOKEN.
//   3. 400 cuando el body no es JSON válido.
//   4. status='FAIL' → captureException (severo).
//   5. severity='S1' → captureException incluso con status PASS/DEGRADED.
//   6. status='DEGRADED' + severity='S2' → captureMessage (no exception).
//   7. Defaults aplicados cuando payload tiene fields ausentes
//      (status='DEGRADED', severity='S2').
//   8. captureException throws → handler NO 500ea (logError swallow).
//   9. receivedAt es ISO timestamp en la response.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { captureExceptionMock, captureMessageMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  captureMessageMock:   vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  captureException: captureExceptionMock,
  captureMessage:   captureMessageMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  process.env.OPS_ALERT_TOKEN = "ops-alert-secret";
  const mod = await import("../route");
  POST = mod.POST;
});

function makeRequest(token: string, body: unknown | "INVALID_JSON" = {}): NextRequest {
  return new NextRequest("http://localhost/api/ops/bot-slo-alert", {
    method:  "POST",
    headers: {
      "x-ops-token":   token,
      "content-type":  "application/json",
    },
    body: body === "INVALID_JSON" ? "{ not valid" : JSON.stringify(body),
  });
}

describe("/api/ops/bot-slo-alert — handler", () => {
  beforeEach(() => {
    captureExceptionMock.mockReset();
    captureMessageMock.mockReset();
  });

  it("returns 500 when OPS_ALERT_TOKEN env is unset", async () => {
    delete process.env.OPS_ALERT_TOKEN;
    const res = await POST(makeRequest("anything"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/OPS_ALERT_TOKEN not configured/i);
    process.env.OPS_ALERT_TOKEN = "ops-alert-secret";
  });

  it("returns 401 when x-ops-token mismatches", async () => {
    const res = await POST(makeRequest("wrong-token"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when body is invalid JSON", async () => {
    const res = await POST(makeRequest("ops-alert-secret", "INVALID_JSON"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid JSON body/i);
  });

  it("status='FAIL' → captureException (severo)", async () => {
    const res = await POST(makeRequest("ops-alert-secret", {
      status: "FAIL", severity: "S1",
      generatedAt: "2026-06-14T10:00:00Z",
      checks: [{ code: "X" }], byProfile: { forex: { sev: "S1" } },
    }));
    expect(res.status).toBe(200);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureMessageMock).not.toHaveBeenCalled();
    const [err, ctx] = captureExceptionMock.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/\[BotSLO\] Critical alert.*FAIL.*S1/);
    expect(ctx).toMatchObject({ status: "FAIL", severity: "S1", feature: "bot_slo_monitor" });
  });

  it("severity='S1' → captureException incluso con status DEGRADED", async () => {
    await POST(makeRequest("ops-alert-secret", { status: "DEGRADED", severity: "S1" }));
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureMessageMock).not.toHaveBeenCalled();
  });

  it("status='DEGRADED' + severity='S2' → captureMessage (no exception)", async () => {
    await POST(makeRequest("ops-alert-secret", { status: "DEGRADED", severity: "S2" }));
    expect(captureMessageMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).not.toHaveBeenCalled();
    const [msg, ctx] = captureMessageMock.mock.calls[0];
    expect(msg).toMatch(/\[BotSLO\] DEGRADED \/ S2/);
    expect(ctx).toMatchObject({ status: "DEGRADED", severity: "S2" });
  });

  it("aplica defaults DEGRADED/S2 cuando el body no incluye status/severity", async () => {
    await POST(makeRequest("ops-alert-secret", { generatedAt: "2026-06-14T10:00:00Z" }));
    expect(captureMessageMock).toHaveBeenCalledTimes(1);
    const [, ctx] = captureMessageMock.mock.calls[0];
    expect(ctx).toMatchObject({
      status:   "DEGRADED",
      severity: "S2",
      checks:   [],
      byProfile: {},
      recommendedActions: [],
    });
  });

  it("captureException throws → handler returns 200 (logError swallow)", async () => {
    captureExceptionMock.mockImplementation(() => { throw new Error("sentry down"); });
    const res = await POST(makeRequest("ops-alert-secret", { status: "FAIL", severity: "S1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("response trae receivedAt como ISO timestamp", async () => {
    const res = await POST(makeRequest("ops-alert-secret", { status: "PASS", severity: "NONE" }));
    const body = await res.json();
    expect(body.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
