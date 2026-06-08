"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

import { logError, logInfo } from "@/lib/log";
export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        logError("LogoutButton", { component: "logoutbutton", message: "[LogoutButton] Logout error", error: error instanceof Error ? error.message : String(error) });
        alert("Error al cerrar sesión: " + error.message);
        return;
      }

      logInfo("LogoutButton", "Logged out successfully", { component: "logoutbutton" });
      router.refresh();
      router.push("/auth");
    } catch (err) {
      logError("LogoutButton", { component: "logoutbutton", message: "[LogoutButton] Unexpected error", error: err instanceof Error ? err.message : String(err) });
      alert("Error inesperado al cerrar sesión");
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 shadow-[0_12px_24px_rgba(2,4,10,0.35)] transition hover:bg-slate-800/80 hover:text-slate-50"
    >
      Cerrar sesión
    </button>
  );
}
