// src/components/business/panels/LLCPanel.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, Modal, Skeleton } from "@/components/ui";
import { Building2, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { loadLLCInfo, loadLLCInbox } from "@/lib/business/offline-loader";
import { deleteLLCInboxItem, createLLCInboxItem, updateLLCInboxItemStatus } from "@/lib/business/queries";
import LLCInfoForm from "../forms/LLCInfoForm.client";
import type { LLCInfo, LLCInboxItem } from "@/lib/business/types";
import type { BusinessOfflineData } from "@/lib/business/offline-loader";

import { logError } from "@/lib/log";
interface LLCPanelProps {
  offlineData?: BusinessOfflineData | null;
  isReadOnly?: boolean;
}

export default function LLCPanel({ offlineData, isReadOnly }: LLCPanelProps) {
  const [llcInfo, setLlcInfo] = useState<LLCInfo | null>(null);
  const [inboxItems, setInboxItems] = useState<LLCInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEIN, setShowEIN] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [showNewItem, setShowNewItem] = useState(false);
  const [savingNewItem, setSavingNewItem] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [llc, inbox] = await Promise.all([loadLLCInfo(offlineData), loadLLCInbox(offlineData)]);
      setLlcInfo(llc as LLCInfo | null);
      setInboxItems((inbox || []) as LLCInboxItem[]);
    } catch (err) {
      logError("LLCPanel", { component: "llcpanel", message: "Error loading LLC data", error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteInboxItem(id: string) {
    try {
      await deleteLLCInboxItem(id);
      await loadData();
      toast.success("Ítem eliminado");
    } catch (err) {
      logError("LLCPanel", { component: "llcpanel", message: "Error deleting item", error: err instanceof Error ? err.message : String(err) });
      toast.error("No se pudo eliminar");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  async function handleUpdateInboxItemStatus(id: string, status: 'new' | 'in_review' | 'done' | 'archived') {
    try {
      await updateLLCInboxItemStatus(id, status);
      await loadData();
      setEditingItemId(null);
      toast.success("Estado actualizado");
    } catch (err) {
      logError("LLCPanel", { component: "llcpanel", message: "Error updating item status", error: err instanceof Error ? err.message : String(err) });
      toast.error("No se pudo actualizar el estado");
    }
  }

  async function handleCreateInboxItem() {
    const title = newItemTitle.trim();
    if (!title) {
      toast.error("Título requerido");
      return;
    }
    setSavingNewItem(true);
    try {
      const { createClient } = await import('@/lib/supabase/browser');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sesión expirada");
        return;
      }
      const received_on = new Date().toISOString().split('T')[0];
      await createLLCInboxItem({ title, received_on, status: 'new', user_id: user.id, sort_index: 0 });
      await loadData();
      toast.success("Ítem añadido");
      setNewItemTitle("");
      setShowNewItem(false);
    } catch (err) {
      logError('LLCPanel', { component: 'llcpanel', message: 'Error creating inbox item', error: err instanceof Error ? err.message : String(err) });
      toast.error("No se pudo crear el ítem");
    } finally {
      setSavingNewItem(false);
    }
  }

  const maskedEIN = llcInfo?.ein ? `****${llcInfo.ein.slice(-4)}` : "****";

  return (
    <div className="space-y-6">
      {/* LLC Info Card */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <CardTitle className="text-white">LLC Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton height={60} count={3} />
          ) : !llcInfo ? (
            <div className="space-y-4">
              <p className="text-slate-400">No LLC information set up yet</p>
              <button
                onClick={() => setShowForm(true)}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium"
              >
                Set Up LLC Info
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-800 p-3 rounded border border-slate-700">
                <div className="text-sm text-slate-400">LLC Name</div>
                <div className="text-lg font-semibold text-white">{llcInfo.llc_name}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-800 p-3 rounded border border-slate-700">
                  <div className="text-sm text-slate-400">EIN</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-lg font-semibold text-white font-mono">{showEIN ? llcInfo.ein : maskedEIN}</span>
                    <button
                      onClick={() => setShowEIN(!showEIN)}
                      className="p-1 hover:bg-slate-700 rounded"
                    >
                      {showEIN ? (
                        <EyeOff className="w-4 h-4 text-slate-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-800 p-3 rounded border border-slate-700">
                  <div className="text-sm text-slate-400">Formation Date</div>
                  <div className="text-lg font-semibold text-white">
                    {llcInfo.formation_date || "Not set"}
                  </div>
                </div>

                <div className="bg-slate-800 p-3 rounded border border-slate-700">
                  <div className="text-sm text-slate-400">Annual Report Due</div>
                  <div className="text-lg font-semibold text-white">
                    {new Date(2024, (llcInfo.annual_report_due_month || 1) - 1).toLocaleDateString("en-US", {
                      month: "long",
                    })}
                  </div>
                </div>

                <div className="bg-slate-800 p-3 rounded border border-slate-700">
                  <div className="text-sm text-slate-400">Annual Fee</div>
                  <div className="text-lg font-semibold text-white">
                    ${(llcInfo.annual_fee_baseline || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {llcInfo.registered_agent_name && (
                <div className="bg-slate-800 p-3 rounded border border-slate-700">
                  <div className="text-sm text-slate-400">Registered Agent</div>
                  <div className="text-white font-medium">{llcInfo.registered_agent_name}</div>
                </div>
              )}

              {!isReadOnly && (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium border border-slate-700"
                >
                  Edit LLC Info
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LLC Inbox */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">LLC Inbox</CardTitle>
            {!isReadOnly && (
              <button
                onClick={() => setShowNewItem(true)}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {inboxItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No inbox items</div>
          ) : (
            <div className="space-y-2">
              {inboxItems.map((item) => (
                <div key={item.id} className="bg-slate-800 p-3 rounded border border-slate-700 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-white">{item.title}</h4>
                      <p className="text-xs text-slate-400">Received: {item.received_on}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingItemId === item.id ? (
                        <select
                          value={item.status}
                          onChange={(e) => handleUpdateInboxItemStatus(item.id, e.target.value as 'new' | 'in_review' | 'done' | 'archived')}
                          className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                        >
                          <option value="new">New</option>
                          <option value="in_review">In Review</option>
                          <option value="done">Done</option>
                          <option value="archived">Archived</option>
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingItemId(item.id)}
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 rounded"
                        >
                          {item.status}
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="p-1 hover:bg-red-900/30 rounded text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {item.notes && <p className="text-sm text-slate-300">{item.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <LLCInfoForm
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false);
            loadData();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Eliminar ítem"
        message="Esta acción no se puede deshacer."
        variant="danger"
        confirmLabel="Eliminar"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId ? handleDeleteInboxItem(confirmDeleteId) : Promise.resolve()}
      />

      <Modal
        open={showNewItem}
        onClose={() => !savingNewItem && setShowNewItem(false)}
        title="Nuevo ítem de inbox"
        variant="form"
        footer={
          <>
            <button
              onClick={() => setShowNewItem(false)}
              disabled={savingNewItem}
              className="px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleCreateInboxItem()}
              disabled={savingNewItem || newItemTitle.trim().length === 0}
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium disabled:opacity-50"
            >
              {savingNewItem ? "Creando…" : "Crear"}
            </button>
          </>
        }
      >
        <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1.5">Título</label>
        <input
          type="text"
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleCreateInboxItem(); }}
          autoFocus
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-indigo-500/50"
          placeholder="ej: Notice from Florida Division of Corporations"
        />
      </Modal>
    </div>
  );
}
