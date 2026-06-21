import { describe, it, expect, vi, beforeEach } from 'vitest';
import { warnMissingValidatorKeys, type Logger } from '../src/ops/startup-warnings.js';

function makeLogger(): { logger: Logger; calls: Array<{ msg: string; meta?: Record<string, unknown> }> } {
  const calls: Array<{ msg: string; meta?: Record<string, unknown> }> = [];
  const logger: Logger = {
    warn: (msg, meta) => calls.push({ msg, meta }),
  };
  return { logger, calls };
}

describe('warnMissingValidatorKeys', () => {
  let logger: Logger;
  let calls: Array<{ msg: string; meta?: Record<string, unknown> }>;

  beforeEach(() => {
    ({ logger, calls } = makeLogger());
  });

  it('logs nothing when both keys are present', () => {
    const result = warnMissingValidatorKeys(
      { COINGLASS_API_KEY: 'cg-key', CRYPTOQUANT_API_KEY: 'cq-key' } as NodeJS.ProcessEnv,
      logger,
    );
    expect(calls).toHaveLength(0);
    expect(result).toEqual({ coinglassMissing: false, cryptoquantMissing: false });
  });

  it('logs one warning when only Coinglass is missing', () => {
    const result = warnMissingValidatorKeys(
      { CRYPTOQUANT_API_KEY: 'cq-key' } as NodeJS.ProcessEnv,
      logger,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].msg).toContain('COINGLASS_API_KEY missing');
    expect(calls[0].meta).toEqual({
      component: 'coinarb.boot',
      impact: 'liquidity zones will not factor into entry decisions',
    });
    expect(result).toEqual({ coinglassMissing: true, cryptoquantMissing: false });
  });

  it('logs one warning when only CryptoQuant is missing', () => {
    const result = warnMissingValidatorKeys(
      { COINGLASS_API_KEY: 'cg-key' } as NodeJS.ProcessEnv,
      logger,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].msg).toContain('CRYPTOQUANT_API_KEY missing');
    expect(calls[0].meta).toEqual({
      component: 'coinarb.boot',
      impact: 'whale flows will not factor into entry decisions',
    });
    expect(result).toEqual({ coinglassMissing: false, cryptoquantMissing: true });
  });

  it('logs two warnings when both are missing', () => {
    const result = warnMissingValidatorKeys({} as NodeJS.ProcessEnv, logger);
    expect(calls).toHaveLength(2);
    expect(calls[0].msg).toContain('COINGLASS_API_KEY');
    expect(calls[1].msg).toContain('CRYPTOQUANT_API_KEY');
    expect(result).toEqual({ coinglassMissing: true, cryptoquantMissing: true });
  });

  it('empty string is treated as missing (Fly secret unset)', () => {
    const result = warnMissingValidatorKeys(
      { COINGLASS_API_KEY: '', CRYPTOQUANT_API_KEY: '' } as NodeJS.ProcessEnv,
      logger,
    );
    expect(calls).toHaveLength(2);
    expect(result).toEqual({ coinglassMissing: true, cryptoquantMissing: true });
  });

  it('default logger writes to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      warnMissingValidatorKeys({} as NodeJS.ProcessEnv);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[0][0]).toContain('COINGLASS_API_KEY missing');
      expect(spy.mock.calls[1][0]).toContain('CRYPTOQUANT_API_KEY missing');
    } finally {
      spy.mockRestore();
    }
  });
});
