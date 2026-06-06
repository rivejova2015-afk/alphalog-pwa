// src/components/business/panels/SOPsPanel.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, Skeleton } from "@/components/ui";
import { BookOpen, Plus, Play, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { loadBusinessSOPs } from "@/lib/business/offline-loader";
import { createBusinessSOPRun, deleteBusinessSOP, getBusinessSOPWithItems, getBusinessSOPRuns, getBusinessSOPRunItems, updateBusinessSOPRunItem } from "@/lib/business/queries";
import SOPForm from "../forms/SOPForm.client";
import type { BusinessSOP, BusinessSOPItem, BusinessSOPRun, BusinessSOPRunItem } from "@/lib/business/types";
import type { BusinessOfflineData } from "@/lib/business/offline-loader";

import { logError } from "@/lib/log";
interface SOPsPanelProps {
  offlineData?: BusinessOfflineData | null;
  isReadOnly?: boolean;
}

export default function SOPsPanel({ offlineData, isReadOnly }: SOPsPanelProps) {
  const [sops, setSops] = useState<BusinessSOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSop, setSelectedSop] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sopItems, setSopItems] = useState<BusinessSOPItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [runs, setRuns] = useState<BusinessSOPRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runItems, setRunItems] = useState<import('@/lib/business/types').BusinessSOPRunItem[]>([]);
  const [runItemsLoading, setRunItemsLoading] = useState(false);
  const [confirmDeleteSopId, setConfirmDeleteSopId] = useState<string | null>(null);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);

  useEffect(() => {
    loadSOPs();
  }, []);

  async function loadSOPs() {
    try {
      setLoading(true);
      const data = await loadBusinessSOPs(offlineData);
      setSops((data || []) as BusinessSOP[]);
    } catch (err) {
      logError("SOPsPanel", { component: "sopspanel", message: "Error loading SOPs", error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function handleStartRun(sopId: string) {
    try {
      // user_id is injected server-side by the route handler
      const created = await createBusinessSOPRun({
        sop_id: sopId,
        run_date: new Date().toISOString().split("T")[0],
      } as Parameters<typeof createBusinessSOPRun>[0]);

      if (!created) {
        toast.error("No se pudo crear el run");
        return;
      }

      // reload runs and open the new run
      await loadSopRuns(sopId);
      setSelectedRunId(created.id);
      await loadRunItems(created.id);
      toast.success("SOP run creado");
    } catch (err) {
      logError("SOPsPanel", { component: "sopspanel", message: "Error creating run", error: err instanceof Error ? err.message : String(err) });
      toast.error("No se pudo crear el run");
    }
  }

  async function handleDelete(sopId: string) {
    try {
      await deleteBusinessSOP(sopId);
      await loadSOPs();
      setSelectedSop(null);
      toast.success("SOP eliminado");
    } catch (err) {
      logError("SOPsPanel", { component: "sopspanel", message: "Error deleting SOP", error: err instanceof Error ? err.message : String(err) });
      toast.error("No se pudo eliminar el SOP");
    } finally {
      setConfirmDeleteSopId(null);
    }
  }

  async function loadSopItems(sopId: string) {
    try {
      setItemsLoading(true);
      const data = await getBusinessSOPWithItems(sopId);
      setSopItems(data?.items || []);
    } catch (err) {
      logError("SOPsPanel", { component: "sopspanel", message: "Error loading SOP items", error: err instanceof Error ? err.message : String(err) });
    } finally {
      setItemsLoading(false);
    }
  }

  async function handleAddItem(sopId: string, title: string) {
    if (!title) return;
    try {
      const csrf = (typeof document !== 'undefined' ? document.cookie.match(/al_csrf=([^;]+)/)?.[1] : '') ?? '';
      const res = await fetch(`/api/business/sops/${encodeURIComponent(sopId)}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': decodeURIComponent(csrf) },
        body: JSON.stringify({ label: title }),
      });
      if (!res.ok) { toast.error("No se pudo añadir el ítem"); return; }
      await loadSopItems(sopId);
      toast.success("Ítem añadido");
    } catch (err) {
      logError('SOPsPanel', { component: 'sopspanel', message: 'Error adding SOP item', error: err instanceof Error ? err.message : String(err) });
      toast.error("No se pudo añadir el ítem");
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      const csrf = (typeof document !== 'undefined' ? document.cookie.match(/al_csrf=([^;]+)/)?.[1] : '') ?? '';
      const res = await fetch(`/api/business/sops/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': decodeURIComponent(csrf) },
      });
      if (!res.ok) { toast.error("No se pudo eliminar el ítem"); return; }
      if (selectedSop) await loadSopItems(selectedSop);
      toast.success("Ítem eliminado");
    } catch (err) {
      logError('SOPsPanel', { component: 'sopspanel', message: 'Error deleting SOP item', error: err instanceof Error ? err.message : String(err) });
      toast.error("No se pudo eliminar el ítem");
    } finally {
      setConfirmDeleteItemId(null);
    }
  }

  async function loadSopRuns(sopId: string) {
    try {
      setRunsLoading(true);
      const data = await getBusinessSOPRuns(sopId);
      setRuns(data || []);
    } catch (err) {
      logError('SOPsPanel', { component: 'sopspanel', message: 'Error loading SOP runs', error: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunsLoading(false);
    }
  }

  async function loadRunItems(runId: string) {
    try {
      setRunItemsLoading(true);
      const data = await getBusinessSOPRunItems(runId);
      setRunItems(data || []);
    } catch (err) {
      logError('SOPsPanel', { component: 'sopspanel', message: 'Error loading run items', error: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunItemsLoading(false);
    }
  }

  async function toggleRunItem(itemId: string, currentChecked: boolean) {
    try {
      const ok = await updateBusinessSOPRunItem(itemId, !currentChecked);
      if (!ok) {
        toast.error("No se pudo actualizar el ítem");
        return;
      }
      if (selectedRunId) await loadRunItems(selectedRunId);
    } catch (err) {
      logError('SOPsPanel', { component: 'sopspanel', message: 'Error toggling run item', error: err instanceof Error ? err.message : String(err) });
      toast.error("No se pudo actualizar el ítem");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-green-400" />
              <CardTitle className="text-white">Standard Operating Procedures</CardTitle>
            </div>
            {!isReadOnly && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                New SOP
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <Skeleton height={60} count={4} />
          ) : sops.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No SOPs created yet</div>
          ) : (
            <div className="space-y-3">
              {sops.map((sop) => (
                <SOPCard
                  key={sop.id}
                  sop={sop}
                  isSelected={selectedSop === sop.id}
                  onSelect={async () => {
                    const next = selectedSop === sop.id ? null : sop.id;
                    setSelectedSop(next);
                    if (next) {
                      await loadSopItems(next);
                      await loadSopRuns(next);
                      setSelectedRunId(null);
                      setRunItems([]);
                    } else {
                      setSopItems([]);
                      setRuns([]);
                      setSelectedRunId(null);
                      setRunItems([]);
                    }
                  }}
                  onStartRun={handleStartRun}
                  onDelete={(id) => setConfirmDeleteSopId(id)}
                />
              ))}
            </div>
          )}

          <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-slate-300">
              Create SOPs for your trading processes. Run executions track checklist items with
              timestamps.
            </p>
          </div>
        </CardContent>
      </Card>

      {selectedSop && (
        <div className="mt-4">
          <div className="bg-slate-900 border-slate-800 rounded p-4">
            <h4 className="text-white font-semibold">Selected SOP Details</h4>
            <div className="text-sm text-slate-300 mt-2">
              {/* show sop content if available */}
              {sops.find((s) => s.id === selectedSop)?.content}
            </div>

            <div className="mt-4">
              <h5 className="text-sm text-white font-medium">Checklist</h5>
              {itemsLoading ? (
                <div className="text-slate-400 text-sm py-2">Loading items...</div>
              ) : sopItems.length === 0 ? (
                <div className="text-slate-400 text-sm py-2">No items</div>
              ) : (
                <div className="space-y-2 mt-2">
                  {sopItems.map((it) => (
                    <div key={it.id} className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
                      <div className="text-sm text-slate-300">{it.label}</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setConfirmDeleteItemId(it.id)} className="p-1 text-red-400 hover:text-red-300" aria-label="Eliminar ítem">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 flex gap-2">
                <input id={`new-item-selected`} placeholder="New item title" className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm" />
                <button
                  onClick={() => {
                    const el = document.getElementById(`new-item-selected`) as HTMLInputElement | null;
                    if (!el) return;
                    const v = el.value.trim();
                    if (!v) return;
                    handleAddItem(selectedSop, v);
                    el.value = "";
                  }}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm"
                >
                  Add
                </button>
              </div>
              <div className="mt-6">
                <h5 className="text-sm text-white font-medium">Runs</h5>
                {runsLoading ? (
                  <div className="text-slate-400 text-sm py-2">Loading runs...</div>
                ) : runs.length === 0 ? (
                  <div className="text-slate-400 text-sm py-2">No runs yet</div>
                ) : (
                  <div className="space-y-2 mt-2">
                    {runs.map((r) => (
                      <div key={r.id} className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
                        <div className="text-sm text-slate-300">{r.run_date}</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              setSelectedRunId(r.id);
                              await loadRunItems(r.id);
                            }}
                            className={`px-2 py-1 rounded text-sm ${selectedRunId === r.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedRunId && (
                  <div className="mt-4">
                    <h6 className="text-sm text-white font-medium">Run Checklist</h6>
                    {runItemsLoading ? (
                      <div className="text-slate-400 text-sm py-2">Loading run items...</div>
                    ) : runItems.length === 0 ? (
                      <div className="text-slate-400 text-sm py-2">No run items</div>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {runItems.map((it) => (
                          <div key={it.id} className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={!!it.checked}
                                onChange={() => toggleRunItem(it.id, !!it.checked)}
                                className="w-4 h-4"
                                id={`run-item-${it.id}`}
                              />
                              <label htmlFor={`run-item-${it.id}`} className="text-sm text-slate-300">{sopItems.find(si => si.id === it.item_id)?.label || it.note || 'Item'}</label>
                            </div>
                            <div className="text-xs text-slate-400">{it.checked_at ? new Date(it.checked_at).toLocaleString() : ''}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <SOPForm
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false);
            loadSOPs();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteSopId !== null}
        title="Eliminar SOP"
        message="Esta acción no se puede deshacer."
        variant="danger"
        confirmLabel="Eliminar"
        onCancel={() => setConfirmDeleteSopId(null)}
        onConfirm={() => confirmDeleteSopId ? handleDelete(confirmDeleteSopId) : Promise.resolve()}
      />
      <ConfirmDialog
        open={confirmDeleteItemId !== null}
        title="Eliminar ítem"
        message="Se quitará del checklist."
        variant="danger"
        confirmLabel="Eliminar"
        onCancel={() => setConfirmDeleteItemId(null)}
        onConfirm={() => confirmDeleteItemId ? handleDeleteItem(confirmDeleteItemId) : Promise.resolve()}
      />
    </div>
  );
}

function SOPCard({
  sop,
  isSelected,
  onSelect,
  onStartRun,
  onDelete,
}: {
  sop: BusinessSOP;
  isSelected: boolean;
  onSelect: () => void;
  onStartRun: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const typeColors: Record<string, string> = {
    pre_session: "bg-blue-900/30 text-blue-300",
    post_session: "bg-purple-900/30 text-purple-300",
    drawdown_protocol: "bg-red-900/30 text-red-300",
    withdrawal_protocol: "bg-green-900/30 text-green-300",
    weekly_close: "bg-yellow-900/30 text-yellow-300",
    monthly_close: "bg-orange-900/30 text-orange-300",
    custom: "bg-slate-700/30 text-slate-300",
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 cursor-pointer hover:border-slate-600 transition">
      <div onClick={onSelect} className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-white">{sop.title}</h4>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{sop.content}</p>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[sop.type] || typeColors.custom}`}>
            {sop.type}
          </span>
        </div>
      </div>

      {isSelected && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="flex gap-2">
            <button
              onClick={() => onStartRun(sop.id)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium"
            >
              <Play className="w-4 h-4" />
              Start Run
            </button>
            <button
              onClick={() => onDelete(sop.id)}
              className="p-2 hover:bg-red-900/30 rounded text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
