import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar sesión — AlphaLog",
  description: "Plataforma de gestión de trading con bot MT5, terminal de análisis y suite de inteligencia.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
