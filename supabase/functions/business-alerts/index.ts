/**
 * Supabase Scheduled Edge Function: Business Alerts
 *
 * Trigger: Daily at 00:15 UTC (cron: 15 0 * * *)
 *
 * Purpose:
 *   - Call the Next.js cron endpoint at /api/cron/business/alerts
 *   - Handles scheduled business alerts (low runway, annual report reminders)
 *
 * Environment Variables (set in Supabase Dashboard):
 *   - ALPHALOG_WEB_URL: Base URL of the Next.js app (e.g., https://alphalog.io)
 *   - CRON_SECRET: Shared secret for cron endpoint authentication
 *
 * Configuration:
 *   - Schedule: "15 0 * * *" (00:15 UTC daily)
 *   - Timeout: 300 seconds (5 minutes)
 */

interface ScheduleRequest {
  timestamp: string;
}

export async function main(request: ScheduleRequest) {
  console.log('Business Alerts Edge Function triggered at:', request.timestamp);

  try {
    // Get environment variables
    const alphalogWebUrl = Deno.env.get('ALPHALOG_WEB_URL');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (!alphalogWebUrl || !cronSecret) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({
          error: 'Missing environment variables: ALPHALOG_WEB_URL and/or CRON_SECRET',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Call the Next.js cron endpoint
    const endpointUrl = `${alphalogWebUrl}/api/cron/business/alerts`;

    console.log(`Calling endpoint: ${endpointUrl}`);

    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        'x-cron-secret': cronSecret,
        'Content-Type': 'application/json',
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Cron endpoint returned error:', response.status, responseData);
      return new Response(
        JSON.stringify({
          error: 'Cron endpoint failed',
          status: response.status,
          details: responseData,
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Cron endpoint success:', responseData);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Business alerts job completed',
        details: responseData,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in Business Alerts Edge Function:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
