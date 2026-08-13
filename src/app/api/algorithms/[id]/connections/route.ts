import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const STALE_THRESHOLD_MS = 15 * 60 * 1000;
const LIVE_THRESHOLD_MS  = 2 * 60 * 1000;

function heartbeatStatus(lastHeartbeatAt: string | null, paired: boolean): "live" | "stale" | "synced" | "pending" {
  if (!paired || !lastHeartbeatAt) return "pending";
  const age = Date.now() - new Date(lastHeartbeatAt).getTime();
  if (age < LIVE_THRESHOLD_MS) return "live";
  if (age < STALE_THRESHOLD_MS) return "synced";
  return "stale";
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id, name, market_type, direction, instrument, status, parameters, linked_bot_account_id, platform")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (algoErr || !algo) {
      return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });
    }

    // 'crypto' has no connection type since Coinarb was retired 2026-07-14
    // (no bot to pair with) — it falls into the same "options" no-op bucket
    // as any other unrecognized value, rather than being silently coerced
    // into a misleading MT5 pending block.
    const marketType = (["forex", "futures"].includes(algo.market_type)
      ? algo.market_type
      : "options") as "forex" | "futures" | "options";

    const response: {
      algorithm: { id: string; name: string; market_type: string; instrument: string; platform: 'MT4' | 'MT5' };
      mt5: {
        bot_account_id: string | null;
        account_id: string | null;
        label: string | null;
        platform: string | null;
        paired: boolean;
        last_heartbeat_at: string | null;
        instance_status: string | null;
        connection_status: "live" | "stale" | "synced" | "pending";
        webhook_url: string;
      } | null;
      cme: {
        cme_account_id: string | null;
        provider_name: string | null;
        account_number: string | null;
        account_type: "propfirm" | "broker" | null;
        broker_type: string | null;
        connection_status: string | null;
        token_expires_at: string | null;
        last_connected_at: string | null;
        funded_amount: number | null;
        max_daily_loss: number | null;
        max_trailing_dd: number | null;
        is_paper: boolean | null;
      } | null;
      options: { available: boolean } | null;
    } = {
      algorithm: {
        id: algo.id,
        name: algo.name,
        market_type: marketType,
        instrument: Array.isArray(algo.instrument)
          ? (algo.instrument[0] ?? "")
          : (algo.instrument ?? ""),
        platform: algo.platform === 'MT4' ? 'MT4' : 'MT5',
      },
      mt5: null,
      cme: null,
      options: null,
    };

    if (marketType === "forex") {
      let mt5Block: typeof response.mt5 = {
        bot_account_id: null,
        account_id: null,
        label: null,
        platform: null,
        paired: false,
        last_heartbeat_at: null,
        instance_status: null,
        connection_status: "pending",
        webhook_url: "https://alphalog.io/api/webhooks/telemetry",
      };

      if (algo.linked_bot_account_id) {
        const { data: ba } = await supabase
          .from("bot_accounts")
          .select("id, account_id, label, bot_instances(platform, status, last_heartbeat_at, pairing_token_used_at)")
          .eq("id", algo.linked_bot_account_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (ba) {
          const instances = Array.isArray(ba.bot_instances)
            ? ba.bot_instances
            : ba.bot_instances ? [ba.bot_instances] : [];
          let latest = instances[0] ?? null;
          for (const inst of instances) {
            if (!latest?.last_heartbeat_at && inst.last_heartbeat_at) latest = inst;
            if (inst.last_heartbeat_at && latest?.last_heartbeat_at &&
                new Date(inst.last_heartbeat_at) > new Date(latest.last_heartbeat_at)) {
              latest = inst;
            }
          }
          const paired = Boolean(latest?.pairing_token_used_at);
          mt5Block = {
            bot_account_id: ba.id,
            account_id: ba.account_id,
            label: ba.label,
            platform: latest?.platform ?? null,
            paired,
            last_heartbeat_at: latest?.last_heartbeat_at ?? null,
            instance_status: latest?.status ?? null,
            connection_status: heartbeatStatus(latest?.last_heartbeat_at ?? null, paired),
            webhook_url: "https://alphalog.io/api/webhooks/telemetry",
          };
        }
      }

      response.mt5 = mt5Block;
    } else if (marketType === "futures") {
      const params = (algo.parameters ?? {}) as Record<string, unknown>;
      const cmeAccountNum = typeof params.cme_account_num === "string" ? params.cme_account_num : null;

      let cmeBlock: typeof response.cme = {
        cme_account_id: null,
        provider_name: null,
        account_number: null,
        account_type: null,
        broker_type: null,
        connection_status: null,
        token_expires_at: null,
        last_connected_at: null,
        funded_amount: null,
        max_daily_loss: null,
        max_trailing_dd: null,
        is_paper: null,
      };

      if (cmeAccountNum) {
        const { data: cmeAcc } = await supabase
          .from("algo_cme_accounts")
          .select("id, account_type, provider_name, account_number, funded_amount, max_daily_loss, max_trailing_dd, is_paper, cme_connections(status, broker_type, token_expires_at, last_connected_at)")
          .eq("user_id", user.id)
          .eq("account_number", cmeAccountNum)
          .is("deleted_at", null)
          .maybeSingle();

        if (cmeAcc) {
          const conn = Array.isArray(cmeAcc.cme_connections)
            ? cmeAcc.cme_connections[0]
            : cmeAcc.cme_connections;
          cmeBlock = {
            cme_account_id: cmeAcc.id,
            provider_name: cmeAcc.provider_name,
            account_number: cmeAcc.account_number,
            account_type: cmeAcc.account_type as "propfirm" | "broker" | null,
            broker_type: conn?.broker_type ?? null,
            connection_status: conn?.status ?? null,
            token_expires_at: conn?.token_expires_at ?? null,
            last_connected_at: conn?.last_connected_at ?? null,
            funded_amount: cmeAcc.funded_amount,
            max_daily_loss: cmeAcc.max_daily_loss,
            max_trailing_dd: cmeAcc.max_trailing_dd,
            is_paper: typeof cmeAcc.is_paper === "boolean" ? cmeAcc.is_paper : null,
          };
        }
      }

      response.cme = cmeBlock;
    } else {
      response.options = { available: false };
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=60" },
    });
  } catch (err) {
    logError("AlgorithmConnections", { component: "GET /api/algorithms/[id]/connections", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
