// src/components/business/BusinessTabs.client.tsx
"use client";

import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  TrendingUp,
  Clock,
  Map,
  BookOpen,
  Flag,
  Building2,
  BookText,
  DollarSign,
} from "lucide-react";
import MobileModuleTabSelect from "@/components/navigation/MobileModuleTabSelect.client";
import HealthPanel from "./panels/HealthPanel.client";
import KPIPanel from "./panels/KPIPanel.client";
import PLPanel from "./panels/PLPanel.client";
import RunwayPanel from "./panels/RunwayPanel.client";
import RoadmapPanel from "./panels/RoadmapPanel.client";
import SOPsPanel from "./panels/SOPsPanel.client";
import DecisionsPanel from "./panels/DecisionsPanel.client";
import LLCPanel from "./panels/LLCPanel.client";
import JournalEntryForm from "@/app/components/JournalEntryForm";
import type { BusinessOfflineData } from "@/lib/business/offline-loader";

type TabId =
  | "health"
  | "kpis"
  | "pl"
  | "runway"
  | "roadmap"
  | "sops"
  | "decisions"
  | "llc"
  | "journal";

interface BusinessTabComponentProps {
  offlineData?: BusinessOfflineData | null;
  isReadOnly?: boolean;
  userId?: string;
}

interface TabItem {
  id: TabId;
  label: string;
  icon: ReactNode;
  component: ComponentType<BusinessTabComponentProps>;
  badge?: string;
}

const JournalTab = ({ userId }: BusinessTabComponentProps) => {
  if (!userId) {
    return (
      <div className="text-slate-300 bg-slate-900/50 border border-slate-800 rounded-lg p-6">
        Sign in to create journal entries.
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 rounded-lg p-6">
      <JournalEntryForm userId={userId} />
    </div>
  );
};

const tabs: TabItem[] = [
  {
    id: "health",
    label: "Health",
    icon: <Activity className="w-4 h-4" />,
    component: HealthPanel,
  },
  {
    id: "kpis",
    label: "KPIs",
    icon: <TrendingUp className="w-4 h-4" />,
    component: KPIPanel,
  },
  {
    id: "pl",
    label: "P&L",
    icon: <DollarSign className="w-4 h-4" />,
    component: PLPanel,
  },
  {
    id: "runway",
    label: "Runway",
    icon: <Clock className="w-4 h-4" />,
    component: RunwayPanel,
  },
  {
    id: "roadmap",
    label: "Roadmap",
    icon: <Map className="w-4 h-4" />,
    component: RoadmapPanel,
  },
  {
    id: "sops",
    label: "SOPs",
    icon: <BookOpen className="w-4 h-4" />,
    component: SOPsPanel,
  },
  {
    id: "decisions",
    label: "Decisions",
    icon: <Flag className="w-4 h-4" />,
    component: DecisionsPanel,
  },
  {
    id: "llc",
    label: "LLC",
    icon: <Building2 className="w-4 h-4" />,
    component: LLCPanel,
  },
  {
    id: "journal",
    label: "Journal",
    icon: <BookText className="w-4 h-4" />,
    component: JournalTab,
    badge: "New",
  },
];

interface BusinessTabsProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  offlineData?: BusinessOfflineData | null;
  isReadOnly?: boolean;
  userId?: string;
}

export default function BusinessTabs({
  activeTab,
  setActiveTab,
  offlineData,
  isReadOnly = false,
  userId,
}: BusinessTabsProps) {
  const currentTab = tabs.find((tab) => tab.id === activeTab);

  if (!currentTab) {
    return <div className="text-slate-400">Select a tab to continue.</div>;
  }

  const Component = currentTab.component;

  return (
    <div className="space-y-6">
      <MobileModuleTabSelect
        tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        ariaLabel="Selector de pestaña de Business"
      />

      <div className="hidden md:flex gap-2 mb-6 flex-wrap bg-slate-900 p-2 rounded-lg border border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded font-medium transition-colors relative ${
              activeTab === tab.id
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge && (
              <span className="px-2 py-0.5 text-xs bg-green-500 text-white rounded-full font-semibold">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="min-h-[600px]">
        <Component offlineData={offlineData} isReadOnly={isReadOnly} userId={userId} />
      </div>
    </div>
  );
}
