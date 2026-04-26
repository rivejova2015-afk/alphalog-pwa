/**
 * POST /api/auth/mfa/verify
 * Verify a TOTP code for an enrolled factor.
 * Creates a challenge and verifies it in one step.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { factorId, code } = body as { factorId?: string; code?: string };

  if (!factorId || !code) {
    return NextResponse.json({ error: "factorId and code are required" }, { status: 400 });
  }

  const { data, error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });

  if (verifyError) {
    return NextResponse.json({ error: "Invalid code", detail: verifyError.message }, { status: 401 });
  }

  return NextResponse.json({ success: true, aal: (data as Record<string, unknown> | null)?.current_level });
}
