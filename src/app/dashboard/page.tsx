// src/app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import DashboardPerformancePanel from "@/components/dashboard/DashboardPerformancePanel";
import { getAccountGroups, getPerformanceMetrics } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/auth");
  }

  const user = data.user;
  const userId = user.id;

  const [groups, metrics] = await Promise.all([
    getAccountGroups(userId),
    getPerformanceMetrics(userId),
  ]);

  return (
    <div className="min-h-screen text-slate-700">
      <header className="sticky top-0 z-10 border-b border-white/70 bg-white/70 shadow-sm backdrop-blur-xl md:ml-60">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">AlphaLog</h1>
              <p className="mt-1 text-sm text-slate-500">Trading & Analysis Platform</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{user.email}</p>
                <p className="text-xs text-slate-500">Conectado</p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 md:ml-60">
        <div className="mb-10 rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="text-2xl font-semibold text-slate-900">
            Bienvenido, {user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0]}
          </h2>
          <p className="mt-2 text-slate-500">
            Accede a tus herramientas de trading y analisis.
          </p>
        </div>

        <DashboardPerformancePanel groups={groups} metrics={metrics} />

        <footer className="mt-12 border-t border-white/70 pt-6 text-center text-sm text-slate-500">
          <p>AlphaLog © 2024 | Trading & Analysis Platform</p>
          <p className="mt-2">Powered by Next.js, Supabase, and Tailwind CSS</p>
        </footer>
      </main>
    </div>
  );
}
