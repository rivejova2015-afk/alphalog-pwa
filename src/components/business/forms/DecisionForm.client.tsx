// src/components/business/forms/DecisionForm.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { createBusinessDecision } from "@/lib/business/queries";
import { createClient } from "@/lib/supabase/browser";

interface DecisionFormProps {
  onClose: () => void;
  onSave: () => void;
}

export default function DecisionForm({ onClose, onSave }: DecisionFormProps) {
  const supabase = createClient();
  const [formData, setFormData] = useState({
    title: "",
    context: "",
    decision: "",
    rationale: "",
    impact: "",
    priority: "med" as "low" | "med" | "high",
    tags: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    try {
      setError("");
      setSaving(true);

      if (!formData.title || !formData.decision || !formData.priority) {
        setError("Please fill in title, decision, and priority");
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

      const tags = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await createBusinessDecision({
        user_id: user.id,
        title: formData.title,
        context: formData.context,
        decision: formData.decision,
        rationale: formData.rationale,
        impact: formData.impact,
        priority: formData.priority,
        tags,
        sort_index: 0,
      });

      onSave();
    } catch (err) {
      console.error("Error saving decision:", err);
      setError("Failed to save decision");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-slate-900 border-slate-800 w-96 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-white">Record Decision</CardTitle>
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
              placeholder="Decision title"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Context</label>
            <textarea
              value={formData.context}
              onChange={(e) => setFormData({ ...formData, context: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white h-16 resize-none"
              placeholder="What led to this decision?"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Decision *</label>
            <textarea
              value={formData.decision}
              onChange={(e) => setFormData({ ...formData, decision: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white h-16 resize-none"
              placeholder="What did you decide?"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Rationale</label>
            <textarea
              value={formData.rationale}
              onChange={(e) => setFormData({ ...formData, rationale: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white h-16 resize-none"
              placeholder="Why did you make this choice?"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Impact</label>
            <textarea
              value={formData.impact}
              onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white h-16 resize-none"
              placeholder="What's the expected outcome?"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Priority *</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as "low" | "med" | "high" })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
            >
              <option value="low">Low</option>
              <option value="med">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Tags</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              placeholder="Comma-separated tags (e.g., strategy, risk, approval)"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded font-medium"
            >
              {saving ? "Saving..." : "Record Decision"}
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
