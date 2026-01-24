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
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <SafeModeBanner />
      <OfflineBanner />
      <LiveAlphaLog />

      {/* Mobile menu toggle */}
      <div className="fixed left-0 top-0 z-40 flex md:hidden items-center gap-2 p-4 bg-slate-900">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded hover:bg-slate-800 transition"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <span className="text-lg font-bold">AlphaLog</span>
      </div>

      {/* Sidebar - Desktop visible (md+), Mobile overlay */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed left-0 top-0 z-30 h-full w-56 bg-slate-900 border-r border-slate-800 transition-transform duration-300 md:translate-x-0 md:relative md:z-0 pt-16 md:pt-0 overflow-y-auto`}
      >
        <nav className="space-y-1 p-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition hover:bg-slate-800 active:bg-slate-700"
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
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
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

