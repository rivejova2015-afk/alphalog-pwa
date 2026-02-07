"use client";

import { useEffect, useMemo, useState } from "react";

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
  account?: Account | null;
}

interface CopyGroupLink {
  id: string;
  parent_account_id: string;
  child_account_id: string;
  copy_multiplier: number;
  link_type: "solid" | "shadow";
}

interface VersionRow {
  id: string;
  version_int: number;
  message: string | null;
  created_at: string;
}

interface EventRow {
  id: string;
  event_type: string;
  payload_json: Record<string, unknown> | null;
  created_at: string;
}

export default function AabRightPanel({
  group,
  nodes,
  links,
  versions,
  events,
  experiments,
  accounts,
  selectedNode,
  onReload,
  onSelectNode,
  experimentFlags,
}: {
  group: CopyGroup | null;
  nodes: CopyGroupNode[];
  links: CopyGroupLink[];
  versions: VersionRow[];
  events: EventRow[];
  experiments: Record<string, unknown>;
  accounts: Account[];
  selectedNode: CopyGroupNode | null;
  onReload: () => void;
  onSelectNode: (id: string | null) => void;
  experimentFlags: string[];
}) {
  const [nodeForm, setNodeForm] = useState({
    account_id: "",
    role: "slave",
    status: "active",
    risk_pct: 0,
  });
  const [linkForm, setLinkForm] = useState({
    parent_account_id: "",
    child_account_id: "",
    copy_multiplier: 1,
    link_type: "solid",
  });
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodeRisk, setNodeRisk] = useState(0);
  const [nodeStatus, setNodeStatus] = useState<CopyGroupNode["status"]>("active");
  const [linkMultiplier, setLinkMultiplier] = useState(1);
  const [linkType, setLinkType] = useState<CopyGroupLink["link_type"]>("solid");

  const selectedParentLink = useMemo(() => {
    if (!selectedNode) return null;
    return links.find((link) => link.child_account_id === selectedNode.account_id) || null;
  }, [links, selectedNode]);

  useEffect(() => {
    if (!selectedNode) return;
    setNodeRisk(selectedNode.risk_pct);
    setNodeStatus(selectedNode.status);
  }, [selectedNode]);

  useEffect(() => {
    if (!selectedParentLink) return;
    setLinkMultiplier(selectedParentLink.copy_multiplier);
    setLinkType(selectedParentLink.link_type);
  }, [selectedParentLink]);

  const handleAddNode = async () => {
    if (!group) return;
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/copy-groups/${group.id}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nodeForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo crear el nodo");
      }
      setNodeForm({ account_id: "", role: "slave", status: "active", risk_pct: 0 });
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear nodo");
    } finally {
      setUpdating(false);
    }
  };

  const handleAddLink = async () => {
    if (!group) return;
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/copy-groups/${group.id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(linkForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo crear link");
      }
      setLinkForm({ parent_account_id: "", child_account_id: "", copy_multiplier: 1, link_type: "solid" });
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear link");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateNode = async (updates: Partial<CopyGroupNode>) => {
    if (!group || !selectedNode) return;
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/copy-groups/${group.id}/nodes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: selectedNode.id, ...updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo actualizar el nodo");
      }
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar nodo");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateLink = async (updates: Partial<CopyGroupLink>) => {
    if (!group || !selectedParentLink) return;
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/copy-groups/${group.id}/links`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_id: selectedParentLink.id, ...updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo actualizar link");
      }
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar link");
    } finally {
      setUpdating(false);
    }
  };

  const handleRollback = async (versionInt: number) => {
    if (!group) return;
    if (!confirm(`¿Aplicar rollback a v${versionInt}? Esto crea una nueva versión.`)) return;
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/copy-groups/${group.id}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_int: versionInt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Rollback falló");
      }
      onReload();
      onSelectNode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al hacer rollback");
    } finally {
      setUpdating(false);
    }
  };

  const handleExperimentsChange = async (flag: string, enabled: boolean) => {
    if (!group) return;
    const nextFlags = { ...experiments, [flag]: enabled };
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/copy-groups/${group.id}/experiments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags: nextFlags }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar experiments");
      }
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar experiments");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
      {!group && <div className="text-sm text-slate-400">Selecciona un CopyGroup para editar.</div>}

      {group && (
        <>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-100">{group.name}</div>
            <div className="text-xs text-slate-400">Versión activa: v{group.active_version} • Sync: {group.sync_mode}</div>
          </div>

          {error && <div className="text-xs text-rose-400">{error}</div>}

          <div className="space-y-2">
            <div className="text-xs uppercase text-slate-400">Agregar nodo</div>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
              value={nodeForm.account_id}
              onChange={(e) => setNodeForm((prev) => ({ ...prev, account_id: e.target.value }))}
            >
              <option value="">Cuenta</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                value={nodeForm.role}
                onChange={(e) => setNodeForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="master">master</option>
                <option value="slave">slave</option>
              </select>
              <select
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                value={nodeForm.status}
                onChange={(e) => setNodeForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="read_only">read_only</option>
              </select>
            </div>
            <input
              type="number"
              step="0.01"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
              value={nodeForm.risk_pct}
              onChange={(e) => setNodeForm((prev) => ({ ...prev, risk_pct: Number(e.target.value) }))}
              placeholder="risk_pct"
            />
            <button
              disabled={updating}
              onClick={handleAddNode}
              className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 disabled:opacity-60"
            >
              Agregar nodo
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase text-slate-400">Agregar link</div>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
              value={linkForm.parent_account_id}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, parent_account_id: e.target.value }))}
            >
              <option value="">Parent</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.account_id}>
                  {node.account?.name || node.account_id}
                </option>
              ))}
            </select>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
              value={linkForm.child_account_id}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, child_account_id: e.target.value }))}
            >
              <option value="">Child</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.account_id}>
                  {node.account?.name || node.account_id}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.0001"
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                value={linkForm.copy_multiplier}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, copy_multiplier: Number(e.target.value) }))}
              />
              <select
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                value={linkForm.link_type}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, link_type: e.target.value }))}
              >
                <option value="solid">solid</option>
                <option value="shadow">shadow</option>
              </select>
            </div>
            <button
              disabled={updating}
              onClick={handleAddLink}
              className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600 disabled:opacity-60"
            >
              Agregar link
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase text-slate-400">Nodo seleccionado</div>
            {!selectedNode && <div className="text-sm text-slate-400">Selecciona un nodo en el árbol.</div>}
            {selectedNode && (
              <div className="space-y-2">
                <div className="text-sm text-slate-100">{selectedNode.account?.name || "Cuenta"}</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.01"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                    value={nodeRisk}
                    onChange={(e) => setNodeRisk(Number(e.target.value))}
                  />
                  <select
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                    value={nodeStatus}
                    onChange={(e) => setNodeStatus(e.target.value as CopyGroupNode["status"])}
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="read_only">read_only</option>
                  </select>
                </div>
                <button
                  disabled={updating}
                  onClick={() => handleUpdateNode({ risk_pct: nodeRisk, status: nodeStatus })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600 disabled:opacity-60"
                >
                  Guardar nodo
                </button>
                {selectedParentLink && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.0001"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                      value={linkMultiplier}
                      onChange={(e) => setLinkMultiplier(Number(e.target.value))}
                    />
                    <select
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                      value={linkType}
                      onChange={(e) => setLinkType(e.target.value as CopyGroupLink["link_type"])}
                    >
                      <option value="solid">solid</option>
                      <option value="shadow">shadow</option>
                    </select>
                  </div>
                )}
                {selectedParentLink && (
                  <button
                    disabled={updating}
                    onClick={() => handleUpdateLink({ copy_multiplier: linkMultiplier, link_type: linkType })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600 disabled:opacity-60"
                  >
                    Guardar link
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase text-slate-400">Experimental (Coming soon)</div>
            <div className="space-y-1">
              {experimentFlags.map((flag) => (
                <label key={flag} className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(experiments?.[flag])}
                    onChange={(e) => handleExperimentsChange(flag, e.target.checked)}
                  />
                  {flag}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase text-slate-400">Versiones</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {versions.map((version) => (
                <div key={version.id} className="flex items-center justify-between text-xs text-slate-300">
                  <div>
                    v{version.version_int} • {version.message || "(sin mensaje)"}
                  </div>
                  <button
                    onClick={() => handleRollback(version.version_int)}
                    className="text-blue-300 hover:text-blue-200"
                  >
                    Rollback
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase text-slate-400">Timeline</div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {events.map((event) => (
                <div key={event.id} className="text-xs text-slate-300">
                  <div className="font-medium text-slate-100">{event.event_type}</div>
                  <div className="text-[11px] text-slate-500">{new Date(event.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
