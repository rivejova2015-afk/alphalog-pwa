import { notFound } from "next/navigation";
import BotControlWorkspace from "@/components/bot-control/BotControlWorkspace.client";
import type { BotMode } from "@/components/bot-control/profileConfig";

interface TradingBotControlModePageProps {
  params: Promise<{ mode: string }>;
}

export default async function TradingBotControlModePage({ params }: TradingBotControlModePageProps) {
  const { mode } = await params;
  if (mode !== "forex" && mode !== "futuros") {
    notFound();
  }

  return <BotControlWorkspace mode={mode as BotMode} basePath="/trading/tabs/bot-control" />;
}
