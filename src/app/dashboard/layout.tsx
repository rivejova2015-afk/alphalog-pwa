"use client";

import OfflineBanner from "@/components/OfflineBanner.client";
import SafeModeBanner from "@/components/SafeModeBanner.client";
import { LiveAlphaLog } from "@/components/LiveAlphaLog.client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "TradeHub", href: "/dashboard/tradehub", icon: "🎯" },
  { label: "Terminal", href: "/dashboard/terminal", icon: "💹" },
  { label: "Journal PT", href: "/dashboard/logs", icon: "📓" },
  { label: "TraderMap", href: "/dashboard/tradermap", icon: "🗺️" },
  { label: "Treasury", href: "/dashboard/treasury", icon: "💰" },
  { label: "Business", href: "/dashboard/business", icon: "💼" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen text-slate-700">
      <SafeModeBanner />
      <OfflineBanner />
      <LiveAlphaLog />

      {/* Mobile menu toggle */}
      <div className="fixed left-0 top-0 z-40 flex md:hidden items-center gap-2 px-4 py-3 bg-white/70 backdrop-blur-xl border-b border-white/60 shadow-sm">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white/70 transition"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <span className="text-base font-semibold tracking-tight text-slate-900">AlphaLog</span>
      </div>

      {/* Sidebar - Desktop visible (md+), Mobile overlay */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed left-0 top-0 z-30 h-full w-60 bg-white/75 border-r border-white/60 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform duration-300 md:translate-x-0 md:relative md:z-0 pt-16 md:pt-6 overflow-y-auto`}
      >
        <nav className="space-y-1 px-4 pb-6">
          <div className="hidden md:block px-2 pb-4">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">AlphaLog</div>
          </div>
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-900 hover:shadow-sm"
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/20 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-0">
        <div className="md:hidden h-16" /> {/* Spacer for mobile header */}
        {children}
      </main>
    </div>
  );
}

