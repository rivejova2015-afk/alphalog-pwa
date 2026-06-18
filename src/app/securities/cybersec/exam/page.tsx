import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EXAM, EXAM_PASS_RATIO, nextPendingLesson } from "@/lib/securities/cybersec";
import { ExamRunner } from "@/components/securities/cybersec/ExamRunner.client";

export default async function ExamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  // Próxima lección pendiente (global) para el botón "Continuar →" al aprobar.
  const { data: takenRows } = await supabase
    .from("securities_quiz_results")
    .select("lesson_id")
    .eq("user_id", user.id);
  const takenIds = new Set<number>((takenRows ?? []).map((r) => r.lesson_id as number));
  const nextLesson = nextPendingLesson(-1, takenIds);

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <ExamRunner
        questions={EXAM}
        passRatio={EXAM_PASS_RATIO}
        nextLessonId={nextLesson?.id ?? null}
        nextLessonTitle={nextLesson?.title ?? null}
      />
    </div>
  );
}
