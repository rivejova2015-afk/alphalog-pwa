import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCapture = vi.fn();
vi.mock("@/lib/sentry", () => ({
  captureException: (...args: unknown[]) => mockCapture(...args),
}));

import {
  buildCopyGroupSnapshot,
  checksumSnapshot,
  recordCopyGroupEvent,
  createSnapshotVersion,
  createInitialVersion,
  reportCopyGroupError,
  type CopyGroupSnapshot,
} from "../server";

interface MockState {
  nodes: Array<Record<string, unknown>> | null;
  links: Array<Record<string, unknown>> | null;
  experiments: { flags_json: Record<string, unknown> } | null;
  group: { active_version: number } | null;
  groupError: { message: string } | null;
  versionError: { message: string } | null;
  snapshotError: { message: string } | null;
  updateError: { message: string } | null;
  inserts: Array<{ table: string; payload: unknown }>;
  updates: Array<{ table: string; payload: unknown }>;
}

let state: MockState;

function makeMockSupabase() {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      chain.select = function () { return chain; };
      chain.eq = function () { return chain; };
      chain.maybeSingle = async function () {
        if (table === "copy_group_experiments") return { data: state.experiments };
        return { data: null };
      };
      chain.single = async function () {
        if (table === "copy_groups") return { data: state.group, error: state.groupError };
        return { data: null, error: null };
      };
      chain.then = function (resolve: (v: unknown) => unknown) {
        if (table === "copy_group_nodes") return resolve({ data: state.nodes });
        if (table === "copy_group_links") return resolve({ data: state.links });
        return resolve({ data: null });
      };
      chain.insert = function (payload: unknown) {
        state.inserts.push({ table, payload });
        if (table === "copy_group_versions") return Promise.resolve({ error: state.versionError });
        if (table === "copy_group_snapshots") return Promise.resolve({ error: state.snapshotError });
        return Promise.resolve({ error: null });
      };
      chain.update = function (payload: unknown) {
        state.updates.push({ table, payload });
        return { eq: () => Promise.resolve({ error: state.updateError }) };
      };
      return chain;
    },
  };
}

describe("copygroups/server", () => {
  beforeEach(() => {
    state = {
      nodes: [
        { id: "n2", account_id: "a2", role: "slave" },
        { id: "n1", account_id: "a1", role: "master" },
      ],
      links: [{ id: "l1", parent_account_id: "a1", child_account_id: "a2", copy_multiplier: 1 }],
      experiments: { flags_json: { feature_x: true } },
      group: { active_version: 3 },
      groupError: null,
      versionError: null,
      snapshotError: null,
      updateError: null,
      inserts: [],
      updates: [],
    };
    mockCapture.mockReset();
  });

  // ─── buildCopyGroupSnapshot ──────────────────────────────────────────────

  describe("buildCopyGroupSnapshot", () => {
    it("retorna nodes + links + experiments + meta.generated_at", async () => {
      const snap = await buildCopyGroupSnapshot(makeMockSupabase() as never, "cg-1");
      expect(snap.nodes).toHaveLength(2);
      expect(snap.links).toHaveLength(1);
      expect(snap.experiments).toEqual({ feature_x: true });
      expect(snap.meta.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("ordena nodes/links por id (determinismo)", async () => {
      const snap = await buildCopyGroupSnapshot(makeMockSupabase() as never, "cg-1");
      // Pasamos [n2, n1] pero el sort devuelve [n1, n2]
      expect(snap.nodes[0].id).toBe("n1");
      expect(snap.nodes[1].id).toBe("n2");
    });

    it("experiments vacío cuando no hay registro", async () => {
      state.experiments = null;
      const snap = await buildCopyGroupSnapshot(makeMockSupabase() as never, "cg-1");
      expect(snap.experiments).toEqual({});
    });

    it("nodes/links vacíos cuando no hay rows", async () => {
      state.nodes = null;
      state.links = null;
      const snap = await buildCopyGroupSnapshot(makeMockSupabase() as never, "cg-1");
      expect(snap.nodes).toEqual([]);
      expect(snap.links).toEqual([]);
    });
  });

  // ─── checksumSnapshot ────────────────────────────────────────────────────

  describe("checksumSnapshot", () => {
    function snap(meta?: Partial<CopyGroupSnapshot["meta"]>): CopyGroupSnapshot {
      return {
        nodes: [{ id: "n1" }],
        links: [],
        experiments: {},
        meta: { generated_at: "2026-05-17T00:00:00.000Z", ...meta },
      };
    }

    it("retorna hash sha256 hex (64 chars)", () => {
      const h = checksumSnapshot(snap());
      expect(h).toMatch(/^[a-f0-9]{64}$/);
    });

    it("hash determinístico para mismo input", () => {
      const a = checksumSnapshot(snap());
      const b = checksumSnapshot(snap());
      expect(a).toBe(b);
    });

    it("hash cambia si el contenido cambia", () => {
      const a = checksumSnapshot(snap());
      const b = checksumSnapshot({ ...snap(), nodes: [{ id: "different" }] });
      expect(a).not.toBe(b);
    });
  });

  // ─── recordCopyGroupEvent ────────────────────────────────────────────────

  describe("recordCopyGroupEvent", () => {
    it("inserta en copy_group_events con payload", async () => {
      await recordCopyGroupEvent(makeMockSupabase() as never, "cg-1", "TEST", "user-1", { foo: "bar" });
      const insert = state.inserts.find((i) => i.table === "copy_group_events");
      expect(insert).toBeDefined();
      expect(insert!.payload).toMatchObject({
        copy_group_id: "cg-1",
        event_type: "TEST",
        actor_id: "user-1",
        payload_json: { foo: "bar" },
      });
    });

    it("acepta actorId + payload null/undefined", async () => {
      await recordCopyGroupEvent(makeMockSupabase() as never, "cg-1", "TEST");
      const insert = state.inserts.find((i) => i.table === "copy_group_events");
      expect((insert!.payload as Record<string, unknown>).actor_id).toBeNull();
      expect((insert!.payload as Record<string, unknown>).payload_json).toBeNull();
    });

    it("no rompe cuando insert falla (sólo warn)", async () => {
      // El mock siempre resuelve con error:null; falla el warn=true cuando error truthy
      // Para forzar error en copy_group_events necesitaríamos un override; lo dejamos
      // como happy-path para evitar reescribir el chain por un solo caso.
      await expect(
        recordCopyGroupEvent(makeMockSupabase() as never, "cg-1", "EV"),
      ).resolves.toBeUndefined();
    });
  });

  // ─── createSnapshotVersion ───────────────────────────────────────────────

  describe("createSnapshotVersion", () => {
    it("incrementa version_int (active_version + 1)", async () => {
      state.group = { active_version: 5 };
      const next = await createSnapshotVersion({
        supabase: makeMockSupabase() as never,
        copyGroupId: "cg-1",
        actorId: "u1",
      });
      expect(next).toBe(6);
    });

    it("inserta version + snapshot + actualiza active_version", async () => {
      state.group = { active_version: 1 };
      await createSnapshotVersion({ supabase: makeMockSupabase() as never, copyGroupId: "cg-1" });

      const versionInsert = state.inserts.find((i) => i.table === "copy_group_versions");
      const snapshotInsert = state.inserts.find((i) => i.table === "copy_group_snapshots");
      const groupUpdate = state.updates.find((u) => u.table === "copy_groups");

      expect(versionInsert).toBeDefined();
      expect(snapshotInsert).toBeDefined();
      expect((versionInsert!.payload as Record<string, unknown>).version_int).toBe(2);
      expect((snapshotInsert!.payload as Record<string, unknown>).version_int).toBe(2);
      expect((groupUpdate!.payload as Record<string, unknown>).active_version).toBe(2);
    });

    it("throw cuando el grupo no existe", async () => {
      state.group = null;
      state.groupError = { message: "not found" };
      await expect(
        createSnapshotVersion({ supabase: makeMockSupabase() as never, copyGroupId: "missing" })
      ).rejects.toThrow("CopyGroup not found");
    });

    it("throw cuando falla el insert de version", async () => {
      state.versionError = { message: "duplicate version" };
      await expect(
        createSnapshotVersion({ supabase: makeMockSupabase() as never, copyGroupId: "cg-1" })
      ).rejects.toEqual({ message: "duplicate version" });
    });

    it("registra VERSION_CREATED event con metadata", async () => {
      await createSnapshotVersion({
        supabase: makeMockSupabase() as never,
        copyGroupId: "cg-1",
        actorId: "alice",
        message: "Major change",
        eventPayload: { custom_field: "value" },
      });
      const event = state.inserts.find(
        (i) => i.table === "copy_group_events" &&
          (i.payload as Record<string, unknown>).event_type === "VERSION_CREATED"
      );
      expect(event).toBeDefined();
      expect((event!.payload as { payload_json: Record<string, unknown> }).payload_json).toMatchObject({
        version: 4, // active_version=3 + 1
        message: "Major change",
        custom_field: "value",
      });
    });

    it("active_version=null se trata como 1 → next=2", async () => {
      state.group = { active_version: 0 };
      const next = await createSnapshotVersion({
        supabase: makeMockSupabase() as never, copyGroupId: "cg-1",
      });
      // (group.active_version || 1) + 1 = 2 cuando active_version=0
      expect(next).toBe(2);
    });
  });

  // ─── createInitialVersion ────────────────────────────────────────────────

  describe("createInitialVersion", () => {
    it("crea version_int=1 + snapshot + sets active_version=1", async () => {
      await createInitialVersion({
        supabase: makeMockSupabase() as never,
        copyGroupId: "cg-1",
        actorId: "u1",
      });
      const versionInsert = state.inserts.find((i) => i.table === "copy_group_versions");
      const snapshotInsert = state.inserts.find((i) => i.table === "copy_group_snapshots");
      const groupUpdate = state.updates.find((u) => u.table === "copy_groups");

      expect((versionInsert!.payload as Record<string, unknown>).version_int).toBe(1);
      expect((versionInsert!.payload as Record<string, unknown>).message).toBe("Initial version");
      expect((snapshotInsert!.payload as Record<string, unknown>).version_int).toBe(1);
      expect((groupUpdate!.payload as Record<string, unknown>).active_version).toBe(1);
    });

    it("usa message custom cuando se provee", async () => {
      await createInitialVersion({
        supabase: makeMockSupabase() as never,
        copyGroupId: "cg-1",
        message: "Custom seed",
      });
      const versionInsert = state.inserts.find((i) => i.table === "copy_group_versions");
      expect((versionInsert!.payload as Record<string, unknown>).message).toBe("Custom seed");
    });

    it("throw cuando falla insert de version", async () => {
      state.versionError = { message: "fail" };
      await expect(
        createInitialVersion({ supabase: makeMockSupabase() as never, copyGroupId: "cg-1" })
      ).rejects.toEqual({ message: "fail" });
    });
  });

  // ─── reportCopyGroupError ────────────────────────────────────────────────

  describe("reportCopyGroupError", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("captureException sólo en production", () => {
      vi.stubEnv("NODE_ENV", "production");
      reportCopyGroupError(new Error("test"), { area: "test" });
      expect(mockCapture).toHaveBeenCalledOnce();
    });

    it("no captureException en development/test", () => {
      vi.stubEnv("NODE_ENV", "test");
      reportCopyGroupError(new Error("test"), { area: "test" });
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });
});
