// src/app/dashboard/terminal/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Radio, Calendar, BarChart3, Search, Zap } from "lucide-react";
import { clusterStories, NewsItem } from '@/lib/terminal-ia/storyClustering';
import { buildImpactMatrix, ImpactMatrixRow } from '@/lib/terminal-ia/impactMatrix';
import NewsPanel from "@/components/terminal/NewsPanel.client";
import CalendarPanel from "@/components/terminal/CalendarPanel.client";
import EvidenceReports from "@/components/terminal/EvidenceReports.client";
import TerminalReportsBot from "@/components/terminal/TerminalReportsBot.client";
import BackToDashboardButton from "@/components/BackToDashboardButton.client";
import MobileModuleTabSelect from "@/components/navigation/MobileModuleTabSelect.client";
import { createClient } from "@/lib/supabase/browser";

type TerminalTabType = "news" | "calendar" | "evidence" | "search" | "overview";

interface TerminalTab {
  id: TerminalTabType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TerminalTab[] = [
  { id: "overview", label: "Overview", icon: <Zap className="w-4 h-4" />, description: "Market overview" },
  { id: "news", label: "News", icon: <Radio className="w-4 h-4" />, description: "Latest news & events" },
  { id: "calendar", label: "Calendar", icon: <Calendar className="w-4 h-4" />, description: "Economic calendar" },
  { id: "evidence", label: "Evidence", icon: <BarChart3 className="w-4 h-4" />, description: "AI-powered analysis" },
  { id: "search", label: "Search", icon: <Search className="w-4 h-4" />, description: "Market search" },
];

function TerminalOverview() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-[0_18px_40px_rgba(2,4,10,0.45)] backdrop-blur">
        <h3 className="display-font text-lg font-semibold text-slate-100 mb-2">Overview</h3>
        <p className="text-sm text-slate-400">
          Aún no hay datos suficientes para mostrar un resumen. Genera reportes o agrega noticias/eventos para ver métricas aquí.
        </p>
      </div>
    </div>
  );
}

export default function TerminalPage() {
    // Demo: fake news items
    const demoNews: NewsItem[] = [
      { id: '1', title: 'Fed raises rates', content: '...', topic: 'Fed', date: new Date() },
      { id: '2', title: 'ECB holds rates', content: '...', topic: 'ECB', date: new Date() },
      { id: '3', title: 'Fed signals pause', content: '...', topic: 'Fed', date: new Date() },
    ];
    const clusters = clusterStories(demoNews);
    const impactMatrix = buildImpactMatrix([
      { topic: 'Fed', impact: 'High', bias: 'Hawkish', confidence: 0.9 },
      { topic: 'ECB', impact: 'Medium', bias: 'Neutral', confidence: 0.7 },
    ]);
  const [activeTab, setActiveTab] = useState<TerminalTabType>("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (err) {
        console.error("[Terminal] Error getting user:", err);
      }
    };
    getUser();
  }, []);

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen text-slate-200 md:flex">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? "w-64" : "w-16"} hidden bg-slate-900/80 border-r border-slate-800/80 shadow-[0_18px_40px_rgba(2,4,10,0.6)] backdrop-blur-xl transition-all duration-300 md:flex md:flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
          {isSidebarOpen && <h2 className="display-font font-semibold text-slate-100">Terminal</h2>}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-800/70 text-slate-400 rounded-lg transition"
          >
            {isSidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                  activeTab === tab.id
                    ? "bg-slate-800 text-slate-50 shadow-[0_12px_24px_rgba(2,4,10,0.45)]"
                    : "text-slate-300 hover:bg-slate-800/70"
                }`}
                title={isSidebarOpen ? undefined : tab.label}
              >
                <span className="text-lg">{tab.icon}</span>
                {isSidebarOpen && <span className="flex-1 text-left text-sm">{tab.label}</span>}
              </button>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/60">
          {isSidebarOpen ? (
            <div className="text-xs text-slate-400">
              <div className="font-medium text-slate-200 mb-1">Market Terminal</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                <span>Live Data</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <header className="bg-slate-900/80 border-b border-slate-700/60 px-4 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between backdrop-blur-xl shadow-[0_12px_30px_rgba(2,4,10,0.45)]">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">📡</span>
              <h1 className="display-font text-2xl font-semibold text-slate-50">{currentTab?.label}</h1>
            </div>
            <p className="text-sm text-slate-400">{currentTab?.description}</p>
          </div>
          <BackToDashboardButton />
        </header>

        <div className="sticky top-0 z-20 border-b border-slate-700/60 bg-slate-900/90 px-4 py-3 md:hidden">
          <MobileModuleTabSelect
            tabs={TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as TerminalTabType)}
            ariaLabel="Selector de modulo Terminal"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === "overview" && <TerminalOverview />}
            {activeTab === "news" && <NewsPanel />}
                    {activeTab === "news" && (
                      <div className="mb-8">
                        <h3 className="text-lg font-semibold text-white mb-2">Story Clustering</h3>
                        <ul className="mb-4">
                          {clusters.map(cluster => (
                            <li key={cluster.topic} className="mb-2">
                              <span className="font-bold text-blue-300">{cluster.topic}</span>: {cluster.items.length} noticias
                            </li>
                          ))}
                        </ul>
                        <h3 className="text-lg font-semibold text-white mb-2">Impact Matrix</h3>
                        <table className="table-mobile-cards w-full text-xs text-slate-200">
                          <thead>
                            <tr>
                              <th>Tema</th><th>Impacto</th><th>Sesgo</th><th>Confianza</th>
                            </tr>
                          </thead>
                          <tbody>
                            {impactMatrix.map(row => (
                              <tr key={row.topic}>
                                <td data-label="Tema">{row.topic}</td>
                                <td data-label="Impacto">{row.impact}</td>
                                <td data-label="Sesgo">{row.bias}</td>
                                <td data-label="Confianza">{(row.confidence*100).toFixed(0)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
            {activeTab === "calendar" && <CalendarPanel />}
            {activeTab === "evidence" && (
              <div className="space-y-6">
                <TerminalReportsBot />
                <EvidenceReports />
              </div>
            )}
            {activeTab === "search" && (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-slate-200 font-medium">Search Markets</h3>
                <p className="text-slate-400 text-sm">Coming soon</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
