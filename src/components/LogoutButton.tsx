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
        alert("Error al cerrar sesión: " + error.message);
        return;
      }

      console.log("[LogoutButton] Logged out successfully");
      router.refresh(); // Refresca la sesión en el servidor
      router.push("/auth"); // Redirige a login
    } catch (err) {
      console.error("[LogoutButton] Unexpected error:", err);
      alert("Error inesperado al cerrar sesión");
    }
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        marginTop: 16,
        padding: "8px 16px",
        backgroundColor: "#ef4444",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      Cerrar sesión
    </button>
  );
}
