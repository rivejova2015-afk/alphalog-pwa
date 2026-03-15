// src/components/business/panels/DecisionsPanel.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flag, Plus, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { loadBusinessDecisions, loadBusinessDecisionTasks } from "@/lib/business/offline-loader";
import { deleteBusinessDecision, getBusinessDecisionWithTasks } from "@/lib/business/queries";
import DecisionForm from "../forms/DecisionForm.client";
import type { BusinessDecision, BusinessDecisionTask } from "@/lib/business/types";
import type { BusinessOfflineData } from "@/lib/business/offline-loader";

interface DecisionsPanelProps {
  offlineData?: BusinessOfflineData | null;
  isReadOnly?: boolean;
}

export default function DecisionsPanel({ offlineData, isReadOnly }: DecisionsPanelProps) {
  const [decisions, setDecisions] = useState<BusinessDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedDecision, setExpandedDecision] = useState<string | null>(null);
  const [decisionTasks, setDecisionTasks] = useState<BusinessDecisionTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [addTaskDecisionId, setAddTaskDecisionId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const taskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDecisions();
  }, []);

  async function loadDecisions() {
    try {
      setLoading(true);
      const data = await loadBusinessDecisions(offlineData);
      setDecisions((data || []) as BusinessDecision[]);
    } catch (err) {
      console.error("Error loading decisions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteBusinessDecision(id);
      setConfirmDeleteId(null);
      await loadDecisions();
      toast.success("Decision deleted");
    } catch (err) {
      console.error("Error deleting decision:", err);
      toast.error("Failed to delete decision");
    }
  }

  async function handleAddTask(decisionId: string) {
    const title = newTaskTitle.trim();
    if (!title) return;
    try {
      const supabase = (await import('@/lib/supabase/browser')).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not authenticated"); return; }
      await supabase.from('business_decision_tasks').insert([
        { decision_id: decisionId, user_id: user.id, title, done: false, sort_index: 0 },
      ]);
      setAddTaskDecisionId(null);
      setNewTaskTitle("");
      await loadDecisions();
      if (expandedDecision === decisionId) await loadDecisionTasks(decisionId);
      toast.success("Task added");
    } catch (err) {
      console.error('Error creating decision task:', err);
      toast.error("Failed to add task");
    }
  }

  async function loadDecisionTasks(decisionId: string) {
    try {
      setTasksLoading(true);
      const res = await getBusinessDecisionWithTasks(decisionId);
      if (res) setDecisionTasks(res.tasks || []);
    } catch (err) {
      console.error('Error loading decision tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  }

  async function toggleDecisionTask(taskId: string, currentDone: boolean) {
    try {
      const supabase = (await import('@/lib/supabase/browser')).createClient();
      const { error } = await supabase.from('business_decision_tasks').update({ done: !currentDone, updated_at: new Date().toISOString() }).eq('id', taskId);
      if (error) {
        console.error('Error updating task:', error);
        alert('Failed to update task');
        return;
      }
      if (expandedDecision) await loadDecisionTasks(expandedDecision);
      await loadDecisions();
    } catch (err) {
      console.error('Error toggling decision task:', err);
    }
  }

  const priorityColors = {
    low: "bg-blue-900/30 text-blue-300",
    med: "bg-yellow-900/30 text-yellow-300",
    high: "bg-red-900/30 text-red-300",
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-400" />
              <CardTitle className="text-white">Strategic Decisions</CardTitle>
            </div>
            {!isReadOnly && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                New Decision
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading decisions...</div>
          ) : decisions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No decisions recorded yet</div>
          ) : (
            <div className="space-y-3">
              {decisions.map((decision) => (
                <div key={decision.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-white">{decision.title}</h4>
                      <p className="text-sm text-slate-400 mt-1">{decision.decision}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[decision.priority]}`}>
                        {decision.priority}
                      </span>
                      <button
                        onClick={() => { setAddTaskDecisionId(decision.id); setNewTaskTitle(""); setTimeout(() => taskInputRef.current?.focus(), 50); }}
                        className="p-1 hover:bg-slate-700/20 rounded text-slate-300 hover:text-white"
                        title="Add follow-up task"
                        aria-label="Add follow-up task"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const next = expandedDecision === decision.id ? null : decision.id;
                          setExpandedDecision(next);
                          if (next) await loadDecisionTasks(next);
                          else setDecisionTasks([]);
                        }}
                        className="px-2 py-1 bg-slate-700 rounded text-slate-200 text-sm"
                        aria-expanded={expandedDecision === decision.id}
                      >
                        Tasks
                      </button>
                      {!isReadOnly && (
                        <button
                          onClick={() => setConfirmDeleteId(decision.id)}
                          className="p-1 hover:bg-red-900/30 rounded text-red-400 hover:text-red-300"
                          aria-label="Delete decision"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {decision.tags && decision.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {decision.tags.map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-slate-700 text-xs text-slate-300 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 pt-2 border-t border-slate-700">
                    Rationale: {decision.rationale}
                  </div>
                  {expandedDecision === decision.id && (
                    <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                      <h5 className="text-sm text-white font-medium">Follow-up Tasks</h5>
                      {tasksLoading ? (
                        <div className="text-slate-400 text-sm py-2">Loading tasks...</div>
                      ) : decisionTasks.length === 0 ? (
                        <div className="text-slate-400 text-sm py-2">No tasks</div>
                      ) : (
                        <div className="space-y-2">
                          {decisionTasks.map((t) => (
                            <div key={t.id} className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
                              <div className="flex items-center gap-3">
                                <input type="checkbox" checked={!!t.done} onChange={() => toggleDecisionTask(t.id, !!t.done)} className="w-4 h-4" />
                                <div className="text-sm text-slate-300">{t.title}</div>
                              </div>
                              <div className="text-xs text-slate-400">{t.done ? 'Done' : 'Pending'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-slate-300">
              Document strategic decisions with context, rationale, and expected impact.
            </p>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <DecisionForm
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false);
            loadDecisions();
            toast.success("Decision saved");
          }}
        />
      )}

      {/* Inline add-task input */}
      {addTaskDecisionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Add task">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">Add Follow-up Task</h3>
            <input
              ref={taskInputRef}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(addTaskDecisionId); if (e.key === "Escape") { setAddTaskDecisionId(null); setNewTaskTitle(""); } }}
              placeholder="Task title..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setAddTaskDecisionId(null); setNewTaskTitle(""); }} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition">Cancel</button>
              <button onClick={() => handleAddTask(addTaskDecisionId)} disabled={!newTaskTitle.trim()} className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg transition">Add Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Inline confirm delete */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Confirm delete">
          <div className="bg-slate-900 border border-red-800/60 rounded-xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100 mb-2">Delete Decision?</h3>
            <p className="text-xs text-slate-400 mb-4">This action cannot be undone. All tasks associated with this decision will also be removed.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition">Cancel</button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="px-3 py-1.5 text-sm bg-red-700 hover:bg-red-600 text-white rounded-lg transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
