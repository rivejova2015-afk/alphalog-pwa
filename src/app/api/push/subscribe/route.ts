// src/app/api/push/subscribe/route.ts
// Subscribe/unsubscribe to push notifications

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
    const { subscription } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const { supabase, user } = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("push_subscriptions")
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh ?? "",
        auth: subscription.keys?.auth ?? "",
        user_agent: request.headers.get("user-agent") || undefined,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to save subscription:", error);
      return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
    }

    return NextResponse.json({ success: true, subscription: data });
  } catch (error) {
    console.error("Subscribe endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const { supabase, user } = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (error) {
      console.error("Failed to delete subscription:", error);
      return NextResponse.json({ error: "Failed to delete subscription" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
