// src/components/business/panels/RoadmapPanel.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, Skeleton } from "@/components/ui";
import { Map, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { loadBusinessMilestones } from "@/lib/business/offline-loader";
import { updateBusinessMilestoneStatus, deleteBusinessMilestone } from "@/lib/business/queries";
import MilestoneForm from "../forms/MilestoneForm.client";
import type { BusinessMilestone } from "@/lib/business/types";
import type { BusinessOfflineData } from "@/lib/business/offline-loader";

import { logError } from "@/lib/log";
interface RoadmapPanelProps {
  offlineData?: BusinessOfflineData | null;
  isReadOnly?: boolean;
}

export default function RoadmapPanel({ offlineData, isReadOnly }: RoadmapPanelProps) {
  const [milestones, setMilestones] = useState<BusinessMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadMilestones();
  }, []);

  async function loadMilestones() {
    try {
      setLoading(true);
      const data = await loadBusinessMilestones(offlineData);
      setMilestones((data || []) as BusinessMilestone[]);
    } catch (err) {
      logError("RoadmapPanel", { component: "roadmappanel", message: "Error loading milestones", error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: "pending" | "in_progress" | "completed") {
    try {
      await updateBusinessMilestoneStatus(id, newStatus);
      await loadMilestones();
      toast.success("Estado actualizado");
    } catch (err) {
      logError("RoadmapPanel", { component: "roadmappanel", message: "Error updating milestone", error: err instanceof Error ? err.message : String(err) });
      toast.error("No se pudo actualizar el estado");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteBusinessMilestone(id);
      await loadMilestones();
      toast.success("Milestone eliminado");
    } catch (err) {
      logError("RoadmapPanel", { component: "roadmappanel", message: "Error deleting milestone", error: err instanceof Error ? err.message : String(err) });
      toast.error("No se pudo eliminar el milestone");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  const pending = milestones.filter((m) => m.status === "pending");
  const inProgress = milestones.filter((m) => m.status === "in_progress");
  const completed = milestones.filter((m) => m.status === "completed");

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Map className="w-5 h-5 text-cyan-400" />
              <CardTitle className="text-white">Business Milestones</CardTitle>
            </div>
            {!isReadOnly && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                New Milestone
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <Skeleton height={64} count={4} />
          ) : (
            <>
              {/* Pending */}
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  Pending ({pending.length})
                </h3>
                {pending.length === 0 ? (
                  <div className="text-slate-400 text-sm">No pending milestones</div>
                ) : (
                  <div className="space-y-2">
                    {pending.map((m) => (
                      <MilestoneCard
                        key={m.id}
                        milestone={m}
                        onStatusChange={handleStatusChange}
                        onDelete={(id) => setConfirmDeleteId(id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* In Progress */}
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  In Progress ({inProgress.length})
                </h3>
                {inProgress.length === 0 ? (
                  <div className="text-slate-400 text-sm">No in-progress milestones</div>
                ) : (
                  <div className="space-y-2">
                    {inProgress.map((m) => (
                      <MilestoneCard
                        key={m.id}
                        milestone={m}
                        onStatusChange={handleStatusChange}
                        onDelete={(id) => setConfirmDeleteId(id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Completed */}
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  Completed ({completed.length})
                </h3>
                {completed.length === 0 ? (
                  <div className="text-slate-400 text-sm">No completed milestones</div>
                ) : (
                  <div className="space-y-2">
                    {completed.map((m) => (
                      <MilestoneCard
                        key={m.id}
                        milestone={m}
                        onStatusChange={handleStatusChange}
                        isCompleted
                        onDelete={(id) => setConfirmDeleteId(id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="bg-cyan-900/20 border border-cyan-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-slate-300">
              Create milestones to track business goals. When marked complete, notes become read-only.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Form Modal */}
      {showForm && (
        <MilestoneForm
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false);
            loadMilestones();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Eliminar milestone"
        message="Esta acción no se puede deshacer."
        variant="danger"
        confirmLabel="Eliminar"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId ? handleDelete(confirmDeleteId) : Promise.resolve()}
      />
    </div>
  );
}

function MilestoneCard({
  milestone,
  onStatusChange,
  isCompleted = false,
  onDelete,
}: {
  milestone: BusinessMilestone;
  onStatusChange: (id: string, status: "pending" | "in_progress" | "completed") => void;
  isCompleted?: boolean;
  onDelete?: (id: string) => void;
}) {
  const statusColors = {
    pending: "bg-yellow-900/20 border-yellow-800",
    in_progress: "bg-blue-900/20 border-blue-800",
    completed: "bg-green-900/20 border-green-800",
  };

  return (
    <div className={`p-3 rounded border ${statusColors[milestone.status]} space-y-2`}>
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-white">{milestone.title}</h4>
          <p className="text-sm text-slate-400">{milestone.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={milestone.status}
            onChange={(e) =>
              onStatusChange(
                milestone.id,
                e.target.value as "pending" | "in_progress" | "completed"
              )
            }
            className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          {onDelete && (
            <button
              onClick={() => onDelete(milestone.id)}
              className="p-1 hover:bg-red-900/30 rounded text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {milestone.target_date && (
        <div className="text-xs text-slate-400">Target: {milestone.target_date}</div>
      )}
      {milestone.notes && (
        <div className="text-sm text-slate-300 mt-2 p-2 bg-slate-800/50 rounded border border-slate-700">
          {isCompleted ? (
            <>
              <div className="text-xs text-slate-400 mb-1">Notes (read-only)</div>
              <div>{milestone.notes}</div>
            </>
          ) : (
            <>
              <div className="text-xs text-slate-400 mb-1">Notes</div>
              <div>{milestone.notes}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
