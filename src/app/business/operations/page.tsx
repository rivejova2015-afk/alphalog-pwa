"use client";

import { useState } from "react";
import BusinessTabs from "@/components/business/BusinessTabs.client";

const DEFAULT_TAB = "health" as const;
type TabId = typeof DEFAULT_TAB | "kpis" | "pl" | "runway" | "roadmap" | "sops" | "decisions" | "llc" | "journal";

export default function BusinessOperationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB);
  return <BusinessTabs activeTab={activeTab} setActiveTab={setActiveTab} />;
}
