export type GoalStatus = "ON_TRACK" | "BELOW_PACE" | "EXCEEDED" | "WARNING";

export function computeGoalStatus(currentValue: number, targetValue: number): GoalStatus {
  if (!Number.isFinite(targetValue) || targetValue <= 0) return "WARNING";
  const progress = currentValue / targetValue;
  if (progress >= 1) return "EXCEEDED";
  if (progress >= 0.7) return "ON_TRACK";
  if (progress >= 0.4) return "BELOW_PACE";
  return "WARNING";
}
