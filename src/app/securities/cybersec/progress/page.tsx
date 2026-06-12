import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProgressHub } from "@/components/securities/cybersec/ProgressHub.client";

export default async function ProgressPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <ProgressHub />
    </div>
  );
}
