"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  TrendingUp,
  Target,
  Puzzle,
  Brain,
  BookOpen,
} from "lucide-react";

const sections = [
  {
    label: "Agents",
    items: [
      { label: "Agents Dashboard", href: "/intelligence/agents", icon: Bot },
      { label: "Algo Trading", href: "/intelligence/algo-trading", icon: TrendingUp },
    ],
  },
  {
    label: "Analysis",
    items: [
      { label: "Capital Levels", href: "/intelligence/capital-levels", icon: Target },
      { label: "Constraint Solver", href: "/intelligence/constraint-solver", icon: Puzzle },
      { label: "MindOps", href: "/intelligence/mindops", icon: Brain },
      { label: "Knowledge Factory", href: "/intelligence/knowledge-factory", icon: BookOpen },
    ],
  },
];

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="premium-frame">
      <h1 className="text-3xl font-semibold text-cyan-400 mb-4">Intelligence Suite</h1>

      {/* Sub-navigation */}
      <nav className="mb-6 space-y-3">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5 px-1">
              {section.label}
            </p>
            <div className="flex flex-wrap gap-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
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
            </div>
          </div>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  );
}
