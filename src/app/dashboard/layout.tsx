"use client";

import OfflineBanner from "@/components/OfflineBanner.client";
import SafeModeBanner from "@/components/SafeModeBanner.client";
import { LiveAlphaLog } from "@/components/LiveAlphaLog.client";
import Sidebar from "@/components/navigation/Sidebar.client";
import MobileBottomNav from "@/components/navigation/MobileBottomNav.client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-slate-200">
      <SafeModeBanner />
      <OfflineBanner />
      <LiveAlphaLog />

      {/* Desktop: content left, sidebar right via CSS Grid */}
      <div className="md:grid md:grid-cols-[1fr_auto]">
        {/* Main content */}
        <main className="flex-1 animate-fade-rise pb-20 md:pb-0">
          {children}
        </main>

        {/* Right sidebar — desktop only (hidden on mobile via Sidebar component) */}
        <Sidebar />
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  );
}
