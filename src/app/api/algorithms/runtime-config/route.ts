// GET /api/algorithms/runtime-config
//
// Surfaces dispatcher-runtime configuration (specifically DISPATCH_MODE) to
// the client so the UI can render an accurate "SHADOW vs LIVE" chip. Reading
// process.env from a Server Component is direct; doing it from a Client
// Component requires either NEXT_PUBLIC_ prefix (leaks broadly) or a tiny
// authenticated endpoint like this one (preferred — keeps the env var private
// to the server while still letting the UI display its value to the owner).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDispatchMode } from "@/lib/engine/dispatchers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(
    { dispatch_mode: getDispatchMode() },
    {
      status: 200,
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    },
  );
}
