// GET /api/cme/signals
//
// Lista cme_signals con filtros por cuenta + status + ventana temporal.
// Habilita la UI de "Shadow Signals" que muestra las señales dispatcheadas
// por el cron tradovate-poll mientras DISPATCH_MODE='shadow' o las
// 'rejected' por el kill-switch (checkOrderRisk).
//
// Status del enum cme_signals:
//   - pending   : recién creado, antes de la decisión del dispatcher
//   - executed  : place order fue exitoso en Tradovate
//   - skipped   : shadow mode lo registró sin tocar Tradovate
//   - rejected  : kill-switch o executor falló

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cmeAccountId = searchParams.get("cmeAccountId");
  const status = searchParams.get("status"); // pending | executed | skipped | rejected
  const sinceHours = Math.min(parseInt(searchParams.get("sinceHours") ?? "168", 10), 24 * 30);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

  let query = supabase
    .from("cme_signals")
    .select("id, algorithm_id, cme_account_id, contract, direction, quantity, stop_loss_ticks, take_profit_ticks, status, reject_reason, signal_type, executed_at, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .gte("created_at", new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cmeAccountId) query = query.eq("cme_account_id", cmeAccountId);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate counts por status para que la UI muestre tally rápido.
  const tally = (data ?? []).reduce(
    (acc, row) => {
      acc[row.status as string] = (acc[row.status as string] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return NextResponse.json(
    { data, count, tally },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
