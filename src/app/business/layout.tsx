"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Wallet,
  BarChart3,
  Scale,
  BookOpen,
  LineChart,
  ClipboardList,
} from "lucide-react";

const navItems = [
  { label: "Treasury", href: "/business/treasury", icon: Wallet },
  { label: "Operations", href: "/business/operations", icon: BarChart3 },
  { label: "Decisions", href: "/business/decisions", icon: Scale },
  { label: "Journal", href: "/business/journal", icon: BookOpen },
  { label: "KPIs", href: "/business/kpis", icon: LineChart },
  { label: "SOPs", href: "/business/sops", icon: ClipboardList },
];

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="premium-frame">
      <h1 className="text-3xl font-semibold text-cyan-400 mb-4">Business Hub</h1>

      <nav className="mb-6 flex flex-wrap gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/business/treasury"
              ? pathname === "/business/treasury" || pathname.startsWith("/business/tabs/treasury")
              : item.href === "/business/operations"
                ? pathname === "/business/operations" || pathname.startsWith("/business/tabs/business")
                : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-cyan-400/10 text-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.08)]"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
