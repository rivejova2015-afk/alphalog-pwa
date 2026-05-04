import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLesson, getQuiz } from "@/lib/securities/cybersec";
import { LessonViewer } from "@/components/securities/cybersec/LessonViewer.client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LessonPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { id } = await params;
  const lessonId = Number.parseInt(id, 10);
  if (!Number.isFinite(lessonId)) notFound();

  const lesson = getLesson(lessonId);
  if (!lesson) notFound();

  const hasQuiz = Boolean(getQuiz(lessonId));

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <LessonViewer lesson={lesson} hasQuiz={hasQuiz} />
    </div>
  );
}
