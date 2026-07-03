import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { safeCompareTokens } from '@/lib/security/timing';
import { checkOrderRisk } from '@/lib/cme/risk-manager';
import { executeSignal, type CmeSignal } from '@/lib/cme/order-executor';
import { finalizeParentIfDone } from '@/lib/cme/execution-slices';
import { logError, logInfo } from '@/lib/log';

// Coloca las slices de TWAP/VWAP/IS cuya scheduled_at ya pasó. La primera
// slice de cada plan la coloca el dispatcher de inmediato (dispatchTradovate);
// este cron recoge el resto — cada slice se re-chequea contra checkOrderRisk
// en el momento de colocarla, no solo cuando se armó el plan (el PnL diario o
// las reglas propfirm pueden haber cambiado desde entonces).
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (!safeCompareTokens(secret, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();

  const { data: dueSlices, error: fetchErr } = await svc
    .from('cme_signals')
    .select('id, user_id, algorithm_id, cme_account_id, contract, direction, quantity, stop_loss_ticks, take_profit_ticks, parent_signal_id')
    .eq('status', 'pending')
    .not('parent_signal_id', 'is', null)
    .lte('scheduled_at', new Date().toISOString())
    .limit(50);

  if (fetchErr) {
    logError('DispatchTradovate', {
      component: 'execution-tick fetch',
      message: fetchErr.message,
    });
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const slices = dueSlices ?? [];
  let placed = 0;
  let rejected = 0;
  let failed = 0;

  for (const slice of slices) {
    try {
      const risk = await checkOrderRisk({
        userId: slice.user_id,
        cmeAccountId: slice.cme_account_id,
        direction: slice.direction,
        quantity: slice.quantity,
      });

      if (!risk.allowed) {
        const reason = risk.reason ?? 'risk_denied';
        await svc
          .from('cme_signals')
          .update({ status: 'rejected', reject_reason: reason })
          .eq('id', slice.id);
        await finalizeParentIfDone(svc, slice.parent_signal_id);
        rejected++;
        continue;
      }

      const cmeSignal: CmeSignal = {
        id: slice.id,
        userId: slice.user_id,
        cmeAccountId: slice.cme_account_id,
        contract: slice.contract,
        direction: slice.direction,
        quantity: slice.quantity,
        stopLossTicks: slice.stop_loss_ticks,
        takeProfitTicks: slice.take_profit_ticks,
        algorithmId: slice.algorithm_id ?? undefined,
      };

      const result = await executeSignal(cmeSignal, svc);
      if (result.success) {
        placed++;
        logInfo('DispatchTradovate', `execution-tick placed slice ${slice.id} x${slice.quantity} orderId=${result.orderId} (parent=${slice.parent_signal_id})`);
      } else {
        await svc
          .from('cme_signals')
          .update({ status: 'rejected', reject_reason: result.error ?? 'executor_failed' })
          .eq('id', slice.id);
        failed++;
      }
      await finalizeParentIfDone(svc, slice.parent_signal_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError('DispatchTradovate', {
        component: 'execution-tick slice threw',
        message: msg,
        meta: { sliceId: slice.id },
      });
      try {
        await svc
          .from('cme_signals')
          .update({ status: 'rejected', reject_reason: `executor_threw: ${msg}` })
          .eq('id', slice.id);
      } catch {
        // best-effort — la slice queda 'pending' y expira sola (expires_at).
      }
      failed++;
    }
  }

  return NextResponse.json({ checked: slices.length, placed, rejected, failed });
}

// Vercel Cron puede invocar GET o POST según config — alias para soportar ambos.
export const GET = POST;
