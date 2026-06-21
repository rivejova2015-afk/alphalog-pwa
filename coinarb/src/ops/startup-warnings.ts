/**
 * Boot-time visibility checks for optional validator API keys.
 *
 * Coinglass (liquidation heatmap) and CryptoQuant (exchange flows) both have
 * silent fallbacks in their respective validators — if the key is missing,
 * they return `{ available: false }` and the loop treats the signal as
 * unknown rather than failing. That's correct for the hot path but invisible
 * to the operator: the bot may run for days at reduced signal quality
 * without anyone noticing.
 *
 * This helper logs ONE warning per missing key at boot. Pure function so the
 * env + logger can be injected in tests without spinning up the loop.
 */

export interface Logger {
  warn(msg: string, meta?: Record<string, unknown>): void;
}

const defaultLogger: Logger = {
  warn: (msg, meta) => {
    if (meta !== undefined) console.warn(msg, meta);
    else console.warn(msg);
  },
};

export interface ValidatorKeyCheckResult {
  coinglassMissing: boolean;
  cryptoquantMissing: boolean;
}

export function warnMissingValidatorKeys(
  env: NodeJS.ProcessEnv = process.env,
  logger: Logger = defaultLogger,
): ValidatorKeyCheckResult {
  const coinglassMissing = !env.COINGLASS_API_KEY;
  const cryptoquantMissing = !env.CRYPTOQUANT_API_KEY;

  if (coinglassMissing) {
    logger.warn(
      '[coinarb.startup] COINGLASS_API_KEY missing — liquidation-heatmap validator returning { available: false } for the lifetime of this process',
      { component: 'coinarb.boot', impact: 'liquidity zones will not factor into entry decisions' },
    );
  }
  if (cryptoquantMissing) {
    logger.warn(
      '[coinarb.startup] CRYPTOQUANT_API_KEY missing — exchange-flows validator returning { available: false } for the lifetime of this process',
      { component: 'coinarb.boot', impact: 'whale flows will not factor into entry decisions' },
    );
  }

  return { coinglassMissing, cryptoquantMissing };
}
