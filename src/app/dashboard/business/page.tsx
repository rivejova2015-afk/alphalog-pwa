// src/app/dashboard/business/page.tsx
"use client";

import { useState } from "react";
import { Briefcase, ChevronLeft } from "lucide-react";
import Link from "next/link";
import BusinessTabs from "@/components/business/BusinessTabs.client";

export default function BusinessPage() {
  const [activeTab, setActiveTab] = useState<
    "health" | "kpis" | "pl" | "runway" | "roadmap" | "sops" | "decisions" | "llc" | "journal"
  >("health");

  return (
    <div className="min-h-screen text-slate-200">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-[0_20px_50px_rgba(2,4,10,0.45)] backdrop-blur">
          <Link href="/dashboard">
            <button className="text-slate-400 hover:text-slate-200 flex items-center gap-2 mb-4 text-sm">
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/60 border border-slate-700/60 shadow-sm">
              <Briefcase className="w-6 h-6 text-slate-200" />
            </div>
            <div>
              <h1 className="display-font text-3xl font-semibold text-slate-50">Business</h1>
              <p className="text-slate-400 text-sm mt-1">
                Trading business management: finances, KPIs, SOPs, and strategic decisions
              </p>
            </div>
          </div>
        </div>

        {/* Tabs Component */}
        <BusinessTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}
