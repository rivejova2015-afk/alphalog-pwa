import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PathMap } from "@/components/securities/cybersec/PathMap.client";

export default async function PathPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <PathMap />
    </div>
  );
}
