import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EXAM, EXAM_PASS_RATIO } from "@/lib/securities/cybersec";
import { ExamRunner } from "@/components/securities/cybersec/ExamRunner.client";

export default async function ExamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <ExamRunner questions={EXAM} passRatio={EXAM_PASS_RATIO} />
    </div>
  );
}
