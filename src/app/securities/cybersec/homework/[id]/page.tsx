import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHomework } from "@/lib/securities/cybersec";
import { HomeworkDetail } from "@/components/securities/cybersec/HomeworkDetail.client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HomeworkDetailPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { id } = await params;
  const hwId = Number.parseInt(id, 10);
  if (!Number.isFinite(hwId)) notFound();

  const hw = getHomework(hwId);
  if (!hw) notFound();

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <HomeworkDetail homework={hw} />
    </div>
  );
}
