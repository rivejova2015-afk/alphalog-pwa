// src/app/api/push/test/route.ts
// Send test push notification for current user

import { sendPushToSubscription } from "@/lib/push/webpush.server";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function getUserFromRequest(request: NextRequest) {
  const supabase = await createClient();

  const sessionUser = await supabase.auth.getUser();
  if (sessionUser.data.user) {
    return { supabase, user: sessionUser.data.user };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return { supabase, user: null };
  }

  const token = authHeader.slice("bearer ".length).trim();
  if (!token) return { supabase, user: null };

  const tokenUser = await supabase.auth.getUser(token);
  return { supabase, user: tokenUser.data.user ?? null };
}

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId } = await request.json();

    if (!subscriptionId) {
      return NextResponse.json({ error: "Missing subscriptionId" }, { status: 400 });
    }

    const { supabase, user } = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: subscription, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    await sendPushToSubscription(pushSubscription, {
      title: "Notificacion de prueba",
      body: "AlphaLog Push funciona correctamente",
      tag: "alphalog-test",
      data: { type: "test" },
    });

    return NextResponse.json({ success: true, message: "Test notification sent" });
  } catch (error) {
    console.error("Test push endpoint error:", error);
    return NextResponse.json({ error: "Failed to send test notification" }, { status: 500 });
  }
}
