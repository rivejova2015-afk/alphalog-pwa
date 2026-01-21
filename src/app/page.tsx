// src/app/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Marca la página como dinámica porque accede a cookies (Supabase auth)
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (!error && data?.user) {
    // Hay sesión, redirige a dashboard
    redirect("/dashboard");
  }

  // No hay sesión, redirige a auth
  redirect("/auth");
}
