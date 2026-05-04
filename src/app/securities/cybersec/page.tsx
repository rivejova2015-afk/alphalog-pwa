import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SyllabusPanel } from "@/components/securities/cybersec/SyllabusPanel.client";

export default async function CyberSecPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#a78bfa]">AlphaLog Securities</p>
        <h1 className="text-3xl font-bold text-[#e2e8f0] font-mono">CyberSec Academy</h1>
        <p className="text-sm text-[#94a3b8]">
          58 módulos · 12 lecciones · 12 quizzes · 7 prácticas · 10 homework · 1 examen final
        </p>
      </header>
      <SyllabusPanel />
    </div>
  );
}
