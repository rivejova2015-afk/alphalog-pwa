// src/app/api/map-hot/milestones/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  mapHotMilestoneCreateSchema,
  mapHotMilestoneResponseSchema,
  validationErrorResponse,
} from "@/lib/validation/schemas";
import { autoFixMapHotMilestone } from "@/lib/validation/autoFix";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";

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

export async function GET(request: NextRequest) {
  let userIdForBug: string | null = null;
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return unauthorized();
    const userId = userData.user.id;
    userIdForBug = userId;

    const yearParam = request.nextUrl.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : new Date().getUTCFullYear();
    if (!Number.isFinite(year) || year < 2020 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const { data: rows, error } = await supabase
      .from("map_hot_milestones")
      .select(
        "id, user_id, year, quarter, label, target_amount, description, status, sort_index, created_at, updated_at, deleted_at"
      )
      .eq("user_id", userId)
      .eq("year", year)
      .is("deleted_at", null)
      .order("quarter", { ascending: true });

    if (error) {
      console.error("Error fetching map_hot_milestones:", error);
      return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500 });
    }

    const mapped = ((rows ?? []) as unknown as MilestoneRow[]).map(mapRow);
    return NextResponse.json(mapped, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/map-hot/milestones:", err);
    await recordBugFromRequest(request, { userId: userIdForBug, status: 500, error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let userIdForBug: string | null = null;
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return unauthorized();
    const userId = userData.user.id;
    userIdForBug = userId;

    const raw = (await request.json()) as unknown;
    const fixed = autoFixMapHotMilestone((raw ?? {}) as Record<string, unknown>);
    const parsed = mapHotMilestoneCreateSchema.safeParse(fixed.data);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        errors[issue.path.join(".") || "root"] = issue.message;
      });
      return NextResponse.json(validationErrorResponse(errors), { status: 400 });
    }

    const body = parsed.data;
    const { data: inserted, error: insertErr } = await supabase
      .from("map_hot_milestones")
      .insert({
        user_id: userId,
        year: body.year,
        quarter: body.quarter,
        label: body.label,
        target_amount: body.target_amount,
        description: body.description ?? null,
        status: body.status,
      })
      .select(
        "id, user_id, year, quarter, label, target_amount, description, status, sort_index, created_at, updated_at, deleted_at"
      )
      .single();

    if (insertErr || !inserted) {
      // Duplicate (user, year, quarter)
      if (insertErr?.code === "23505") {
        return NextResponse.json(
          { error: "A milestone already exists for this year and quarter" },
          { status: 409 }
        );
      }
      console.error("Error creating map_hot_milestone:", insertErr);
      return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 });
    }

    const response = mapRow(inserted as unknown as MilestoneRow);
    const contract = enforceResponseContract(mapHotMilestoneResponseSchema, response);
    if (!contract.ok) {
      console.warn("map_hot_milestone response contract violation:", contract.errors);
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
    console.error("Error in POST /api/map-hot/milestones:", err);
    await recordBugFromRequest(request, { userId: userIdForBug, status: 500, error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
