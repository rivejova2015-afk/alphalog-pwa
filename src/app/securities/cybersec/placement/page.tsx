import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlacementTest } from "@/components/securities/cybersec/PlacementTest.client";

export default async function PlacementPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <PlacementTest />
    </div>
  );
}
