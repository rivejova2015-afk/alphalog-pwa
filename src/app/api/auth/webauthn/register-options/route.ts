/**
 * POST /api/auth/webauthn/register-options
 * Generate registration challenge for a new passkey.
 * Challenge is stored in a short-lived httpOnly cookie.
 */

import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";

const RP_NAME = "AlphaLog";
const RP_ID = process.env.NEXT_PUBLIC_CANONICAL_HOST ?? "alphalog.io";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("webauthn_credentials")
    .select("credential_id")
    .is("deleted_at", null);

  const excludeCredentials = (existing ?? []).map((row) => ({
    id: row.credential_id,
    type: "public-key" as const,
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email ?? user.id,
    userDisplayName: user.email ?? "AlphaLog User",
    attestationType: "none",
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  const response = NextResponse.json(options);
  // Store challenge in httpOnly cookie (5 min TTL) for verification step
  response.cookies.set("al_wn_reg_challenge", options.challenge, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 300,
    path: "/api/auth/webauthn",
  });

  return response;
}
