"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("[LogoutButton] Logout error:", error);
        alert("Error al cerrar sesion: " + error.message);
        return;
      }

      console.log("[LogoutButton] Logged out successfully");
      router.refresh();
      router.push("/auth");
    } catch (err) {
      console.error("[LogoutButton] Unexpected error:", err);
      alert("Error inesperado al cerrar sesion");
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 shadow-[0_12px_24px_rgba(2,4,10,0.35)] transition hover:bg-slate-800/80 hover:text-slate-50"
    >
      Cerrar sesion
    </button>
  );
}
