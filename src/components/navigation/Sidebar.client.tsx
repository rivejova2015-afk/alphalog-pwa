"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  Building2,
  ChevronLeft,
  ChevronRight,
  Flame,
  LayoutDashboard,
  Mail,
} from "lucide-react";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Intelligence", href: "/intelligence", icon: Brain },
  { label: "Business", href: "/business", icon: Building2 },
  { label: "Map Hot", href: "/map", icon: Flame },
  { label: "Inbox", href: "/inbox", icon: Mail },
];

const COLLAPSE_KEY = "al-sidebar-collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      // SSR or localStorage unavailable
    }
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <aside
      className={`hidden md:flex flex-col h-screen sticky top-0 border-l border-slate-700/50 bg-slate-900/60 transition-all duration-300 ${
        collapsed ? "w-16" : "w-[280px]"
      }`}
    >
      {/* Header */}
      <div className={`flex items-center border-b border-slate-700/40 px-4 py-5 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400/80">
            AlphaLog
          </span>
        )}
        <button
          type="button"
          onClick={toggleCollapse}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-cyan-400/10 text-cyan-400"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Icon size={18} className={isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"} />
              {!collapsed && <span>{item.label}</span>}

              {/* Active indicator bar on right edge */}
              {isActive && (
                <span className="absolute right-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-l bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.4)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-slate-700/40 px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-600">
            v2.0
          </p>
        </div>
      )}
    </aside>
  );
}
