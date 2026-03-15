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
    <div className="min-h-screen text-slate-200">
      <header className="sticky top-0 z-10 border-b border-slate-700/60 bg-slate-900/80 shadow-[0_12px_30px_rgba(2,4,10,0.45)] backdrop-blur-xl md:ml-60">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="display-font text-3xl font-semibold text-slate-50">AlphaLog</h1>
              <p className="mt-1 text-sm text-slate-400">Trading & Analysis Platform</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-100">{user.email}</p>
                <p className="text-xs text-slate-400">Conectado</p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 md:ml-60">
        <div className="mb-10 rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-[0_24px_60px_rgba(2,4,10,0.5)] backdrop-blur animate-fade-rise">
          <h2 className="display-font text-2xl font-semibold text-slate-50">
            Bienvenido, {user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0]}
          </h2>
          <p className="mt-2 text-slate-400">
            Accede a tus herramientas de trading y analisis.
          </p>
        </div>

        <DashboardPerformancePanel metrics={metrics} />

        <footer className="mt-12 border-t border-slate-700/60 pt-6 text-center text-sm text-slate-400">
          <p>AlphaLog © 2024 | Trading & Analysis Platform</p>
          <p className="mt-2">Powered by Next.js, Supabase, and Tailwind CSS</p>
        </footer>
      </main>
    </div>
  );
}
