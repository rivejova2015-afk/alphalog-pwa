import BotControlSelector from "@/components/bot-control/BotControlSelector.client";

// Force dynamic — BotControlSelector reads Supabase at render, which fails in
// build-time SSG when env vars aren't injected to the GitHub Actions runner.
// Marking the page dynamic skips prerendering and defers to runtime.
export const dynamic = "force-dynamic";

export default function DashboardBotControlSelectorPage() {
  return <BotControlSelector basePath="/dashboard/bot-control" />;
}
