/**
 * Supabase Scheduled Edge Function: Treasury Withdrawal Reminders
 * 
 * Trigger: Daily at 00:05 UTC (cron: 5 0 * * *)
 * 
 * Purpose:
 *   - Call the Next.js cron endpoint at /api/cron/treasury/withdrawal-reminders
 *   - Handles scheduled execution of withdrawal day reminder notifications
 * 
 * Environment Variables (set in Supabase Dashboard):
 *   - ALPHALOG_WEB_URL: Base URL of the Next.js app (e.g., https://alphalog.io)
 *   - CRON_SECRET: Shared secret for cron endpoint authentication
 * 
 * Configuration:
 *   - Schedule: "5 0 * * *" (00:05 UTC daily)
 *   - Timeout: 300 seconds (5 minutes)
 */

interface ScheduleRequest {
  timestamp: string;
}

export async function main(request: ScheduleRequest) {
  console.log('Treasury Withdrawal Reminders Edge Function triggered at:', request.timestamp);

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
    const endpointUrl = `${alphalogWebUrl}/api/cron/treasury/withdrawal-reminders`;

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
        message: 'Withdrawal reminders job completed',
        details: responseData,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in Treasury Withdrawal Reminders function:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
