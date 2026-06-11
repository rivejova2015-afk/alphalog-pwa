"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AccountsPanel from "@/components/tradehub/AccountsPanel.client";
import AabTreeView from "@/components/tradehub/aab/AabTreeView.client";
import AabRightPanel from "@/components/tradehub/aab/AabRightPanel.client";
import { isPublicFeatureEnabled } from "@/lib/runtime/featureFlags";
import { Skeleton } from "@/components/ui";

interface CopyGroup {
  id: string;
  name: string;
  active_version: number;
  sync_mode: "hard" | "soft";
}

interface Account {
  id: string;
  name: string;
  currency: string;
  status: string;
  operation_state: string | null;
  phase_status: string | null;
  role: string | null;
}

interface CopyGroupNode {
  id: string;
  account_id: string;
  role: "master" | "slave";
  status: "active" | "paused" | "read_only";
  risk_pct: number;
  sort_index: number;
  risk_node?: Record<string, unknown> | null;
  account?: Account | null;
}

interface CopyGroupLink {
  id: string;
  parent_account_id: string;
  child_account_id: string;
  copy_multiplier: number;
  link_type: "solid" | "shadow";
}

interface CopyGroupGraph {
  group: CopyGroup;
  nodes: CopyGroupNode[];
  links: CopyGroupLink[];
  versions: Array<{ id: string; version_int: number; message: string | null; created_at: string }>;
  events: Array<{ id: string; event_type: string; payload_json: Record<string, unknown> | null; created_at: string }>;
  experiments: Record<string, unknown>;
}

const EXPERIMENT_FLAGS = [
  "auto_split_by_setup_tags",
  "shadow_master",
  "sandbox_branching",
  "elasticity",
  "tokens",
  "drawdown_geometry",
  "partial_fill_emulator",
  "throttle_params",
  "drift_detection",
  "heatmap",
  "edge_decay",
  "rr_shaper",
  "what_if_simulator",
  "replay_mode",
  "shadow_config",
  "stress_test_generator",
  "auto_parameter_tuning",
  "montecarlo_ladder",
];

export default function AabPage() {
  const isEnabled = isPublicFeatureEnabled("enableAab");
  const [groups, setGroups] = useState<CopyGroup[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [graph, setGraph] = useState<CopyGroupGraph | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "tree">("tree");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");

  const fetchGroups = useCallback(async () => {
    const res = await fetch("/api/copy-groups");
    if (!res.ok) {
      throw new Error("No se pudieron cargar los CopyGroups");
    }
    const data = (await res.json()) as CopyGroup[];
    setGroups(Array.isArray(data) ? data : []);
  }, []);

  const fetchAccounts = useCallback(async () => {
    const res = await fetch("/api/accounts");
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as Account[];
    setAccounts(Array.isArray(data) ? data : []);
  }, []);

  const loadGraph = useCallback(async (groupId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/copy-groups/${groupId}/graph`);
      if (!res.ok) {
        throw new Error("No se pudo cargar el grafo");
      }
      const data = (await res.json()) as CopyGroupGraph;
      setGraph(data);
      setSelectedNodeId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar grafo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGroups();
    void fetchAccounts();
  }, [fetchGroups, fetchAccounts]);

  useEffect(() => {
    if (selectedGroupId) {
      void loadGraph(selectedGroupId);
    } else {
      setGraph(null);
    }
  }, [selectedGroupId, loadGraph]);

  const selectedNode = useMemo(() => {
    if (!graph || !selectedNodeId) return null;
    return graph.nodes.find((node) => node.id === selectedNodeId) || null;
  }, [graph, selectedNodeId]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/copy-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo crear CopyGroup");
      }
      setNewGroupName("");
      await fetchGroups();
      setSelectedGroupId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear CopyGroup");
    } finally {
      setLoading(false);
    }
  };

  if (!isEnabled) {
    return (
      <div className="p-8 text-slate-200">
        <h1 className="text-2xl font-semibold">Accounts Architect Bot (AAB)</h1>
        <p className="text-slate-400 mt-2">AAB está deshabilitado por configuración.</p>
        <Link className="text-blue-400 underline mt-4 inline-block" href="/dashboard/tradehub">
          Volver a TradeHub
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display-font text-2xl font-semibold text-slate-50">Accounts Architect Bot (AAB)</h1>
          <p className="text-sm text-slate-400">CopyGroups, árbol multi-nivel y mirroring controlado.</p>
        </div>
        <Link className="text-sm text-blue-300 hover:text-blue-200" href="/dashboard/tradehub">
          ← Volver a TradeHub
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-300">CopyGroup</label>
          <select
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
          >
            <option value="">Selecciona CopyGroup</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Nuevo CopyGroup"
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={handleCreateGroup}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500"
            >
              Crear
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 rounded-lg text-sm ${
                viewMode === "list" ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-300"
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode("tree")}
              className={`px-3 py-2 rounded-lg text-sm ${
                viewMode === "tree" ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-300"
              }`}
            >
              Árbol
            </button>
          </div>
        </div>

        {error && <div className="text-sm text-rose-400">{error}</div>}
      </div>

      {viewMode === "list" && <AccountsPanel />}

      {viewMode === "tree" && (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 min-h-[520px]">
            {loading && (
              <div className="space-y-3" aria-busy="true" aria-label="Cargando árbol">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-[calc(100%-1rem)] ml-4 rounded-xl" />
                <Skeleton className="h-16 w-[calc(100%-2rem)] ml-8 rounded-xl" />
              </div>
            )}
            {!loading && graph && (
              <AabTreeView
                nodes={graph.nodes}
                links={graph.links}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                copyGroupId={selectedGroupId || null}
                onReorderCommitted={() => selectedGroupId && loadGraph(selectedGroupId)}
              />
            )}
            {!loading && !graph && (
              <div className="text-slate-500 text-sm">Selecciona un CopyGroup para ver el árbol.</div>
            )}
          </div>

          <AabRightPanel
            group={graph?.group || null}
            nodes={graph?.nodes || []}
            links={graph?.links || []}
            versions={graph?.versions || []}
            events={graph?.events || []}
            experiments={graph?.experiments || {}}
            accounts={accounts}
            selectedNode={selectedNode}
            onReload={() => selectedGroupId && loadGraph(selectedGroupId)}
            onSelectNode={setSelectedNodeId}
            experimentFlags={EXPERIMENT_FLAGS}
          />
        </div>
      )}
    </div>
  );
}
