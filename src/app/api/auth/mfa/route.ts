/**
 * MFA / TOTP management routes
 * GET  /api/auth/mfa  — list enrolled factors
 * POST /api/auth/mfa  — enroll new TOTP factor
 * DELETE /api/auth/mfa — unenroll factor
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error: mfaError } = await supabase.auth.mfa.listFactors();
  if (mfaError) return NextResponse.json({ error: mfaError.message }, { status: 500 });

  return NextResponse.json({ factors: data?.totp ?? [] });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "AlphaLog Authenticator",
  });

  if (enrollError) return NextResponse.json({ error: enrollError.message }, { status: 500 });

  return NextResponse.json({
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const factorId = body?.factorId as string | undefined;
  if (!factorId) return NextResponse.json({ error: "factorId required" }, { status: 400 });

  const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
  if (unenrollError) return NextResponse.json({ error: unenrollError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
