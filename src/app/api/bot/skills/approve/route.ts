import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enforceResponseContract } from "@/lib/validation/contractGuard";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  skillId: z.string().uuid(),
  approved: z.boolean(),
  notes: z.string().optional(),
});

const responseSchema = z.object({
  ok: z.boolean(),
  status: z.enum(["approved", "rejected"]),
  message: z.string(),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bot/skills/approve
// Approve or reject a pending skill for paper trading activation
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Validate request ────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { skillId, approved, notes } = parsed.data;

    // ── Fetch skill ─────────────────────────────────────────────────────────
    const { data: skill, error: skillErr } = await supabase
      .from("bot_skills")
      .select("id, instrument, model_blob_path, user_id")
      .eq("id", skillId)
      .single();

    if (skillErr || !skill) {
      return NextResponse.json(
        { error: "Skill not found" },
        { status: 404 }
      );
    }

    // Only the skill owner can approve/reject
    if (skill.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // ── Update skill status ─────────────────────────────────────────────────
    const newStatus = approved ? "approved" : "rejected";
    const { error: updateErr } = await supabase
      .from("bot_skills")
      .update({
        status: newStatus,
        approved_at: approved ? new Date().toISOString() : null,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", skillId);

    if (updateErr) {
      throw new Error(`Failed to update skill: ${updateErr.message}`);
    }

    // ── Insert audit log entry ──────────────────────────────────────────────
    const eventType = approved ? "APPROVED" : "REJECTED";
    const { error: auditErr } = await supabase.from("bot_skill_audit_log").insert({
      user_id: user.id,
      skill_id: skillId,
      event_type: eventType,
      parameters: { notes, approved_by: user.id },
    });

    if (auditErr) {
      logError("SkillApprove", {
        component: "api/bot/skills/approve",
        message: `Audit log insertion warning: ${auditErr.message}`,
      });
    }

    // ── If approved: activate in bot_active_skill ───────────────────────────
    if (approved && skill.model_blob_path) {
      const { error: activateErr } = await supabase
        .from("bot_active_skill")
        .upsert(
          {
            user_id: user.id,
            instrument: skill.instrument,
            skill_id: skillId,
            q_table_path: skill.model_blob_path,
            llm_rules: [], // Would be populated from skill audit data
            activated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,instrument" }
        );

      if (activateErr) {
        logError("SkillApprove", {
          component: "api/bot/skills/approve",
          message: `Failed to activate skill: ${activateErr.message}`,
        });
      }
    }

    // ── Log audit for user action ───────────────────────────────────────────
    logAuditFromRequest(
      {
        userId: user.id,
        action: "update",
        resourceType: "bot_signal_engine_state",
        status: "success",
        changes: {
          skillId,
          decision: approved ? "APPROVED" : "REJECTED",
          instrument: skill.instrument,
        },
      },
      request
    ).catch(() => undefined);

    // ── Response ────────────────────────────────────────────────────────────
    const responsePayload = {
      ok: true,
      status: newStatus as "approved" | "rejected",
      message: approved
        ? "Skill activado para paper trading de " + skill.instrument
        : "Skill rechazado",
    };

    const contractResult = enforceResponseContract(responseSchema, responsePayload);
    if (!contractResult.ok) {
      logError("SkillApprove", {
        component: "api/bot/skills/approve",
        action: "contract_guard",
        message: "Response contract violation",
        error: JSON.stringify(contractResult.errors),
      });
    }

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    logError("SkillApprove", {
      component: "api/bot/skills/approve",
      action: "POST",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
