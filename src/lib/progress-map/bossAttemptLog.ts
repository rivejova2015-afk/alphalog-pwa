// Boss Attempt Log
// Guarda cada intento de boss con el gate y métrica bloqueada.

export interface BossAttempt {
  id: string;
  bossId: string;
  failedGate: string;
  failedMetric: string;
  timestamp: Date;
}

export class BossAttemptLogger {
  private attempts: BossAttempt[] = [];

  logAttempt(bossId: string, failedGate: string, failedMetric: string) {
    this.attempts.push({
      id: `${bossId}-${Date.now()}`,
      bossId,
      failedGate,
      failedMetric,
      timestamp: new Date()
    });
  }

  getAttemptsForBoss(bossId: string) {
    return this.attempts.filter(a => a.bossId === bossId);
  }
}
