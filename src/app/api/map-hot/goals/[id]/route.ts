// src/app/api/map-hot/goals/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  mapHotGoalUpdateSchema,
  mapHotGoalResponseSchema,
  validationErrorResponse,
} from "@/lib/validation/schemas";
import { autoFixMapHotGoal } from "@/lib/validation/autoFix";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { computeGoalStatus } from "@/lib/map-hot/goalStatus";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";

type GoalRow = {
  id: string;
  user_id: string;
  name: string;
  timeframe: "annual" | "quarterly" | "monthly" | "weekly";
  target_value: string | number;
  current_value: string | number;
  unit: string;
  status: "ON_TRACK" | "BELOW_PACE" | "EXCEEDED" | "WARNING";
  due_date: string | null;
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  links?: Array<{
    algorithm_id: string;
    algorithms: { id: string; name: string; status: string | null } | null;
  }>;
};

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const notFound = () => NextResponse.json({ error: "Goal not found" }, { status: 404 });

const toNumber = (value: string | number): number =>
  typeof value === "number" ? value : Number(value);

const mapRowToResponse = (row: GoalRow) => {
  const linkedAlgorithms = (row.links ?? [])
    .map((link) => link.algorithms)
    .filter((algo): algo is { id: string; name: string; status: string | null } => Boolean(algo))
    .map((algo) => ({ id: algo.id, name: algo.name, status: algo.status }));

  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    timeframe: row.timeframe,
    target_value: toNumber(row.target_value),
    current_value: toNumber(row.current_value),
    unit: row.unit,
    status: row.status,
    due_date: row.due_date,
    sort_index: row.sort_index,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    linked_algorithms: linkedAlgorithms,
  };
};

const SELECT_WITH_LINKS =
  "id, user_id, name, timeframe, target_value, current_value, unit, status, due_date, sort_index, created_at, updated_at, deleted_at, links:map_hot_goal_links(algorithm_id, algorithms(id, name, status))";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) return unauthorized();
    const userId = userData.user.id;

    const { data: row, error } = await supabase
      .from("map_hot_goals")
      .select(SELECT_WITH_LINKS)
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (error || !row) return notFound();

    return NextResponse.json(mapRowToResponse(row as unknown as GoalRow), {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/map-hot/goals/[id]:", err);
    await recordBugFromRequest(request, { userId: null, status: 500, error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let userIdForBug: string | null = null;
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) return unauthorized();
    const userId = userData.user.id;
    userIdForBug = userId;

    const raw = (await request.json()) as unknown;
    const fixed = autoFixMapHotGoal((raw ?? {}) as Record<string, unknown>);
    const parsed = mapHotGoalUpdateSchema.safeParse(fixed.data);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        errors[issue.path.join(".") || "root"] = issue.message;
      });
      return NextResponse.json(validationErrorResponse(errors), { status: 400 });
    }

    const body = parsed.data;

    // Verify ownership and fetch current values for status recompute
    const { data: existing, error: existingErr } = await supabase
      .from("map_hot_goals")
      .select("id, target_value, current_value")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (existingErr || !existing) return notFound();

    const update: Record<string, unknown> = {};
    if (body.restore === true) {
      update.deleted_at = null;
    }
    if (body.name !== undefined) update.name = body.name;
    if (body.timeframe !== undefined) update.timeframe = body.timeframe;
    if (body.target_value !== undefined) update.target_value = body.target_value;
    if (body.current_value !== undefined) update.current_value = body.current_value;
    if (body.unit !== undefined) update.unit = body.unit;
    if (body.due_date !== undefined) update.due_date = body.due_date;

    // Recompute status if target or current changed
    if (body.target_value !== undefined || body.current_value !== undefined) {
      const nextTarget = body.target_value ?? toNumber(existing.target_value);
      const nextCurrent = body.current_value ?? toNumber(existing.current_value);
      update.status = computeGoalStatus(nextCurrent, nextTarget);
    }

    if (Object.keys(update).length > 0) {
      const { error: updateErr } = await supabase
        .from("map_hot_goals")
        .update(update)
        .eq("id", id)
        .eq("user_id", userId);

      if (updateErr) {
        console.error("Error updating map_hot_goal:", updateErr);
        return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
      }
    }

    // Reconcile linked algorithms (diff add/remove) if provided
    if (body.linked_algorithm_ids !== undefined) {
      const nextIds = new Set(body.linked_algorithm_ids);

      if (nextIds.size > 0) {
        const { data: ownedAlgos, error: algoErr } = await supabase
          .from("algorithms")
          .select("id")
          .eq("user_id", userId)
          .in("id", Array.from(nextIds));

        if (algoErr) {
          console.error("Error verifying algorithm ownership:", algoErr);
          return NextResponse.json({ error: "Failed to verify algorithms" }, { status: 500 });
        }
        if ((ownedAlgos?.length ?? 0) !== nextIds.size) {
          return NextResponse.json(
            { error: "One or more linked algorithms not found or unauthorized" },
            { status: 400 }
          );
        }
      }

      const { data: currentLinks } = await supabase
        .from("map_hot_goal_links")
        .select("algorithm_id")
        .eq("goal_id", id)
        .eq("user_id", userId);

      const currentIds = new Set((currentLinks ?? []).map((r) => r.algorithm_id));
      const toAdd = Array.from(nextIds).filter((aid) => !currentIds.has(aid));
      const toRemove = Array.from(currentIds).filter((aid) => !nextIds.has(aid));

      if (toRemove.length > 0) {
        const { error: deleteErr } = await supabase
          .from("map_hot_goal_links")
          .delete()
          .eq("goal_id", id)
          .eq("user_id", userId)
          .in("algorithm_id", toRemove);
        if (deleteErr) {
          console.error("Error removing goal links:", deleteErr);
          return NextResponse.json({ error: "Failed to update links" }, { status: 500 });
        }
      }

      if (toAdd.length > 0) {
        const { error: insertErr } = await supabase.from("map_hot_goal_links").insert(
          toAdd.map((algorithmId) => ({
            user_id: userId,
            goal_id: id,
            algorithm_id: algorithmId,
          }))
        );
        if (insertErr) {
          console.error("Error adding goal links:", insertErr);
          return NextResponse.json({ error: "Failed to update links" }, { status: 500 });
        }
      }
    }

    const { data: full, error: fetchErr } = await supabase
      .from("map_hot_goals")
      .select(SELECT_WITH_LINKS)
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchErr || !full) return notFound();

    const response = mapRowToResponse(full as unknown as GoalRow);
    const contract = enforceResponseContract(mapHotGoalResponseSchema, response);
    if (!contract.ok) {
      console.warn("map_hot_goal response contract violation:", contract.errors);
    }

    await logAuditFromRequest(
      {
        userId,
        action: "update",
        resourceType: "goal",
        resourceId: id,
        status: "success",
      },
      request
    );

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("Error in PUT /api/map-hot/goals/[id]:", err);
    await recordBugFromRequest(request, { userId: userIdForBug, status: 500, error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let userIdForBug: string | null = null;
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) return unauthorized();
    const userId = userData.user.id;
    userIdForBug = userId;

    const { data: existing, error: existingErr } = await supabase
      .from("map_hot_goals")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (existingErr || !existing) return notFound();

    const { error: deleteErr } = await supabase
      .from("map_hot_goals")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (deleteErr) {
      console.error("Error soft-deleting map_hot_goal:", deleteErr);
      return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
    }

    await logAuditFromRequest(
      {
        userId,
        action: "delete",
        resourceType: "goal",
        resourceId: id,
        status: "success",
      },
      request
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error in DELETE /api/map-hot/goals/[id]:", err);
    await recordBugFromRequest(request, { userId: userIdForBug, status: 500, error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
