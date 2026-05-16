/**
 * Command poller — hot-rotate threshold changes without restart (Fase C).
 *
 * Polls `bot_commands` every POLL_INTERVAL_MS for rows targeted at this bot
 * (filtered by COINARB_BOT_ID) with status pending|PENDING. For each command:
 *  - `update_parameters` → applyParameters() mutates the live config bindings;
 *    next loop tick uses the new value automatically (ES live bindings).
 *  - any other command_type is acked as FAILED with an explanatory message.
 *
 * After processing, the command's `status` is moved to DONE/FAILED and a row
 * is inserted into `bot_command_status` so the UI knows the bot acknowledged.
 *
 * Failure modes are quiet — network blip / Supabase rate limit just logs a
 * warn and tries again next interval; the trading loop is unaffected.
 */

import { getSupabase } from '../supabase.js';
import {
  applyParameters,
  setTradingPaused,
  COINARB_BOT_ID,
  COINARB_BOT_ACCOUNT_ID,
} from '../core/config.js';

const POLL_INTERVAL_MS = 30_000;  // 30s — UI edits feel responsive without hammering Supabase.

interface BotCommand {
  id: string;
  bot_id: string;
  command_type: string;
  payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

export class CommandPoller {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private inFlight = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    console.log(`[command-poller] started — bot_id=${COINARB_BOT_ID} interval=${POLL_INTERVAL_MS}ms`);
    void this.poll();  // immediate first poll so a PUT right before deploy isn't stuck for 30s
    this.timer = setInterval(() => { void this.poll(); }, POLL_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    console.log('[command-poller] stopped');
  }

  private async poll(): Promise<void> {
    if (this.inFlight) return;  // skip if previous poll still running (slow DB / many commands)
    this.inFlight = true;
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('bot_commands')
        .select('id, bot_id, command_type, payload, status, created_at')
        .eq('bot_id', COINARB_BOT_ID)
        .in('status', ['pending', 'PENDING'])
        .order('created_at', { ascending: true })
        .limit(20);

      if (error) {
        console.warn('[command-poller] query failed:', error.message);
        return;
      }
      if (!data || data.length === 0) return;

      for (const row of data as BotCommand[]) {
        await this.process(row);
      }
    } catch (err) {
      console.warn('[command-poller] poll threw:', err);
    } finally {
      this.inFlight = false;
    }
  }

  private async process(cmd: BotCommand): Promise<void> {
    console.log(`[command-poller] processing ${cmd.command_type} id=${cmd.id.slice(0, 8)}`);
    let resultStatus: 'DONE' | 'FAILED' = 'DONE';
    let resultMessage: string | null = null;

    try {
      switch (cmd.command_type) {
        case 'update_parameters': {
          const params = (cmd.payload?.parameters ?? {}) as Record<string, unknown>;
          const changes = applyParameters(params);
          if (changes.length === 0) {
            resultMessage = 'no-op (values already match)';
          } else {
            resultMessage = `applied: ${changes.join(' ')}`;
            console.log(`[command-poller] applied — ${changes.join(' ')}`);
          }
          break;
        }
        case 'pause': {
          const flipped = setTradingPaused(true);
          resultMessage = flipped ? 'trading paused (no new entries until resume)' : 'no-op (already paused)';
          if (flipped) console.log('[command-poller] trading paused by user');
          break;
        }
        case 'resume': {
          const flipped = setTradingPaused(false);
          resultMessage = flipped ? 'trading resumed' : 'no-op (already running)';
          if (flipped) console.log('[command-poller] trading resumed by user');
          break;
        }
        default:
          resultStatus = 'FAILED';
          resultMessage = `unsupported command_type: ${cmd.command_type}`;
          console.warn(`[command-poller] ${resultMessage}`);
      }
    } catch (err) {
      resultStatus = 'FAILED';
      resultMessage = err instanceof Error ? err.message : String(err);
      console.error(`[command-poller] error processing ${cmd.id}:`, err);
    }

    await this.ack(cmd.id, resultStatus, resultMessage);
  }

  private async ack(commandId: string, status: 'DONE' | 'FAILED', message: string | null): Promise<void> {
    try {
      const supabase = getSupabase();
      const now = new Date().toISOString();
      // Overall lifecycle: bot_commands.status is the canonical "is this done?".
      const { error: upErr } = await supabase
        .from('bot_commands')
        .update({ status, updated_at: now })
        .eq('id', commandId);
      if (upErr) console.warn('[command-poller] bot_commands update failed:', upErr.message);

      // Per-bot ack row (relevant for target_scope='all' fan-out; harmless for 'account').
      const { error: insErr } = await supabase
        .from('bot_command_status')
        .insert({
          command_id: commandId,
          bot_account_id: COINARB_BOT_ACCOUNT_ID,
          status,
          acked_at: now,
          message,
        });
      if (insErr) console.warn('[command-poller] bot_command_status insert failed:', insErr.message);
    } catch (err) {
      console.warn('[command-poller] ack threw:', err);
    }
  }
}
