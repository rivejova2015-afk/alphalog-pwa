import { redirect } from "next/navigation";
import Link from "next/link";
import { Layers, LineChart, Map, Zap, Search, Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SyllabusPanel } from "@/components/securities/cybersec/SyllabusPanel.client";

export default async function CyberSecPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#a78bfa]">AlphaLog Securities</p>
        <h1 className="text-3xl font-bold text-[#e2e8f0] font-mono">CyberSec Academy</h1>
        <p className="text-sm text-[#94a3b8]">
          82 módulos · 82 lecciones · 82 quizzes · 15 prácticas · 18 homework · 45 flashcards · 1 examen final · Doctorate Track completo
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/securities/cybersec/path"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-[#eab308]/10 border border-[#eab308]/40 text-[#eab308] hover:bg-[#eab308]/20"
          >
            <Map size={14} /> Mi camino
          </Link>
          <Link
            href="/securities/cybersec/progress"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-[#a78bfa]/10 border border-[#a78bfa]/40 text-[#a78bfa] hover:bg-[#a78bfa]/20"
          >
            <LineChart size={14} /> Mi progreso
          </Link>
          <Link
            href="/securities/cybersec/placement"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-[#a78bfa]/10 border border-[#a78bfa]/40 text-[#a78bfa] hover:bg-[#a78bfa]/20"
          >
            <Compass size={14} /> Nivelación
          </Link>
          <Link
            href="/securities/cybersec/search"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-[#1f2937] border border-[#334155] text-[#e2e8f0] hover:bg-[#151b28]"
          >
            <Search size={14} /> Buscar
          </Link>
          <Link
            href="/securities/cybersec/review"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-[#34d399]/10 border border-[#34d399]/40 text-[#34d399] hover:bg-[#34d399]/20"
          >
            <Zap size={14} /> Repaso diario
          </Link>
          <Link
            href="/securities/cybersec/flashcards"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-[#22d3ee]/10 border border-[#22d3ee]/40 text-[#22d3ee] hover:bg-[#22d3ee]/20"
          >
            <Layers size={14} /> Explorar flashcards
          </Link>
        </div>
      </header>
      <SyllabusPanel />
    </div>
  );
}
