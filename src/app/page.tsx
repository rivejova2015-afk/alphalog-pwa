import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { SelectorDashboard } from "@/components/home/SelectorDashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      redirect("/auth");
    }
  } catch {
    redirect("/auth");
  }

  return (
    <MainLayout>
      <SelectorDashboard />
    </MainLayout>
  );
}
