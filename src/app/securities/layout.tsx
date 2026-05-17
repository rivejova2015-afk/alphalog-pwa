import type { Metadata } from "next";
import { MainLayout } from "@/components/layout/MainLayout";

export const metadata: Metadata = {
  title: "AlphaLog Securities — CyberSec Academy",
  description: "58 módulos de ciberseguridad: fundamentos, redes, pentesting, forense, cloud y más. Quizzes, prácticas, homework y examen final.",
};

export default function SecuritiesLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}
