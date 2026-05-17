import type { Metadata } from "next";
import { MainLayout } from "@/components/layout/MainLayout";

export const metadata: Metadata = {
  title: "Intelligence Suite — AlphaLog",
  description: "Capital levels, constraint monitor, mind ops, knowledge factory, agentes algorítmicos y backtests.",
};

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}
