"use client";
import { useState } from "react";
import BusinessTabs from '@/components/business/BusinessTabs.client';

// Debe coincidir con el tipo TabId definido en BusinessTabs.client.tsx
const DEFAULT_TAB = "health" as const;
type TabId = typeof DEFAULT_TAB | "kpis" | "pl" | "runway" | "roadmap" | "sops" | "decisions" | "llc" | "journal";

export default function BusinessTab() {
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB);
  return <BusinessTabs activeTab={activeTab} setActiveTab={setActiveTab} />;
}
