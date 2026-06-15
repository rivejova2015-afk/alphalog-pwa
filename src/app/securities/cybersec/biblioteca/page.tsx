import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LibraryView } from "@/components/securities/cybersec/LibraryView.client";

export const metadata = {
  title: "Biblioteca · CyberSec Academy",
  description: "Libros y recursos de ciberseguridad y programación en español.",
};

export default async function BibliotecaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <LibraryView />
    </div>
  );
}
