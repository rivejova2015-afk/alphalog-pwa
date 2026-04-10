"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  Building2,
  Flame,
  LayoutDashboard,
  Mail,
} from "lucide-react";

const items = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Intel", href: "/intelligence", icon: Brain },
  { label: "Business", href: "/business", icon: Building2 },
  { label: "Map Hot", href: "/map-hot", icon: Flame },
  { label: "Inbox", href: "/inbox", icon: Mail },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex md:hidden items-center justify-around border-t border-slate-700/50 bg-slate-900/90 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-2 py-2.5 text-[10px] font-medium transition-colors ${
              isActive ? "text-cyan-400" : "text-slate-500"
            }`}
          >
            <Icon size={20} />
            <span>{item.label}</span>
            {isActive && (
              <span className="absolute top-0 h-0.5 w-8 rounded-b bg-cyan-400 shadow-[0_0_6px_rgba(0,229,255,0.4)]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
