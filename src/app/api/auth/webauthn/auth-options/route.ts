/**
 * POST /api/auth/webauthn/auth-options
 * Generate authentication challenge for passkey sign-in.
 */

import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: credentials } = await supabase
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .is("deleted_at", null);

  const allowCredentials = (credentials ?? []).map((row) => ({
    id: row.credential_id,
    type: "public-key" as const,
    transports: (row.transports ?? []) as AuthenticatorTransport[],
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: "preferred",
  });

  const response = NextResponse.json(options);
  response.cookies.set("al_wn_auth_challenge", options.challenge, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 300,
    path: "/api/auth/webauthn",
  });

  return response;
}
