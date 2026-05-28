// src/app/api/map-hot/milestones/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  mapHotMilestoneUpdateSchema,
  mapHotMilestoneResponseSchema,
  validationErrorResponse,
} from "@/lib/validation/schemas";
import { autoFixMapHotMilestone } from "@/lib/validation/autoFix";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logError } from "@/lib/log";

type MilestoneRow = {
  id: string;
  user_id: string;
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  label: string;
  target_amount: string | number;
  description: string | null;
  status: "completed" | "active" | "upcoming";
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const notFound = () => NextResponse.json({ error: "Milestone not found" }, { status: 404 });

const toNumber = (value: string | number): number =>
  typeof value === "number" ? value : Number(value);

const mapRow = (row: MilestoneRow) => ({
  id: row.id,
  user_id: row.user_id,
  year: row.year,
  quarter: row.quarter,
  label: row.label,
  target_amount: toNumber(row.target_amount),
  description: row.description,
  status: row.status,
  sort_index: row.sort_index,
  created_at: row.created_at,
  updated_at: row.updated_at,
  deleted_at: row.deleted_at,
});

const SELECT =
  "id, user_id, year, quarter, label, target_amount, description, status, sort_index, created_at, updated_at, deleted_at";

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
    const fixed = autoFixMapHotMilestone((raw ?? {}) as Record<string, unknown>);
    const parsed = mapHotMilestoneUpdateSchema.safeParse(fixed.data);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        errors[issue.path.join(".") || "root"] = issue.message;
      });
      return NextResponse.json(validationErrorResponse(errors), { status: 400 });
    }

    const body = parsed.data;

    const { data: existing, error: existingErr } = await supabase
      .from("map_hot_milestones")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (existingErr || !existing) return notFound();

    const update: Record<string, unknown> = {};
    if (body.restore === true) update.deleted_at = null;
    if (body.year !== undefined) update.year = body.year;
    if (body.quarter !== undefined) update.quarter = body.quarter;
    if (body.label !== undefined) update.label = body.label;
    if (body.target_amount !== undefined) update.target_amount = body.target_amount;
    if (body.description !== undefined) update.description = body.description;
    if (body.status !== undefined) update.status = body.status;

    if (Object.keys(update).length > 0) {
      const { error: updateErr } = await supabase
        .from("map_hot_milestones")
        .update(update)
        .eq("id", id)
        .eq("user_id", userId);

      if (updateErr) {
        if (updateErr.code === "23505") {
          return NextResponse.json(
            { error: "A milestone already exists for this year and quarter" },
            { status: 409 }
          );
        }
        logError("MapHotMilestones", { component: "map-hot.milestones.[id]", message: "Error updating map_hot_milestone:", error: updateErr instanceof Error ? updateErr.message : String(updateErr) });
        return NextResponse.json({ error: "Failed to update milestone" }, { status: 500 });
      }
    }

    const { data: full, error: fetchErr } = await supabase
      .from("map_hot_milestones")
      .select(SELECT)
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchErr || !full) return notFound();

    const response = mapRow(full as unknown as MilestoneRow);
    const contract = enforceResponseContract(mapHotMilestoneResponseSchema, response);
    if (!contract.ok) {
      console.warn("map_hot_milestone response contract violation:", contract.errors);
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
    logError("MapHotMilestones", { component: "map-hot.milestones.[id]", message: "Error in PUT /api/map-hot/milestones/[id]:", error: err instanceof Error ? err.message : String(err) });
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
      .from("map_hot_milestones")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (existingErr || !existing) return notFound();

    const { error: deleteErr } = await supabase
      .from("map_hot_milestones")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (deleteErr) {
      logError("MapHotMilestones", { component: "map-hot.milestones.[id]", message: "Error soft-deleting map_hot_milestone:", error: deleteErr instanceof Error ? deleteErr.message : String(deleteErr) });
      return NextResponse.json({ error: "Failed to delete milestone" }, { status: 500 });
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
    logError("MapHotMilestones", { component: "map-hot.milestones.[id]", message: "Error in DELETE /api/map-hot/milestones/[id]:", error: err instanceof Error ? err.message : String(err) });
    await recordBugFromRequest(request, { userId: userIdForBug, status: 500, error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
