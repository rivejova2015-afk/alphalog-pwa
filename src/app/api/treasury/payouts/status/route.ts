/**
 * PATCH /api/treasury/payouts/status
 * Update payout status (planned → sent → received, or canceled)
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logError } from "@/lib/log";

interface UpdateStatusRequest {
  payoutId: string; // UUID
  status: 'planned' | 'sent' | 'received' | 'canceled';
}

interface UpdateStatusResponse {
  success: boolean;
  payoutId?: string;
  newStatus?: string;
  error?: string;
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    // Validate session
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = sessionData.session.user.id;
    const body = (await request.json()) as UpdateStatusRequest;
    const { payoutId, status } = body;

    // Validate input
    if (!payoutId || !status) {
      return Response.json(
        { success: false, error: 'payoutId and status are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['planned', 'sent', 'received', 'canceled'];
    if (!validStatuses.includes(status)) {
      return Response.json(
        { success: false, error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // Fetch payout to verify ownership
    const { data: payout, error: fetchError } = await supabase
      .from('treasury_payouts')
      .select('id, user_id')
      .eq('id', payoutId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !payout) {
      return Response.json(
        { success: false, error: 'Payout not found' },
        { status: 404 }
      );
    }

    // Update status
    const { error: updateError } = await supabase
      .from('treasury_payouts')
      .update({ status })
      .eq('id', payoutId)
      .eq('user_id', userId);

    if (updateError) {
      logError("TreasuryPayouts", { component: "treasury.payouts.status", message: "Update error:", error: updateError instanceof Error ? updateError.message : String(updateError) });
      return Response.json(
        { success: false, error: 'Failed to update status' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      payoutId,
      newStatus: status,
    } as UpdateStatusResponse);
  } catch (error) {
    logError("TreasuryPayouts", { component: "treasury.payouts.status", message: "Error:", error: error instanceof Error ? error.message : String(error) });
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
