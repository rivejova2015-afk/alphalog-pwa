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
      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-600"
    >
      Cerrar sesion
    </button>
  );
}
