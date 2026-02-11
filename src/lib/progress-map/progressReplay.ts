// Progress Replay
// Reproduce el progreso semanal (XP, milestones, recovery triggers, fail-safe).

export interface ProgressEvent {
  id: string;
  type: string;
  value: number;
  timestamp: Date;
}

export function replayProgress(events: ProgressEvent[], from: Date, to: Date): ProgressEvent[] {
  return events.filter(e => e.timestamp >= from && e.timestamp <= to);
}
