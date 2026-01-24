// src/app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
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

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 shadow-sm sticky top-0 z-10 md:ml-56">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-50">AlphaLog</h1>
              <p className="mt-1 text-sm text-slate-400">Trading & Analysis Platform</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-50">{user.email}</p>
                <p className="text-xs text-slate-400">Conectado</p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 md:ml-56">
        {/* Welcome Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-50">
            Bienvenido, {user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0]}
          </h2>
          <p className="mt-2 text-slate-400">
            Accede a tus herramientas de trading y análisis.
          </p>
        </div>

        {/* Dashboard Performance Panel */}
        <DashboardPerformancePanel groups={groups} metrics={metrics} />

        {/* Footer */}
        <footer className="mt-12 border-t border-slate-800 pt-8 text-center text-sm text-slate-400">
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
