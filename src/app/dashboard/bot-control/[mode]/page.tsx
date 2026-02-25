import { notFound } from "next/navigation";
import BotControlWorkspace from "@/components/bot-control/BotControlWorkspace.client";
import type { BotMode } from "@/components/bot-control/profileConfig";

interface DashboardBotControlModePageProps {
  params: Promise<{ mode: string }>;
}

export default async function DashboardBotControlModePage({ params }: DashboardBotControlModePageProps) {
  const { mode } = await params;
  if (mode !== "forex" && mode !== "futuros") {
    notFound();
  }

  return <BotControlWorkspace mode={mode as BotMode} basePath="/dashboard/bot-control" />;
}
