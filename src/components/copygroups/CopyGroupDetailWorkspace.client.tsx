"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle, MoveVertical } from "lucide-react";
import AabRightPanel from "@/components/tradehub/aab/AabRightPanel.client";
import CopyGroupGraph from "./CopyGroupGraph.client";
import { SortableSlavesList } from "./SortableSlavesList.client";

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
  account?: Account | null;
}

interface CopyGroupLink {
  id: string;
  parent_account_id: string;
  child_account_id: string;
  copy_multiplier: number;
  link_type: "solid" | "shadow";
}

interface CopyGroupGraphData {
  group: { id: string; name: string; active_version: number; sync_mode: "hard" | "soft" };
  nodes: CopyGroupNode[];
  links: CopyGroupLink[];
  versions: Array<{ id: string; version_int: number; message: string | null; created_at: string }>;
  events: Array<{ id: string; event_type: string; payload_json: Record<string, unknown> | null; created_at: string }>;
  experiments: Record<string, unknown>;
}

const EXPERIMENT_FLAGS = [
  "shadow_master", "elasticity", "tokens", "drawdown_geometry",
  "partial_fill_emulator", "throttle_params", "drift_detection", "heatmap",
];

export default function CopyGroupDetailWorkspace({ copyGroupId }: { copyGroupId: string }) {
  const [graph, setGraph] = useState<CopyGroupGraphData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [graphRes, accountsRes] = await Promise.all([
        fetch(`/api/copy-groups/${copyGroupId}/graph`),
        fetch("/api/accounts"),
      ]);
      if (!graphRes.ok) throw new Error(`No se pudo cargar el grafo (HTTP ${graphRes.status})`);
      const graphData = (await graphRes.json()) as CopyGroupGraphData;
      setGraph(graphData);
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(Array.isArray(accountsData) ? accountsData : (accountsData?.accounts ?? []));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [copyGroupId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const selectedNode = useMemo(
    () => graph?.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph?.nodes, selectedNodeId]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#94a3b8] text-sm">
        <Loader2 size={16} className="animate-spin mr-2" />
        Cargando grupo…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#7f1d1d]/20 border border-[#dc2626]/30 rounded-lg p-4 flex items-start gap-2">
        <AlertCircle size={16} className="text-[#f87171] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-[#fca5a5] font-medium">Error</p>
          <p className="text-xs text-[#fca5a5]/80 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!graph) return null;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">{graph.group.name}</h1>
          <p className="text-xs text-[#94a3b8] mt-1">
            v{graph.group.active_version} · sync: {graph.group.sync_mode} ·
            {" "}{graph.nodes.length} nodos · {graph.links.length} links
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <div className="space-y-4">
          <CopyGroupGraph
            nodes={graph.nodes}
            links={graph.links}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />

          <section className="rounded-lg border border-[#1f2937] bg-[#151b28] p-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8] mb-3 flex items-center gap-2">
              <MoveVertical size={14} className="text-[#22d3ee]" />
              Orden de slaves (drag para reordenar)
            </h2>
            <SortableSlavesList
              copyGroupId={graph.group.id}
              initialSlaves={graph.nodes.filter((n) => n.role === "slave")}
              onReorderCommitted={() => void loadAll()}
            />
          </section>
        </div>

        <AabRightPanel
          group={graph.group}
          nodes={graph.nodes}
          links={graph.links}
          versions={graph.versions}
          events={graph.events}
          experiments={graph.experiments}
          accounts={accounts}
          selectedNode={selectedNode}
          onReload={() => void loadAll()}
          onSelectNode={setSelectedNodeId}
          experimentFlags={EXPERIMENT_FLAGS}
        />
      </div>
    </div>
  );
}
