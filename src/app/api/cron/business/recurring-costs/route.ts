/**
 * GET /api/cron/business/recurring-costs
 * Scheduled endpoint: runs daily at 00:10 UTC via Supabase Scheduled Edge Function
 *
 * Purpose:
 *   - Process active recurring cost templates
 *   - Generate one cost instance per template per month (no duplicates)
 *   - Track generated month in template's last_generated_month to prevent reruns
 *
 * Logic:
 *   - For each active template for each user:
 *     1. Check if template.last_generated_month matches current month (YYYY-MM)
 *     2. If not, check if cost_date for current month already exists (safety check)
 *     3. If neither, create business_costs entry with is_recurring_instance=true, template_id
 *     4. Update template.last_generated_month to current month
 *     5. Track results (created, skipped, errors)
 *
 * Security:
 *   - Requires x-cron-secret header matching CRON_SECRET env var
 *   - Uses Supabase service role (admin) access for cost insertion
 *   - Returns 401 if header missing or invalid
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { safeCompareTokens } from '@/lib/security/timing';
import { logError } from "@/lib/log";

function getMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface CostTemplate {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  description: string;
  vendor: string;
  day_of_month: number;
  start_month: string;
  active: boolean;
  last_generated_month: string | null;
}

interface GenerationResult {
  template_id: string;
  user_id: string;
  action: 'created' | 'skipped' | 'error';
  reason?: string;
  cost_id?: string;
}

export async function GET(request: NextRequest) {
  try {
    // 1) Verify CRON_SECRET header with timing-safe comparison
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!safeCompareTokens(cronSecret, expectedSecret)) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing cron secret' },
        { status: 401 }
      );
    }

    // 2) Initialize Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // 3) Get current month
    const currentMonth = getMonthStr();
    const today = new Date();
    const costDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    console.log(`[Business Recurring Costs] Starting at ${costDate}`);

    // 4) Fetch all active templates
    const { data: templates, error: templatesError } = await supabase
      .from('business_cost_templates')
      .select('*')
      .eq('active', true)
      .is('deleted_at', null)
      .order('user_id', { ascending: true });

    if (templatesError) {
      logError("CronBusinessRecurringCosts", { component: "cron.business.recurring-costs", message: "Error fetching templates:", error: templatesError instanceof Error ? templatesError.message : String(templatesError) });
      return NextResponse.json(
        { error: 'Failed to fetch templates', details: templatesError },
        { status: 500 }
      );
    }

    if (!templates || templates.length === 0) {
      console.log('No active templates found');
      return NextResponse.json(
        {
          success: true,
          message: 'No active templates to process',
          results: [],
        },
        { status: 200 }
      );
    }

    // 5) Process each template
    const results: GenerationResult[] = [];

    for (const template of templates as CostTemplate[]) {
      try {
        // Skip if template hasn't reached start month yet
        if (template.start_month > currentMonth) {
          results.push({
            template_id: template.id,
            user_id: template.user_id,
            action: 'skipped',
            reason: `Start month (${template.start_month}) not yet reached`,
          });
          continue;
        }

        // Skip if already generated for this month
        if (template.last_generated_month === currentMonth) {
          results.push({
            template_id: template.id,
            user_id: template.user_id,
            action: 'skipped',
            reason: `Already generated for ${currentMonth}`,
          });
          continue;
        }

        // Safety check: verify no cost exists for this template this month
        const { data: existingCosts, error: existingError } = await supabase
          .from('business_costs')
          .select('id')
          .eq('user_id', template.user_id)
          .eq('template_id', template.id)
          .like('cost_date', `${currentMonth}%`)
          .is('deleted_at', null)
          .limit(1);

        if (existingError) {
          logError("CronBusinessRecurringCosts", { component: "cron.business.recurring-costs", message: "Error checking existing costs for template ${template.id}:", error: existingError instanceof Error ? existingError.message : String(existingError) });
          results.push({
            template_id: template.id,
            user_id: template.user_id,
            action: 'error',
            reason: `Failed to check existing costs: ${existingError.message}`,
          });
          continue;
        }

        if (existingCosts && existingCosts.length > 0) {
          results.push({
            template_id: template.id,
            user_id: template.user_id,
            action: 'skipped',
            reason: 'Cost already exists for this month',
          });
          continue;
        }

        // Create the recurring cost
        const { data: newCost, error: insertError } = await supabase
          .from('business_costs')
          .insert({
            user_id: template.user_id,
            amount: template.amount,
            category: template.category,
            description: template.description,
            vendor: template.vendor,
            cost_date: costDate,
            is_recurring_instance: true,
            template_id: template.id,
          })
          .select('id')
          .single();

        if (insertError) {
          logError("CronBusinessRecurringCosts", { component: "cron.business.recurring-costs", message: "Error creating cost from template ${template.id}:", error: insertError instanceof Error ? insertError.message : String(insertError) });
          results.push({
            template_id: template.id,
            user_id: template.user_id,
            action: 'error',
            reason: `Failed to create cost: ${insertError.message}`,
          });
          continue;
        }

        // Update template's last_generated_month
        const { error: updateError } = await supabase
          .from('business_cost_templates')
          .update({ last_generated_month: currentMonth })
          .eq('id', template.id);

        if (updateError) {
          logError("CronBusinessRecurringCosts", { component: "cron.business.recurring-costs", message: "Error updating template ${template.id}:", error: updateError instanceof Error ? updateError.message : String(updateError) });
          results.push({
            template_id: template.id,
            user_id: template.user_id,
            action: 'error',
            reason: `Cost created but failed to update template: ${updateError.message}`,
            cost_id: newCost.id,
          });
          continue;
        }

        results.push({
          template_id: template.id,
          user_id: template.user_id,
          action: 'created',
          cost_id: newCost.id,
        });

        console.log(`Created recurring cost ${newCost.id} from template ${template.id}`);
      } catch (error) {
        logError("CronBusinessRecurringCosts", { component: "cron.business.recurring-costs", message: "Unexpected error processing template ${template.id}:", error: error instanceof Error ? error.message : String(error) });
        results.push({
          template_id: template.id,
          user_id: template.user_id,
          action: 'error',
          reason: `Unexpected error: ${String(error)}`,
        });
      }
    }

    // 6) Return results
    const created = results.filter((r) => r.action === 'created').length;
    const skipped = results.filter((r) => r.action === 'skipped').length;
    const errors = results.filter((r) => r.action === 'error').length;

    console.log(
      `[Business Recurring Costs] Completed: ${created} created, ${skipped} skipped, ${errors} errors`
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Recurring costs generation completed',
        timestamp: new Date().toISOString(),
        currentMonth,
        summary: { created, skipped, errors, total: results.length },
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    logError("Business Recurring Costs", { component: "cron.business.recurring-costs", message: "Unexpected error:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: String(error),
      },
      { status: 500 }
    );
  }
}
