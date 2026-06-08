// src/components/business/forms/SOPForm.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { SOP_TYPES } from "@/lib/business/types";
import type { BusinessSOP } from "@/lib/business/types";
import { createClient } from "@/lib/supabase/browser";
import { createBusinessSOP } from "@/lib/business/queries";

import { logError } from "@/lib/log";
interface SOPFormProps {
  onClose: () => void;
  onSave: () => void;
}

export default function SOPForm({ onClose, onSave }: SOPFormProps) {
  const supabase = createClient();
  const [formData, setFormData] = useState<{
    title: string;
    type: typeof SOP_TYPES[number];
    content: string;
  }>({
    title: "",
    type: SOP_TYPES[0],
    content: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    try {
      setError("");
      setSaving(true);

      if (!formData.title || !formData.content) {
        setError("Please fill in title and content");
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

      await createBusinessSOP({
        user_id: user.id,
        title: formData.title,
        type: formData.type,
        content: formData.content,
        sort_index: 0,
      });

      onSave();
    } catch (err) {
      logError("SOPForm", { component: "sopform", message: "Error saving SOP", error: err instanceof Error ? err.message : String(err) });
      setError("Failed to save SOP");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-slate-900 border-slate-800 w-96 max-h-96 overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-white">Create SOP</CardTitle>
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
              placeholder="SOP title"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Type *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as typeof SOP_TYPES[number] })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
            >
              {SOP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Content *</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white h-32 resize-none"
              placeholder="Write your SOP steps here..."
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded font-medium"
            >
              {saving ? "Saving..." : "Create SOP"}
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
