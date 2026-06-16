// POST /api/debug/cme/risk-check
//
// Endpoint debug que invoca checkOrderRisk con un `now` configurable. Útil para:
//   1. Smoke test del enforcement propfirm (scripts/smoke/propfirm-enforcement.js).
//   2. Diagnóstico de por qué un signal está siendo bloqueado en producción
//      (simular el momento exacto del bloqueo).
//
// Auth: Bearer CRON_SECRET (mismo nivel que crones — service-internal).

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { checkOrderRisk } from "@/lib/cme/risk-manager";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  cmeAccountId: z.string().uuid(),
  userId: z.string().uuid(),
  direction: z.enum(["BUY", "SELL"]),
  quantity: z.number().int().positive(),
  /** ISO date string. Si omitido, usa el momento actual. */
  now: z.string().datetime().optional(),
});

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  if (!auth.startsWith("Bearer ")) return false;
  const sent = auth.slice("Bearer ".length);
  try {
    const a = Buffer.from(sent);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await checkOrderRisk({
    userId: parsed.data.userId,
    cmeAccountId: parsed.data.cmeAccountId,
    direction: parsed.data.direction,
    quantity: parsed.data.quantity,
    now: parsed.data.now ? new Date(parsed.data.now) : undefined,
  });

  return NextResponse.json({
    ok: true,
    nowProvided: parsed.data.now ?? null,
    result,
  });
}
