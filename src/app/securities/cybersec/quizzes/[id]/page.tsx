import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getQuiz, getLesson } from "@/lib/securities/cybersec";
import { QuizRunner } from "@/components/securities/cybersec/QuizRunner.client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function QuizPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { id } = await params;
  const lessonId = Number.parseInt(id, 10);
  if (!Number.isFinite(lessonId)) notFound();

  const quiz = getQuiz(lessonId);
  const lesson = getLesson(lessonId);
  if (!quiz || !lesson) notFound();

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <QuizRunner lessonId={lessonId} lessonTitle={lesson.title} questions={quiz} />
    </div>
  );
}
