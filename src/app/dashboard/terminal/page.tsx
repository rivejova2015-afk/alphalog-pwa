// src/app/dashboard/terminal/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Radio, Calendar, BarChart3, Search, Zap, TrendingUp, TrendingDown, Minus, RefreshCw, Bot } from "lucide-react";
import NewsPanel from "@/components/terminal/NewsPanel.client";
import CalendarPanel from "@/components/terminal/CalendarPanel.client";
import EvidenceReports from "@/components/terminal/EvidenceReports.client";
import TerminalReportsBot from "@/components/terminal/TerminalReportsBot.client";
import { AssistantPanel } from "@/components/terminal/AssistantPanel.client";
import BackToDashboardButton from "@/components/BackToDashboardButton.client";
import MobileModuleTabSelect from "@/components/navigation/MobileModuleTabSelect.client";
import { createClient } from "@/lib/supabase/browser";

type TerminalTabType = "news" | "calendar" | "evidence" | "search" | "overview" | "assistant";

interface TerminalTab {
  id: TerminalTabType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TerminalTab[] = [
  { id: "overview", label: "Overview", icon: <Zap className="w-4 h-4" />, description: "Resumen del mercado" },
  { id: "assistant", label: "Asistente", icon: <Bot className="w-4 h-4" />, description: "Chat con IA financiera" },
  { id: "news", label: "News", icon: <Radio className="w-4 h-4" />, description: "Noticias e instrumentos" },
  { id: "calendar", label: "Calendar", icon: <Calendar className="w-4 h-4" />, description: "Calendario economico" },
  { id: "evidence", label: "Evidence", icon: <BarChart3 className="w-4 h-4" />, description: "Analisis con IA" },
  { id: "search", label: "Search", icon: <Search className="w-4 h-4" />, description: "Buscar en el mercado" },
];

type OverviewReport = {
  id: string;
  title: string;
  created_at: string;
  instrument_id: string | null;
};

type OverviewStats = {
  newsCount: number;
  eventsCount: number;
  reportsCount: number;
  latestReports: OverviewReport[];
  loading: boolean;
};

function SentimentBadge({ label }: { label: string }) {
  if (label.includes("Buy") || label.includes("Bullish")) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-900/50 border border-emerald-700/60 text-emerald-300 text-xs font-medium">
        <TrendingUp className="w-3 h-3" /> Bullish
      </span>
    );
  }
  if (label.includes("Sell") || label.includes("Bearish")) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-900/50 border border-red-700/60 text-red-300 text-xs font-medium">
        <TrendingDown className="w-3 h-3" /> Bearish
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-medium">
      <Minus className="w-3 h-3" /> Neutral
    </span>
  );
}

function TerminalOverview({ stats, onRefresh }: { stats: OverviewStats; onRefresh: () => void }) {
  if (stats.loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  const hasData = stats.newsCount > 0 || stats.eventsCount > 0 || stats.reportsCount > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5">
          <p className="text-xs text-slate-400 mb-1">Noticias rastreadas</p>
          <p className="text-2xl font-semibold text-slate-100">{stats.newsCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5">
          <p className="text-xs text-slate-400 mb-1">Eventos economicos</p>
          <p className="text-2xl font-semibold text-slate-100">{stats.eventsCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5">
          <p className="text-xs text-slate-400 mb-1">Reportes generados</p>
          <p className="text-2xl font-semibold text-slate-100">{stats.reportsCount}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-[0_18px_40px_rgba(2,4,10,0.45)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-100">Ultimos reportes</h3>
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg hover:bg-slate-800/70 text-slate-400 transition"
            title="Refrescar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {!hasData ? (
          <div className="text-center py-8">
            <BarChart3 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              Sin datos aun. Genera un reporte en la tab Evidence para comenzar.
            </p>
          </div>
        ) : stats.latestReports.length === 0 ? (
          <p className="text-sm text-slate-400">No hay reportes generados todavia.</p>
        ) : (
          <div className="space-y-3">
            {stats.latestReports.map((report) => {
              const titleText = report.title;
              const sentimentMatch = titleText.match(/sentiment_label:\s*(\w+)/);
              const sentimentLabel = sentimentMatch?.[1] ?? "";
              const displayTitle = titleText.replace(/\s*\[IA\]/, "").split(" - ")[0] || titleText;

              return (
                <div
                  key={report.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-950/50 border border-slate-700/50 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-100 font-medium truncate">{displayTitle}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(report.created_at).toLocaleDateString("es-PR", {
                        timeZone: "America/Puerto_Rico",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {sentimentLabel && <SentimentBadge label={sentimentLabel} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TerminalPage() {
  const [activeTab, setActiveTab] = useState<TerminalTabType>("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [stats, setStats] = useState<OverviewStats>({
    newsCount: 0,
    eventsCount: 0,
    reportsCount: 0,
    latestReports: [],
    loading: true,
  });

  const fetchOverview = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [news, events, reports, latestReports] = await Promise.all([
        supabase.from("terminal_news").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
        supabase.from("terminal_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
        supabase.from("terminal_evidence_reports").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
        supabase.from("terminal_evidence_reports").select("id, title, created_at, instrument_id").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
      ]);

      setStats({
        newsCount: news.count ?? 0,
        eventsCount: events.count ?? 0,
        reportsCount: reports.count ?? 0,
        latestReports: (latestReports.data ?? []) as OverviewReport[],
        loading: false,
      });
    } catch {
      setStats((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

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
            {activeTab === "overview" && (
              <TerminalOverview stats={stats} onRefresh={fetchOverview} />
            )}
            {activeTab === "assistant" && (
              <div className="h-[calc(100vh-200px)] min-h-[500px]">
                <AssistantPanel />
              </div>
            )}
            {activeTab === "news" && <NewsPanel />}
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
                <h3 className="text-slate-200 font-medium">Busqueda de mercado</h3>
                <p className="text-slate-400 text-sm">Proximamente</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
