// GET /api/cme/propfirm-rules?cmeAccountId=X
//
// Devuelve la regla propfirm activa para una cuenta CME, con info evaluada en el
// momento (past cutoff, minutos hasta cutoff, próximos eventos de noticias). Sirve
// al panel UI CmePropfirmRulesPanel para visibilidad operativa.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPropfirmRule, type PropfirmRule } from "@/lib/cme/propfirm-rules";
import { isPastCutoffEt, nowEtHHMM } from "@/lib/cme/market-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UpcomingEvent {
  id: string;
  name: string;
  impact: string;
  timestampUtc: string;
}

function minutesUntilCutoff(now: Date, cutoffEt: string): number | null {
  // Convertir cutoff "HH:MM" ET → minutos hasta now ET. Devuelve null si formato inválido.
  const m = cutoffEt.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const cutoffMin = Number(m[1]) * 60 + Number(m[2]);
  const nowHHMM = nowEtHHMM(now);
  const [hh, mm] = nowHHMM.split(":").map(Number);
  const nowMin = hh * 60 + mm;
  return cutoffMin - nowMin; // negativo si ya pasó
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cmeAccountId = searchParams.get("cmeAccountId");
  if (!cmeAccountId) {
    return NextResponse.json({ error: "cmeAccountId required" }, { status: 400 });
  }

  const { data: account, error: acctErr } = await supabase
    .from("algo_cme_accounts")
    .select("provider_name, funded_amount, label")
    .eq("id", cmeAccountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (acctErr) return NextResponse.json({ error: acctErr.message }, { status: 500 });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const providerName = account.provider_name as string | null;
  const rule: PropfirmRule | null = getPropfirmRule(providerName);
  const now = new Date();

  let pastCutoff = false;
  let minutesUntil: number | null = null;
  if (rule?.overnightCutoffEt) {
    pastCutoff = isPastCutoffEt(now, rule.overnightCutoffEt);
    minutesUntil = minutesUntilCutoff(now, rule.overnightCutoffEt);
  }

  // Próximos eventos de noticias en las próximas 24h con impact en la lista
  // configurada por la regla (o 'high' por default si la regla no aplica).
  const impactLevels = rule?.newsBlackoutImpactLevels ?? ["high"];
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabase
    .from("terminal_events")
    .select("id, name, impact, timestamp_utc")
    .in("impact", impactLevels as string[])
    .gte("timestamp_utc", now.toISOString())
    .lte("timestamp_utc", next24h)
    .order("timestamp_utc", { ascending: true })
    .limit(10);

  const upcomingNewsEvents: UpcomingEvent[] = (events ?? []).map((e) => ({
    id: e.id as string,
    name: e.name as string,
    impact: e.impact as string,
    timestampUtc: e.timestamp_utc as string,
  }));

  return NextResponse.json(
    {
      providerName,
      rule,
      evaluatedAt: now.toISOString(),
      nowEtHHMM: nowEtHHMM(now),
      pastCutoff,
      minutesUntilCutoff: minutesUntil,
      upcomingNewsEvents,
      accountLabel: account.label as string | null,
      fundedAmount: account.funded_amount as number | null,
    },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
