// src/components/business/forms/CostForm.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { COST_CATEGORIES } from "@/lib/business/types";
import { createBusinessCost } from "@/lib/business/queries";

import { logError } from "@/lib/log";
interface CostFormProps {
  onClose: () => void;
  onSave: () => void;
}

export default function CostForm({ onClose, onSave }: CostFormProps) {
  const [formData, setFormData] = useState<{
    amount: number;
    category: typeof COST_CATEGORIES[number];
    description: string;
    vendor: string;
    cost_date: string;
    is_recurring_instance: boolean;
  }>({
    amount: 0,
    category: COST_CATEGORIES[0],
    description: "",
    vendor: "",
    cost_date: new Date().toISOString().split("T")[0],
    is_recurring_instance: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    try {
      setError("");
      setSaving(true);

      if (!formData.vendor || !formData.description || formData.amount <= 0) {
        setError("Please fill all required fields");
        return;
      }

      const created = await createBusinessCost({
        amount: formData.amount,
        category: formData.category,
        description: formData.description,
        vendor: formData.vendor,
        cost_date: formData.cost_date,
        is_recurring_instance: formData.is_recurring_instance,
        sort_index: 0, // Will be managed by database ordering
      });

      if (!created) {
        setError("Failed to save cost");
        return;
      }

      // If user marked this as recurring, also create a cost template so the
      // /api/cron/business/recurring-costs job auto-generates future instances.
      if (formData.is_recurring_instance) {
        try {
          const day = new Date(formData.cost_date).getDate();
          const startMonth = formData.cost_date.slice(0, 7); // YYYY-MM
          const csrf = (typeof document !== "undefined" ? document.cookie.match(/al_csrf=([^;]+)/)?.[1] : "") ?? "";
          await fetch("/api/business/cost-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-csrf-token": decodeURIComponent(csrf) },
            body: JSON.stringify({
              amount: formData.amount,
              category: formData.category,
              description: formData.description,
              vendor: formData.vendor,
              day_of_month: day,
              start_month: startMonth,
              active: true,
            }),
          });
        } catch (err) {
          logError("CostForm", { component: "costform", message: "Error creating cost template", error: err instanceof Error ? err.message : String(err) });
        }
      }

      onSave();
    } catch (err) {
      logError("CostForm", { component: "costform", message: "Error saving cost", error: err instanceof Error ? err.message : String(err) });
      setError("Failed to save cost");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-slate-900 border-slate-800 w-96">
        <CardHeader>
          <CardTitle className="text-white">Add Business Cost</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-300 mb-2">Amount *</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as typeof COST_CATEGORIES[number] })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
            >
              {COST_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Vendor *</label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              placeholder="e.g., AWS, JetBrains"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Description *</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              placeholder="What is this cost for?"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Date</label>
            <input
              type="date"
              value={formData.cost_date}
              onChange={(e) => setFormData({ ...formData, cost_date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="recurring"
              checked={formData.is_recurring_instance}
              onChange={(e) => setFormData({ ...formData, is_recurring_instance: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="recurring" className="text-sm text-slate-300">
              This is a recurring monthly cost
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded font-medium"
            >
              {saving ? "Saving..." : "Save Cost"}
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
