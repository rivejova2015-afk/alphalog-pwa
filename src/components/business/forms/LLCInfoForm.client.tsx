// src/components/business/forms/LLCInfoForm.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { upsertLLCInfo } from "@/lib/business/queries";
import { createClient } from "@/lib/supabase/browser";

interface LLCInfoFormProps {
  onClose: () => void;
  onSave: () => void;
}

export default function LLCInfoForm({ onClose, onSave }: LLCInfoFormProps) {
  const supabase = createClient();
  const [formData, setFormData] = useState({
    llc_name: "",
    formation_date: "",
    annual_report_due_month: 1,
    annual_fee_baseline: 0,
    registered_agent_name: "",
    ein: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    try {
      setError("");
      setSaving(true);

      if (!formData.llc_name || !formData.ein) {
        setError("Please fill in LLC name and EIN");
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

      // Basic EIN validation (9 digits, no hyphens)
      const einClean = formData.ein.replace(/-/g, "");
      if (!/^\d{9}$/.test(einClean)) {
        setError("EIN must be 9 digits");
        return;
      }

      await upsertLLCInfo({
        user_id: user.id,
        llc_name: formData.llc_name,
        formation_date: formData.formation_date || null,
        annual_report_due_month: formData.annual_report_due_month,
        annual_fee_baseline: formData.annual_fee_baseline,
        registered_agent_name: formData.registered_agent_name || "",
        ein: einClean,
        notes: formData.notes || null,
      });

      onSave();
    } catch (err) {
      console.error("Error saving LLC info:", err);
      setError("Failed to save LLC information");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-slate-900 border-slate-800 w-96 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-white">LLC Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-300 mb-2">LLC Name *</label>
            <input
              type="text"
              value={formData.llc_name}
              onChange={(e) => setFormData({ ...formData, llc_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              placeholder="Your LLC name"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">EIN (9 digits) *</label>
            <input
              type="text"
              value={formData.ein}
              onChange={(e) => {
                // Allow user to type with hyphens, we clean it on save
                const val = e.target.value.replace(/-/g, "");
                setFormData({ ...formData, ein: val });
              }}
              maxLength={11}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white font-mono"
              placeholder="123456789"
            />
            <p className="text-xs text-slate-400 mt-1">Format: 9 digits (e.g., 123456789)</p>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Formation Date</label>
            <input
              type="date"
              value={formData.formation_date}
              onChange={(e) => setFormData({ ...formData, formation_date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Annual Report Due Month</label>
            <select
              value={formData.annual_report_due_month}
              onChange={(e) => setFormData({ ...formData, annual_report_due_month: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const monthNames = [
                  "January",
                  "February",
                  "March",
                  "April",
                  "May",
                  "June",
                  "July",
                  "August",
                  "September",
                  "October",
                  "November",
                  "December",
                ];
                return (
                  <option key={i + 1} value={i + 1}>
                    {monthNames[i]}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Annual Fee Baseline</label>
            <input
              type="number"
              step="0.01"
              value={formData.annual_fee_baseline}
              onChange={(e) =>
                setFormData({ ...formData, annual_fee_baseline: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Registered Agent Name</label>
            <input
              type="text"
              value={formData.registered_agent_name}
              onChange={(e) => setFormData({ ...formData, registered_agent_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              placeholder="Name of your registered agent"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white h-20 resize-none"
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded font-medium"
            >
              {saving ? "Saving..." : "Save LLC Info"}
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
