import { MainLayout } from "@/components/layout/MainLayout";

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}
