// src/app/api/map-hot/goals/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  mapHotGoalCreateSchema,
  mapHotGoalResponseSchema,
  validationErrorResponse,
} from "@/lib/validation/schemas";
import { autoFixMapHotGoal } from "@/lib/validation/autoFix";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { computeGoalStatus } from "@/lib/map-hot/goalStatus";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logError, logWarn } from "@/lib/log";

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

const toNumber = (value: string | number): number =>
  typeof value === "number" ? value : Number(value);

const mapRowToResponse = (row: GoalRow) => {
  const target = toNumber(row.target_value);
  const current = toNumber(row.current_value);
  const linkedAlgorithms = (row.links ?? [])
    .map((link) => link.algorithms)
    .filter((algo): algo is { id: string; name: string; status: string | null } => Boolean(algo))
    .map((algo) => ({ id: algo.id, name: algo.name, status: algo.status }));

  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    timeframe: row.timeframe,
    target_value: target,
    current_value: current,
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return unauthorized();
    }

    const userId = userData.user.id;

    const { data: rows, error } = await supabase
      .from("map_hot_goals")
      .select(
        "id, user_id, name, timeframe, target_value, current_value, unit, status, due_date, sort_index, created_at, updated_at, deleted_at, links:map_hot_goal_links(algorithm_id, algorithms(id, name, status))"
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("sort_index", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      logError("MapHotGoals", { component: "map-hot.goals", message: "Error fetching map_hot_goals:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
    }

    const mapped = ((rows ?? []) as unknown as GoalRow[]).map(mapRowToResponse);

    return NextResponse.json(mapped, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err: unknown) {
    logError("MapHotGoals", { component: "map-hot.goals", message: "Error in GET /api/map-hot/goals:", error: err instanceof Error ? err.message : String(err) });
    await recordBugFromRequest(request, { userId: null, status: 500, error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let userIdForBug: string | null = null;
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return unauthorized();
    }

    const userId = userData.user.id;
    userIdForBug = userId;

    const raw = (await request.json()) as unknown;
    const fixed = autoFixMapHotGoal((raw ?? {}) as Record<string, unknown>);
    const parsed = mapHotGoalCreateSchema.safeParse(fixed.data);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        errors[issue.path.join(".") || "root"] = issue.message;
      });
      return NextResponse.json(validationErrorResponse(errors), { status: 400 });
    }

    const body = parsed.data;
    const status = computeGoalStatus(body.current_value, body.target_value);

    // Verify ownership of all linked algorithms (defense in depth on top of RLS)
    if (body.linked_algorithm_ids.length > 0) {
      const { data: ownedAlgos, error: algoErr } = await supabase
        .from("algorithms")
        .select("id")
        .eq("user_id", userId)
        .in("id", body.linked_algorithm_ids);

      if (algoErr) {
        logError("MapHotGoals", { component: "map-hot.goals", message: "Error verifying algorithm ownership:", error: algoErr instanceof Error ? algoErr.message : String(algoErr) });
        return NextResponse.json({ error: "Failed to verify algorithms" }, { status: 500 });
      }

      if ((ownedAlgos?.length ?? 0) !== body.linked_algorithm_ids.length) {
        return NextResponse.json(
          { error: "One or more linked algorithms not found or unauthorized" },
          { status: 400 }
        );
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("map_hot_goals")
      .insert({
        user_id: userId,
        name: body.name,
        timeframe: body.timeframe,
        target_value: body.target_value,
        current_value: body.current_value,
        unit: body.unit,
        status,
        due_date: body.due_date ?? null,
      })
      .select(
        "id, user_id, name, timeframe, target_value, current_value, unit, status, due_date, sort_index, created_at, updated_at, deleted_at"
      )
      .single();

    if (insertErr || !inserted) {
      logError("MapHotGoals", { component: "map-hot.goals", message: "Error creating map_hot_goal:", error: insertErr instanceof Error ? insertErr.message : String(insertErr) });
      return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
    }

    if (body.linked_algorithm_ids.length > 0) {
      const linkRows = body.linked_algorithm_ids.map((algorithmId) => ({
        user_id: userId,
        goal_id: inserted.id,
        algorithm_id: algorithmId,
      }));
      const { error: linkErr } = await supabase.from("map_hot_goal_links").insert(linkRows);
      if (linkErr) {
        logError("MapHotGoals", { component: "map-hot.goals", message: "Error inserting goal links:", error: linkErr instanceof Error ? linkErr.message : String(linkErr) });
        // Rollback: hard-delete the goal to keep state consistent
        await supabase.from("map_hot_goals").delete().eq("id", inserted.id).eq("user_id", userId);
        return NextResponse.json({ error: "Failed to link algorithms" }, { status: 500 });
      }
    }

    // Re-fetch with joined algorithms for response
    const { data: full, error: fetchErr } = await supabase
      .from("map_hot_goals")
      .select(
        "id, user_id, name, timeframe, target_value, current_value, unit, status, due_date, sort_index, created_at, updated_at, deleted_at, links:map_hot_goal_links(algorithm_id, algorithms(id, name, status))"
      )
      .eq("id", inserted.id)
      .single();

    if (fetchErr || !full) {
      logError("MapHotGoals", { component: "map-hot.goals", message: "Error refetching created goal:", error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr) });
      return NextResponse.json(mapRowToResponse(inserted as unknown as GoalRow), { status: 201 });
    }

    const response = mapRowToResponse(full as unknown as GoalRow);
    const contract = enforceResponseContract(mapHotGoalResponseSchema, response);
    if (!contract.ok) {
      logWarn("MapHotGoals", "response contract violation", { component: "map-hot.goals.contract", errors: contract.errors });
    }

    await logAuditFromRequest(
      {
        userId,
        action: "create",
        resourceType: "goal",
        resourceId: inserted.id,
        status: "success",
      },
      request
    );

    return NextResponse.json(response, { status: 201 });
  } catch (err: unknown) {
    logError("MapHotGoals", { component: "map-hot.goals", message: "Error in POST /api/map-hot/goals:", error: err instanceof Error ? err.message : String(err) });
    await recordBugFromRequest(request, { userId: userIdForBug, status: 500, error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
