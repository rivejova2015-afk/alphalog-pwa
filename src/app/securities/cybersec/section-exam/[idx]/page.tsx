import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExamRunner } from "@/components/securities/cybersec/ExamRunner.client";
import { categoryByIndex, sectionBank, SECTION_EXAM_COUNT, EXAM_PASS_RATIO } from "@/lib/securities/cybersec";

export default async function SectionExamPage({ params }: { params: Promise<{ idx: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { idx } = await params;
  const category = categoryByIndex(Number(idx));
  if (!category) redirect("/securities/cybersec/path");
  const bank = sectionBank(category);
  if (bank.length === 0) redirect("/securities/cybersec/path");

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <ExamRunner questions={bank} passRatio={EXAM_PASS_RATIO} section={category} count={SECTION_EXAM_COUNT} />
    </div>
  );
}
