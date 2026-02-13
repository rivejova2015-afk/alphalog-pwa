"use client";

import OfflineBanner from "@/components/OfflineBanner.client";
import SafeModeBanner from "@/components/SafeModeBanner.client";
import { LiveAlphaLog } from "@/components/LiveAlphaLog.client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

const menuItems = [
  { label: "Trading", href: "/trading", icon: "🎯" },
  { label: "Business", href: "/business", icon: "💼" },
  { label: "Intelligence", href: "/intelligence", icon: "🧠" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen text-slate-200">
      <SafeModeBanner />
      <OfflineBanner />
      <LiveAlphaLog />

      {/* Mobile menu toggle */}
      <div className="app-glass-surface fixed left-0 right-0 top-0 z-40 flex md:hidden items-center gap-2 px-4 py-3 bg-slate-900/75 border-b border-slate-700/60 shadow-[0_12px_30px_rgba(2,4,10,0.45)]">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Cerrar menu" : "Abrir menu"}
          className="p-2 rounded-lg text-slate-300 hover:text-slate-50 hover:bg-slate-800/70 transition"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <span className="display-font text-base font-semibold tracking-[0.2em] text-slate-100 uppercase">
          AlphaLog
        </span>
      </div>

      {/* Sidebar - Desktop visible (md+), Mobile overlay */}
      <aside
        className={`app-glass-surface ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed left-0 top-0 z-30 h-full w-60 bg-slate-900/80 border-r border-slate-800/80 shadow-[0_18px_40px_rgba(2,4,10,0.6)] transition-transform duration-300 md:translate-x-0 md:relative md:z-0 pt-16 md:pt-6 overflow-y-auto`}
      >
        <nav className="space-y-1 px-4 pb-6 stagger-fade">
          <div className="hidden md:block px-2 pb-4">
            <div className="display-font text-xs uppercase tracking-[0.4em] text-slate-400">
              AlphaLog
            </div>
          </div>
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800/70 hover:text-slate-50 hover:shadow-[0_10px_24px_rgba(2,4,10,0.4)]"
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
          className="fixed inset-0 z-20 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-0 animate-fade-rise">
        <div className="md:hidden h-16" /> {/* Spacer for mobile header */}
        {children}
      </main>
    </div>
  );
}
