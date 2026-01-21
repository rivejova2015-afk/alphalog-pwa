// src/app/dashboard/layout.tsx
import OfflineBanner from "@/components/OfflineBanner.client";
import SafeModeBanner from "@/components/SafeModeBanner.client";
import { LiveAlphaLog } from "@/components/LiveAlphaLog.client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-900">
      <SafeModeBanner />
      <OfflineBanner />
      <LiveAlphaLog />
      {children}
    </div>
  );
}

