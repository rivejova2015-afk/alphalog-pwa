import { redirect } from "next/navigation";
import Link from "next/link";
import { Layers } from "lucide-react";
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
          62 módulos · 62 lecciones · 62 quizzes · 15 prácticas · 18 homework · 45 flashcards · 1 examen final · Doctorate Track
        </p>
        <Link
          href="/securities/cybersec/flashcards"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-[#22d3ee]/10 border border-[#22d3ee]/40 text-[#22d3ee] hover:bg-[#22d3ee]/20"
        >
          <Layers size={14} /> Repasar con flashcards
        </Link>
      </header>
      <SyllabusPanel />
    </div>
  );
}
