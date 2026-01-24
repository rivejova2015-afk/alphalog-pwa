// src/app/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Marca la página como dinámica porque accede a cookies (Supabase auth)
export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (!error && data?.user) {
      // Hay sesión, redirige a dashboard
      redirect("/dashboard");
    }
  } catch (error) {
    // Log errors but don't crash
    console.error("[Home] Auth check failed:", error instanceof Error ? error.message : error);
  }

  // No hay sesión (o error), redirige a auth
  redirect("/auth");
}
