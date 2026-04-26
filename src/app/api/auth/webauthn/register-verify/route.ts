/**
 * POST /api/auth/webauthn/register-verify
 * Verify registration response and store credential.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { createClient } from "@/lib/supabase/server";

const RP_ID = process.env.NEXT_PUBLIC_CANONICAL_HOST ?? "alphalog.io";
const ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ?? `https://${RP_ID}`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expectedChallenge = request.cookies.get("al_wn_reg_challenge")?.value;
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

  const { friendlyName, ...registrationResponse } =
    body as RegistrationResponseJSON & { friendlyName?: string };

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Verification failed", detail: String(err) },
      { status: 400 }
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json(
      { error: "Registration not verified" },
      { status: 400 }
    );
  }

  const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
    verification.registrationInfo;

  const { error: insertError } = await supabase
    .from("webauthn_credentials")
    .insert({
      user_id: user.id,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      friendly_name: friendlyName ?? null,
      aaguid: aaguid ?? null,
      transports: (registrationResponse.response?.transports ?? []) as string[],
    });

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to save credential", detail: insertError.message },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ verified: true });
  // Clear the challenge cookie
  response.cookies.set("al_wn_reg_challenge", "", {
    maxAge: 0,
    path: "/api/auth/webauthn",
  });

  return response;
}
