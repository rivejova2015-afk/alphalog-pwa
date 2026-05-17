import type { Metadata } from "next";
import { MainLayout } from "@/components/layout/MainLayout";

export const metadata: Metadata = {
  title: "Business Hub — AlphaLog",
  description: "Gestión de decisiones, journal, KPIs, SOPs, P&L, runway y roadmap del negocio.",
};

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}
