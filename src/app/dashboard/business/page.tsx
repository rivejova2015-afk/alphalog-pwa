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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard">
            <button className="text-slate-400 hover:text-slate-200 flex items-center gap-2 mb-4 text-sm">
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-indigo-400" />
            <div>
              <h1 className="text-4xl font-bold text-white">Business</h1>
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
