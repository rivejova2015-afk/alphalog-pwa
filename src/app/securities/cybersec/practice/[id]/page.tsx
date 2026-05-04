import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPractice } from "@/lib/securities/cybersec";
import { PracticeRunner } from "@/components/securities/cybersec/PracticeRunner.client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PracticePage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { id } = await params;
  const practiceId = Number.parseInt(id, 10);
  if (!Number.isFinite(practiceId)) notFound();

  const practice = getPractice(practiceId);
  if (!practice) notFound();

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <PracticeRunner practice={practice} />
    </div>
  );
}
