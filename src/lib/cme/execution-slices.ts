// Puente entre los planners puros (execution-algos.ts) y cme_signals.
//
// executeSignal() está atado 1:1 a una fila cme_signals — no es slice-aware.
// Este módulo resuelve eso creando una fila "padre" (representa el plan
// completo, status='executing' mientras hay slices pendientes) y N filas
// "hijas" (una por slice, con scheduled_at). La primera hija se ejecuta de
// inmediato desde el dispatcher; el resto las recoge el cron execution-tick.

import type { SupabaseClient } from "@supabase/supabase-js";
import { planTwap, planVwap, planIs, type SchedulePlan } from "./execution-algos";

export type ExecutionAlgoKind = "twap" | "vwap" | "is";

export interface BuildPlanParams {
  algo: ExecutionAlgoKind;
  totalQuantity: number;
  durationMinutes: number;
  sliceCount: number;
  /** Solo para 'vwap'. Si falta o no matchea sliceCount, planVwap cae a TWAP. */
  volumeProfile?: number[];
  /** Solo para 'is'. Default 0.5 si no se especifica. */
  urgency?: number;
}

/** Selecciona el planner correcto según execution_algo. */
export function buildSlicePlan(params: BuildPlanParams): SchedulePlan {
  const { algo, totalQuantity, durationMinutes, sliceCount } = params;
  if (algo === "vwap") {
    return planVwap({
      totalQuantity,
      durationMinutes,
      sliceCount,
      volumeProfile: params.volumeProfile ?? [],
    });
  }
  if (algo === "is") {
    return planIs({ totalQuantity, durationMinutes, sliceCount, urgency: params.urgency });
  }
  return planTwap({ totalQuantity, durationMinutes, sliceCount });
}

export interface InsertSlicesParams {
  userId: string;
  algorithmId?: string | null;
  cmeAccountId: string;
  contract: string;
  direction: "BUY" | "SELL";
  stopLossTicks: number;
  takeProfitTicks: number;
  plan: SchedulePlan;
}

export interface InsertedSlices {
  parentSignalId: string;
  /** Fila de la primera slice — el dispatcher la ejecuta de inmediato. */
  firstSlice: { id: string; quantity: number };
  /** Cuántas slices quedan pendientes para el cron (total - 1). */
  remainingCount: number;
}

/** Grace window tras scheduled_at antes de que una slice cuente como stale. */
const SLICE_EXPIRY_GRACE_MINUTES = 2;

/**
 * Inserta la fila padre (status='executing', quantity=total) + una fila hija
 * por slice (status='pending', scheduled_at=slice.scheduledAt). Devuelve el id
 * de la primera slice para que el caller la ejecute de inmediato.
 */
export async function insertExecutionSlices(
  svc: SupabaseClient,
  p: InsertSlicesParams,
): Promise<InsertedSlices> {
  const { plan } = p;
  if (plan.slices.length === 0) {
    throw new Error("execution plan produced zero slices");
  }

  const { data: parent, error: parentErr } = await svc
    .from("cme_signals")
    .insert({
      user_id: p.userId,
      algorithm_id: p.algorithmId ?? null,
      cme_account_id: p.cmeAccountId,
      contract: p.contract,
      direction: p.direction,
      signal_type: "entry",
      quantity: plan.totalQuantity,
      stop_loss_ticks: p.stopLossTicks,
      take_profit_ticks: p.takeProfitTicks,
      status: "executing",
      execution_algo: plan.algo,
      total_slices: plan.slices.length,
    })
    .select("id")
    .single();

  if (parentErr || !parent) {
    throw new Error(`could not insert parent signal: ${parentErr?.message ?? "no row returned"}`);
  }
  const parentSignalId = parent.id as string;

  const childRows = plan.slices.map((slice) => {
    const scheduledAt = new Date(slice.scheduledAt);
    const expiresAt = new Date(scheduledAt.getTime() + SLICE_EXPIRY_GRACE_MINUTES * 60 * 1000);
    return {
      user_id: p.userId,
      algorithm_id: p.algorithmId ?? null,
      cme_account_id: p.cmeAccountId,
      contract: p.contract,
      direction: p.direction,
      signal_type: "entry",
      quantity: slice.quantity,
      stop_loss_ticks: p.stopLossTicks,
      take_profit_ticks: p.takeProfitTicks,
      status: "pending",
      parent_signal_id: parentSignalId,
      slice_index: slice.sliceIndex,
      total_slices: plan.slices.length,
      execution_algo: plan.algo,
      scheduled_at: scheduledAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  });

  const { data: inserted, error: childErr } = await svc
    .from("cme_signals")
    .insert(childRows)
    .select("id, slice_index, quantity")
    .order("slice_index", { ascending: true });

  if (childErr || !inserted || inserted.length === 0) {
    throw new Error(`could not insert slice rows: ${childErr?.message ?? "no rows returned"}`);
  }

  const first = inserted[0] as { id: string; slice_index: number; quantity: number };

  return {
    parentSignalId,
    firstSlice: { id: first.id, quantity: first.quantity },
    remainingCount: inserted.length - 1,
  };
}

/**
 * Tras ejecutar/rechazar una slice, chequea si todas las hermanas ya están en
 * un estado terminal (executed/rejected/skipped). Si sí, actualiza el padre:
 *   - 'executed' si al menos una slice se ejecutó.
 *   - 'rejected' si todas fueron rechazadas/saltadas (ninguna se ejecutó).
 * No-op si aún quedan slices 'pending'.
 */
export async function finalizeParentIfDone(
  svc: SupabaseClient,
  parentSignalId: string,
): Promise<void> {
  const { data: siblings } = await svc
    .from("cme_signals")
    .select("status")
    .eq("parent_signal_id", parentSignalId);

  const rows = (siblings ?? []) as { status: string }[];
  if (rows.length === 0) return;

  const stillPending = rows.some((r) => r.status === "pending" || r.status === "executing");
  if (stillPending) return;

  const anyExecuted = rows.some((r) => r.status === "executed");
  await svc
    .from("cme_signals")
    .update({
      status: anyExecuted ? "executed" : "rejected",
      executed_at: anyExecuted ? new Date().toISOString() : null,
      reject_reason: anyExecuted ? null : "all_slices_rejected",
    })
    .eq("id", parentSignalId);
}
