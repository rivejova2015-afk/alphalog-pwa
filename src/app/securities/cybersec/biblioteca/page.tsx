import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LibraryView } from "@/components/securities/cybersec/LibraryView.client";

export const metadata = {
  title: "Biblioteca · CyberSec Academy",
  description: "Libros y recursos de ciberseguridad y programación en español.",
};

export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { cat } = await searchParams;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <LibraryView initialCat={cat} />
    </div>
  );
}
