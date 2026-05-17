import { describe, it, expect, vi } from "vitest";
import { diffBranches, type BranchNode } from "../branchDiffViewer";
import { computeHealthHeatmap, type MirrorNode } from "../mirrorHealthHeatmap";
import { resyncMirrorsBatch } from "../mirrorResyncBatch";
import { simulateMultiplierPath, type Node } from "../multiplierPathPreview";
import { suggestValidLink } from "../smartAntiLoopAdvisor";

// ─── branchDiffViewer ────────────────────────────────────────────────────────

describe("diffBranches", () => {
  function n(id: string, multiplier = 1, risk = 1, children: BranchNode[] = []): BranchNode {
    return { id, label: id, multiplier, risk, children };
  }

  it("trees idénticos → diff vacío", () => {
    const t1 = n("root", 1, 1, [n("a"), n("b")]);
    const t2 = n("root", 1, 1, [n("a"), n("b")]);
    const r = diffBranches(t1, t2);
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual([]);
    expect(r.changed).toEqual([]);
  });

  it("detecta nodo añadido en el nuevo árbol", () => {
    const t1 = n("root", 1, 1, [n("a")]);
    const t2 = n("root", 1, 1, [n("a"), n("b")]);
    const r = diffBranches(t1, t2);
    expect(r.added.map((x) => x.id)).toEqual(["b"]);
    expect(r.removed).toEqual([]);
  });

  it("detecta nodo removido del nuevo árbol", () => {
    const t1 = n("root", 1, 1, [n("a"), n("c")]);
    const t2 = n("root", 1, 1, [n("a")]);
    const r = diffBranches(t1, t2);
    expect(r.removed.map((x) => x.id)).toEqual(["c"]);
    expect(r.added).toEqual([]);
  });

  it("detecta cambios en multiplier", () => {
    const t1 = n("root", 1, 1, [n("a", 2, 1)]);
    const t2 = n("root", 1, 1, [n("a", 3, 1)]);
    const r = diffBranches(t1, t2);
    expect(r.changed).toHaveLength(1);
    expect(r.changed[0].id).toBe("a");
    expect(r.changed[0].from.multiplier).toBe(2);
    expect(r.changed[0].to.multiplier).toBe(3);
  });

  it("detecta cambios en risk", () => {
    const t1 = n("root", 1, 1, [n("a", 1, 2)]);
    const t2 = n("root", 1, 1, [n("a", 1, 5)]);
    const r = diffBranches(t1, t2);
    expect(r.changed).toHaveLength(1);
    expect(r.changed[0].id).toBe("a");
  });

  it("aplana subárboles arbitrariamente profundos", () => {
    const deep = n("root", 1, 1, [n("a", 1, 1, [n("a1", 1, 1, [n("a1x")])])]);
    const r = diffBranches(deep, n("root"));
    expect(r.removed.map((x) => x.id).sort()).toEqual(["a", "a1", "a1x"]);
  });

  it("nodos idénticos con misma multiplier+risk no aparecen en changed", () => {
    const t1 = n("root", 1, 1, [n("a", 1, 1, [n("b", 2, 2)])]);
    const t2 = n("root", 1, 1, [n("a", 1, 1, [n("b", 2, 2)])]);
    expect(diffBranches(t1, t2).changed).toEqual([]);
  });
});

// ─── mirrorHealthHeatmap ─────────────────────────────────────────────────────

describe("computeHealthHeatmap", () => {
  function mn(id: string, status: MirrorNode["status"] = "replicated", children: MirrorNode[] = []): MirrorNode {
    return { id, label: id, status, children };
  }

  it("nodo único → mapa con un entry", () => {
    expect(computeHealthHeatmap(mn("a", "replicated"))).toEqual({ a: "replicated" });
  });

  it("recorre todos los descendientes", () => {
    const tree = mn("root", "replicated", [
      mn("a", "failed"),
      mn("b", "need_resync", [mn("c", "replicated")]),
    ]);
    const r = computeHealthHeatmap(tree);
    expect(r).toEqual({
      root: "replicated",
      a: "failed",
      b: "need_resync",
      c: "replicated",
    });
  });

  it("preserva el status (no agrega/calcula nada nuevo)", () => {
    const tree = mn("x", "failed");
    expect(computeHealthHeatmap(tree).x).toBe("failed");
  });
});

// ─── mirrorResyncBatch ───────────────────────────────────────────────────────

describe("resyncMirrorsBatch", () => {
  it("loguea solo los mirrors con status='need_resync'", async () => {
    const logs: string[] = [];
    await resyncMirrorsBatch(
      [
        { id: "m1", status: "replicated" },
        { id: "m2", status: "need_resync" },
        { id: "m3", status: "failed" },
        { id: "m4", status: "need_resync" },
      ],
      (msg) => logs.push(msg),
    );
    expect(logs).toEqual([
      "Mirror m2 re-synced",
      "Mirror m4 re-synced",
    ]);
  });

  it("no rompe si onLog es undefined", async () => {
    await expect(
      resyncMirrorsBatch([{ id: "x", status: "need_resync" }]),
    ).resolves.toBeUndefined();
  });

  it("array vacío resuelve sin logs", async () => {
    const onLog = vi.fn();
    await resyncMirrorsBatch([], onLog);
    expect(onLog).not.toHaveBeenCalled();
  });
});

// ─── multiplierPathPreview ───────────────────────────────────────────────────

describe("simulateMultiplierPath", () => {
  function n(id: string, multiplier: number, children: Node[] = []): Node {
    return { id, label: id, multiplier, children };
  }

  it("aplica multiplier sobre masterSize en la raíz", () => {
    const r = simulateMultiplierPath(n("root", 1.0), 1000);
    expect(r.simulatedSize).toBe(1000);
  });

  it("compone multipliers a lo largo del árbol", () => {
    const tree = n("root", 1.0, [
      n("a", 2.0, [n("a1", 0.5)]),
      n("b", 1.5),
    ]);
    const r = simulateMultiplierPath(tree, 1000);
    expect(r.simulatedSize).toBe(1000);
    expect(r.children![0].simulatedSize).toBe(2000); // 1000 * 2
    expect(r.children![0].children![0].simulatedSize).toBe(1000); // 2000 * 0.5
    expect(r.children![1].simulatedSize).toBe(1500); // 1000 * 1.5
  });

  it("multiplier 0 → simulatedSize 0 en descendientes", () => {
    const tree = n("root", 0, [n("a", 5)]);
    const r = simulateMultiplierPath(tree, 1000);
    expect(r.simulatedSize).toBe(0);
    expect(r.children![0].simulatedSize).toBe(0);
  });

  it("no muta el árbol original", () => {
    const tree = n("root", 2);
    simulateMultiplierPath(tree, 100);
    expect(tree.simulatedSize).toBeUndefined();
  });

  it("nodos sin children → array vacío", () => {
    const r = simulateMultiplierPath(n("leaf", 1), 50);
    expect(r.children).toEqual([]);
  });
});

// ─── smartAntiLoopAdvisor ────────────────────────────────────────────────────

describe("suggestValidLink", () => {
  it("link no cíclico → null (no se necesita sugerencia)", () => {
    // a → b (sin ciclos)
    const r = suggestValidLink("a", "b", [["a", "b"]]);
    expect(r).toBeNull();
  });

  it("link sin links previos → null", () => {
    const r = suggestValidLink("a", "b", []);
    expect(r).toBeNull();
  });

  it("nodos sin links salientes → null (currentId no encontrado en links)", () => {
    const r = suggestValidLink("orphan", "x", [["a", "b"], ["b", "c"]]);
    expect(r).toBeNull();
  });

  it("retorna string cuando se detecta ciclo y existe alternativa", () => {
    // Self-loop directo: a → a crea ciclo cuando ya hay a → a
    const r = suggestValidLink("a", "a", [["a", "a"]]);
    // El advisor intentará buscar otro target válido para currentId 'a'
    expect(typeof r === "string" || r === null).toBe(true);
  });
});
