import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { checkOrderRisk } from '@/lib/cme/risk-manager';
import { executeSignal } from '@/lib/cme/order-executor';
import { logAuditFromRequest } from '@/lib/security/auditLog';
import { z } from 'zod';

const schema = z.object({
  algorithmId: z.string().uuid().optional(),
  cmeAccountId: z.string().uuid(),
  contract: z.string().min(1).max(20),
  direction: z.enum(['BUY', 'SELL']),
  quantity: z.number().int().min(1).max(100),
  slTicks: z.number().int().min(1),
  tpTicks: z.number().int().min(1),
  signalType: z.enum(['entry', 'exit']).default('entry'),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { cmeAccountId, contract, direction, quantity, slTicks, tpTicks, algorithmId, signalType } = parsed.data;

  const risk = await checkOrderRisk({ userId: user.id, cmeAccountId, direction, quantity });

  const { data: signal } = await supabase
    .from('cme_signals')
    .insert({
      user_id: user.id,
      algorithm_id: algorithmId ?? null,
      cme_account_id: cmeAccountId,
      contract,
      direction,
      signal_type: signalType,
      quantity,
      stop_loss_ticks: slTicks,
      take_profit_ticks: tpTicks,
      status: risk.allowed ? 'executing' : 'rejected',
      reject_reason: risk.reason ?? null,
      risk_check_result: risk,
    })
    .select('id')
    .single();

  if (!signal) return NextResponse.json({ error: 'Failed to create signal' }, { status: 500 });

  if (!risk.allowed) {
    return NextResponse.json(
      { error: 'Signal rejected', reason: risk.reason },
      { status: 422 }
    );
  }

  const svc = createServiceClient();
  const result = await executeSignal(
    {
      id: signal.id,
      userId: user.id,
      cmeAccountId,
      contract,
      direction,
      quantity,
      stopLossTicks: slTicks,
      takeProfitTicks: tpTicks,
      algorithmId,
    },
    svc
  );

  if (!result.success) {
    await supabase
      .from('cme_signals')
      .update({ status: 'rejected', reject_reason: result.error })
      .eq('id', signal.id);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await logAuditFromRequest(
    {
      userId: user.id,
      action: "create",
      resourceType: "cme_signal",
      resourceId: signal.id,
      status: "success",
      changes: { orderId: result.orderId, contract: parsed.data.contract, direction: parsed.data.direction },
    },
    req
  );

  return NextResponse.json({
    success: true,
    signalId: signal.id,
    orderId: result.orderId,
  });
}
