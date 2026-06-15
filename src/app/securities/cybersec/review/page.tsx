import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewSession } from "@/components/securities/cybersec/ReviewSession.client";

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="max-w-xl mx-auto py-6 px-4">
      <ReviewSession />
    </div>
  );
}
