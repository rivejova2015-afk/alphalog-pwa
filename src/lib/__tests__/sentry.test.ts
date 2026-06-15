// Unit tests for src/lib/sentry.ts.
//
// Thin wrappers sobre @sentry/nextjs que normalizan el extras shape.
// Validates:
//   - captureMessage: invokes Sentry.captureMessage con extras=context.
//   - captureException: invokes Sentry.captureException con extras=context.
//   - captureMessageWithModule: usa withScope con tag('module', X) +
//     setExtras + captureMessage.
//   - sin context: no se pasa el extras param.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { captureMessageMock, captureExceptionMock, withScopeMock } = vi.hoisted(() => ({
  captureMessageMock:   vi.fn(),
  captureExceptionMock: vi.fn(),
  withScopeMock:        vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureMessage:   captureMessageMock,
  captureException: captureExceptionMock,
  withScope:        withScopeMock,
}));

import { captureMessage, captureException, captureMessageWithModule } from "../sentry";

describe("captureMessage", () => {
  beforeEach(() => {
    captureMessageMock.mockReset();
  });

  it("invokes Sentry.captureMessage con extras=context cuando se pasa context", () => {
    captureMessage("hello", { foo: "bar", count: 42 });
    expect(captureMessageMock).toHaveBeenCalledWith("hello", { extra: { foo: "bar", count: 42 } });
  });

  it("invokes Sentry.captureMessage sin extras cuando context es undefined", () => {
    captureMessage("hello");
    expect(captureMessageMock).toHaveBeenCalledWith("hello", undefined);
  });

  it("returns undefined (void)", () => {
    expect(captureMessage("x")).toBeUndefined();
  });
});

describe("captureException", () => {
  beforeEach(() => {
    captureExceptionMock.mockReset();
  });

  it("invokes Sentry.captureException con extras=context", () => {
    const err = new Error("oops");
    captureException(err, { url: "/api/x", user: "u1" });
    expect(captureExceptionMock).toHaveBeenCalledWith(err, { extra: { url: "/api/x", user: "u1" } });
  });

  it("sin context → no extras param", () => {
    const err = new Error("plain");
    captureException(err);
    expect(captureExceptionMock).toHaveBeenCalledWith(err, undefined);
  });

  it("acepta cualquier tipo de error (string, object, null) — pass-through", () => {
    captureException("string error");
    expect(captureExceptionMock).toHaveBeenLastCalledWith("string error", undefined);

    captureException({ statusCode: 500 });
    expect(captureExceptionMock).toHaveBeenLastCalledWith({ statusCode: 500 }, undefined);
  });
});

describe("captureMessageWithModule", () => {
  beforeEach(() => {
    withScopeMock.mockReset();
    captureMessageMock.mockReset();
  });

  it("usa withScope + setTag('module', X) + captureMessage", () => {
    const scope = { setTag: vi.fn(), setExtras: vi.fn() };
    withScopeMock.mockImplementation((cb: (s: typeof scope) => void) => cb(scope));

    captureMessageWithModule("treasury", "payout failed");
    expect(scope.setTag).toHaveBeenCalledWith("module", "treasury");
    expect(scope.setExtras).not.toHaveBeenCalled();
    expect(captureMessageMock).toHaveBeenCalledWith("payout failed");
  });

  it("incluye setExtras(context) cuando se pasa context", () => {
    const scope = { setTag: vi.fn(), setExtras: vi.fn() };
    withScopeMock.mockImplementation((cb: (s: typeof scope) => void) => cb(scope));

    captureMessageWithModule("bot", "alert", { agent_id: "a1" });
    expect(scope.setTag).toHaveBeenCalledWith("module", "bot");
    expect(scope.setExtras).toHaveBeenCalledWith({ agent_id: "a1" });
  });
});
