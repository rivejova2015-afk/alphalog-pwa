import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CertificationsView } from "@/components/securities/cybersec/CertificationsView.client";

export const metadata = {
  title: "Certificaciones · CyberSec Academy",
  description: "Roadmap de certificaciones de ciberseguridad por rama, de nivel inicial a experto.",
};

export default async function CertificacionesPage({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { track } = await searchParams;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <CertificationsView initialTrack={track} />
    </div>
  );
}
