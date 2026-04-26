/**
 * POST /api/auth/webauthn/auth-verify
 * Verify authentication assertion and update credential counter.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { createClient } from "@/lib/supabase/server";

const RP_ID = process.env.NEXT_PUBLIC_CANONICAL_HOST ?? "alphalog.io";
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? `https://${RP_ID}`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expectedChallenge = request.cookies.get("al_wn_auth_challenge")?.value;
  if (!expectedChallenge) {
    return NextResponse.json(
      { error: "Challenge expired or missing" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const authResponse = body as AuthenticationResponseJSON;

  // Fetch the stored credential
  const { data: cred } = await supabase
    .from("webauthn_credentials")
    .select("id, credential_id, public_key, counter, transports")
    .eq("credential_id", authResponse.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!cred) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: cred.credential_id,
        publicKey: Buffer.from(cred.public_key, "base64url"),
        counter: cred.counter,
        transports: (cred.transports ?? []) as AuthenticatorTransport[],
      },
      requireUserVerification: false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Verification failed", detail: String(err) },
      { status: 400 }
    );
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Not verified" }, { status: 401 });
  }

  // Update counter and last_used_at
  await supabase
    .from("webauthn_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", cred.id);

  const response = NextResponse.json({ verified: true });
  response.cookies.set("al_wn_auth_challenge", "", {
    maxAge: 0,
    path: "/api/auth/webauthn",
  });

  return response;
}
