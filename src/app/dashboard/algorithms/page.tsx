import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Bot } from "lucide-react";
import AlgorithmsHub from "@/components/algorithms/AlgorithmsHub.client";

export const dynamic = "force-dynamic";

export default async function AlgorithmsPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth");

  return (
    <div className="min-h-screen text-slate-200">
      <header className="sticky top-0 z-10 border-b border-slate-700/60 bg-slate-900/80 shadow-[0_12px_30px_rgba(2,4,10,0.45)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800 border border-slate-700">
              <Bot className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100 leading-tight">Algoritmos de Trading</h1>
              <p className="text-xs text-slate-500">Diseña, prueba y despliega estrategias en MT5 y MT4 — hasta 50 por plataforma</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AlgorithmsHub />
      </main>
    </div>
  );
}
