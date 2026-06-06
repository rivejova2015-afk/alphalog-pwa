// src/components/business/forms/MilestoneForm.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { createBusinessMilestone } from "@/lib/business/queries";
import { createClient } from "@/lib/supabase/browser";

import { logError } from "@/lib/log";
interface MilestoneFormProps {
  onClose: () => void;
  onSave: () => void;
}

export default function MilestoneForm({ onClose, onSave }: MilestoneFormProps) {
  const supabase = createClient();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    notes: "",
    target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    try {
      setError("");
      setSaving(true);

      if (!formData.title || !formData.target_date) {
        setError("Please fill in title and target date");
        return;
      }

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated");
        return;
      }

      await createBusinessMilestone({
        user_id: user.id,
        title: formData.title,
        description: formData.description,
        notes: formData.notes || null,
        target_date: formData.target_date,
        status: "pending",
        sort_index: 0,
      });

      onSave();
    } catch (err) {
      logError("MilestoneForm", { component: "milestoneform", message: "Error saving milestone", error: err instanceof Error ? err.message : String(err) });
      setError("Failed to save milestone");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-slate-900 border-slate-800 w-96">
        <CardHeader>
          <CardTitle className="text-white">Create Milestone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-300 mb-2">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              placeholder="Milestone title"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white h-20 resize-none"
              placeholder="What is this milestone about?"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Target Date *</label>
            <input
              type="date"
              value={formData.target_date}
              onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white h-16 resize-none"
              placeholder="Add notes (will be read-only when milestone is completed)"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded font-medium"
            >
              {saving ? "Saving..." : "Create Milestone"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium"
            >
              Cancel
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
