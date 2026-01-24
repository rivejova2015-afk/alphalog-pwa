// src/app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import ModulesStatus from "@/components/dashboard/ModulesStatus.client";
import DashboardPerformancePanel from "@/components/dashboard/DashboardPerformancePanel";
import { getAccountGroups, getPerformanceMetrics } from "@/lib/dashboard/queries";

// Marca la página como dinámica porque accede a cookies (Supabase auth)
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    // No hay sesión, redirige a login
    redirect("/auth");
  }

  const user = data.user;
  const userId = user.id;

  // Get dashboard data
  const [groups, metrics] = await Promise.all([
    getAccountGroups(userId),
    getPerformanceMetrics(userId),
  ]);

  // Menú de navegación
  const menuItems = [
    { label: "TradeHub", href: "/dashboard/tradehub", icon: "📊" },
    { label: "Terminal", href: "/dashboard/terminal", icon: "💹" },
    { label: "Journal PT", href: "/dashboard/logs", icon: "📓" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AlphaLog</h1>
              <p className="mt-1 text-sm text-gray-500">Trading & Analysis Platform</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.email}</p>
                <p className="text-xs text-gray-500">Conectado</p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900">
            Bienvenido, {user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0]}
          </h2>
          <p className="mt-2 text-gray-600">
            Accede a tus herramientas de trading y análisis.
          </p>
        </div>

        {/* Dashboard Performance Panel */}
        <DashboardPerformancePanel groups={groups} metrics={metrics} />

        {/* Modules Status Panel */}
        <div className="mt-12 rounded-lg bg-white p-6 shadow-sm sm:p-8">
          <ModulesStatus />
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t pt-8 text-center text-sm text-gray-600">
          <p>
            AlphaLog © 2024 | Trading & Analysis Platform
          </p>
          <p className="mt-2">
            Powered by Next.js, Supabase, and Tailwind CSS
          </p>
        </footer>
      </main>
    </div>
  );
}
