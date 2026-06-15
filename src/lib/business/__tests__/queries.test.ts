// @vitest-environment jsdom
//
// Unit tests for src/lib/business/queries.ts.
//
// Thin fetch wrappers sobre /api/business/*. Pattern uniforme:
//   - GET success → returns data
//   - GET non-ok → returns default ([] / null / false) + logs
//   - GET throws → returns default + logs
//   - POST/PUT/DELETE success → returns body or true
//   - POST/PUT/DELETE failure → returns null/false + logs
//   - CSRF header inyectado en mutaciones via cookie 'al_csrf'
//   - URL params encoded para querystrings + path params
//
// Test sample focused: getBusinessCosts (con filter), createBusinessCost,
// deleteBusinessCost, getBusinessMilestones, updateBusinessMilestoneStatus,
// deleteBusinessMilestone, getBusinessSOPs (con items dropped).

import { describe, it, expect, vi, beforeEach } from "vitest";

const { logErrorMock } = vi.hoisted(() => ({ logErrorMock: vi.fn() }));

vi.mock("@/lib/log", () => ({
  logError: logErrorMock, logInfo: vi.fn(), logWarn: vi.fn(),
}));

import {
  getBusinessCosts,
  createBusinessCost,
  deleteBusinessCost,
  getBusinessMilestones,
  createBusinessMilestone,
  updateBusinessMilestoneStatus,
  deleteBusinessMilestone,
  getBusinessSOPs,
  getBusinessSOPWithItems,
} from "../queries";

interface FetchCall { url: string; method: string; headers?: Record<string, string>; body?: unknown }

function setupFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const calls: FetchCall[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const c: FetchCall = { url, method: init?.method ?? "GET" };
    if (init?.headers) c.headers = init.headers as Record<string, string>;
    if (init?.body) { try { c.body = JSON.parse(init.body as string); } catch { /* noop */ } }
    calls.push(c);
    return await handler(url, init);
  }) as unknown as typeof fetch;
  return calls;
}

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok, status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  // Reset CSRF cookie via JSDOM-less approach — set document.cookie.
  Object.defineProperty(document, "cookie", {
    value: "al_csrf=test-csrf-token",
    writable: true, configurable: true,
  });
  logErrorMock.mockReset();
});

describe("getBusinessCosts", () => {
  it("success: returns body.costs", async () => {
    const calls = setupFetch(() => mockResponse({ costs: [{ id: "c1", amount: 100 }] }));
    const result = await getBusinessCosts();
    expect(result).toEqual([{ id: "c1", amount: 100 }]);
    expect(calls[0].url).toBe("/api/business/costs");
  });

  it("con filterMonth: encodea el month param", async () => {
    const calls = setupFetch(() => mockResponse({ costs: [] }));
    await getBusinessCosts("2026-06");
    expect(calls[0].url).toBe("/api/business/costs?month=2026-06");
  });

  it("non-ok response → returns [] + log", async () => {
    setupFetch(() => mockResponse({}, false, 500));
    const result = await getBusinessCosts();
    expect(result).toEqual([]);
    expect(logErrorMock).toHaveBeenCalled();
  });

  it("fetch throws → returns [] + log", async () => {
    setupFetch(() => { throw new Error("network ECONNREFUSED"); });
    const result = await getBusinessCosts();
    expect(result).toEqual([]);
    expect(logErrorMock).toHaveBeenCalledWith(
      "Business",
      expect.objectContaining({ message: "getBusinessCosts threw" }),
    );
  });

  it("body sin .costs key → returns []", async () => {
    setupFetch(() => mockResponse({ other: "data" }));
    const result = await getBusinessCosts();
    expect(result).toEqual([]);
  });
});

describe("createBusinessCost", () => {
  it("success: POST con CSRF header + Content-Type, returns body.cost", async () => {
    const calls = setupFetch(() => mockResponse({ cost: { id: "c-new", amount: 100 } }));
    const result = await createBusinessCost({
      amount: 100,
      category: "Tools Software",
      description: "AWS",
      vendor: "Amazon",
      cost_date: "2026-06-15",
      is_recurring_instance: false,
      sort_index: 0,
    });

    expect(result).toEqual({ id: "c-new", amount: 100 });
    expect(calls[0].method).toBe("POST");
    expect((calls[0].headers as Record<string, string>)["x-csrf-token"]).toBe("test-csrf-token");
    expect((calls[0].headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(calls[0].body).toMatchObject({
      amount: 100, category: "Tools Software", description: "AWS",
    });
  });

  it("non-ok → returns null + log", async () => {
    setupFetch(() => mockResponse({}, false, 400));
    const result = await createBusinessCost({
      amount: 0, category: "Tools Software", description: "",
      vendor: "", cost_date: "2026-06-15", is_recurring_instance: false, sort_index: 0,
    });
    expect(result).toBeNull();
    expect(logErrorMock).toHaveBeenCalled();
  });

  it("fetch throws → returns null + log", async () => {
    setupFetch(() => { throw new Error("net::ABORT"); });
    const result = await createBusinessCost({
      amount: 0, category: "Tools Software", description: "",
      vendor: "", cost_date: "2026-06-15", is_recurring_instance: false, sort_index: 0,
    });
    expect(result).toBeNull();
  });
});

describe("deleteBusinessCost", () => {
  it("success: DELETE encodea costId en path, returns true", async () => {
    const calls = setupFetch(() => mockResponse({}, true));
    const result = await deleteBusinessCost("cost id with spaces");
    expect(result).toBe(true);
    expect(calls[0].url).toBe("/api/business/costs/cost%20id%20with%20spaces");
    expect(calls[0].method).toBe("DELETE");
  });

  it("non-ok → returns false + log", async () => {
    setupFetch(() => mockResponse({}, false, 404));
    const result = await deleteBusinessCost("c1");
    expect(result).toBe(false);
    expect(logErrorMock).toHaveBeenCalled();
  });
});

describe("getBusinessMilestones", () => {
  it("success: returns body.milestones", async () => {
    setupFetch(() => mockResponse({ milestones: [{ id: "m1", title: "Launch" }] }));
    const result = await getBusinessMilestones();
    expect(result).toEqual([{ id: "m1", title: "Launch" }]);
  });

  it("non-ok → returns []", async () => {
    setupFetch(() => mockResponse({}, false));
    expect(await getBusinessMilestones()).toEqual([]);
  });
});

describe("createBusinessMilestone", () => {
  it("POST con body shape correcto (incluye target_date null y goal_id null)", async () => {
    const calls = setupFetch(() => mockResponse({ milestone: { id: "m1" } }));
    await createBusinessMilestone({
      title: "Launch v2",
      description: "Ship the new feature",
      status: "pending",
      sort_index: 0,
    });

    expect(calls[0].body).toMatchObject({
      title: "Launch v2",
      description: "Ship the new feature",
      target_date: null,   // missing → null
      status: "pending",
      goal_id: null,        // missing → null
      notes: null,          // missing → null
    });
  });

  it("non-ok → returns null", async () => {
    setupFetch(() => mockResponse({}, false));
    const result = await createBusinessMilestone({
      title: "x", description: "", status: "pending", sort_index: 0,
    });
    expect(result).toBeNull();
  });
});

describe("updateBusinessMilestoneStatus", () => {
  it("success: PUT con body {status}, returns true", async () => {
    const calls = setupFetch(() => mockResponse({}, true));
    const result = await updateBusinessMilestoneStatus("m1", "completed");
    expect(result).toBe(true);
    expect(calls[0].url).toBe("/api/business/milestones/m1");
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].body).toEqual({ status: "completed" });
  });

  it("non-ok → returns false", async () => {
    setupFetch(() => mockResponse({}, false));
    expect(await updateBusinessMilestoneStatus("m1", "completed")).toBe(false);
  });
});

describe("deleteBusinessMilestone", () => {
  it("success: returns true + URL path correcto", async () => {
    const calls = setupFetch(() => mockResponse({}, true));
    const result = await deleteBusinessMilestone("m1");
    expect(result).toBe(true);
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toBe("/api/business/milestones/m1");
  });
});

describe("getBusinessSOPs", () => {
  it("strips items array de cada SOP (returns sin items)", async () => {
    setupFetch(() => mockResponse({
      sops: [{ id: "s1", title: "Onboarding", items: [{ id: "i1" }] }],
    }));
    const result = await getBusinessSOPs();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "s1", title: "Onboarding" });
    expect((result[0] as unknown as { items?: unknown }).items).toBeUndefined();
  });

  it("body sin .sops → returns []", async () => {
    setupFetch(() => mockResponse({ other: "x" }));
    expect(await getBusinessSOPs()).toEqual([]);
  });
});

describe("getBusinessSOPWithItems", () => {
  it("match: returns {sop, items}", async () => {
    setupFetch(() => mockResponse({
      sops: [
        { id: "s1", title: "x", items: [{ id: "i1" }, { id: "i2" }] },
        { id: "s2", title: "y", items: [] },
      ],
    }));
    const result = await getBusinessSOPWithItems("s1");
    expect(result?.sop).toMatchObject({ id: "s1", title: "x" });
    expect(result?.items).toHaveLength(2);
  });

  it("no match: returns null sin log", async () => {
    setupFetch(() => mockResponse({ sops: [{ id: "other", title: "x", items: [] }] }));
    const result = await getBusinessSOPWithItems("missing");
    expect(result).toBeNull();
  });

  it("items undefined en match: items=[] safe fallback", async () => {
    setupFetch(() => mockResponse({ sops: [{ id: "s1", title: "x" }] }));
    const result = await getBusinessSOPWithItems("s1");
    expect(result?.items).toEqual([]);
  });
});

describe("CSRF header", () => {
  it("readCsrfCookie default vacío cuando cookie no presente", async () => {
    Object.defineProperty(document, "cookie", {
      value: "other=value",
      writable: true, configurable: true,
    });
    const calls = setupFetch(() => mockResponse({}, true));
    await deleteBusinessCost("c1");
    expect((calls[0].headers as Record<string, string>)["x-csrf-token"]).toBe("");
  });

  it("CSRF cookie URL-decoded antes de mandar en header", async () => {
    Object.defineProperty(document, "cookie", {
      value: "al_csrf=token%20with%20spaces",
      writable: true, configurable: true,
    });
    const calls = setupFetch(() => mockResponse({}, true));
    await deleteBusinessCost("c1");
    expect((calls[0].headers as Record<string, string>)["x-csrf-token"]).toBe("token with spaces");
  });
});
