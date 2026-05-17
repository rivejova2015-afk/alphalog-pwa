export type MilestoneQuarter = "Q1" | "Q2" | "Q3" | "Q4";
export type MilestoneStatus = "completed" | "active" | "upcoming";

const QUARTER_MONTH_RANGE: Record<MilestoneQuarter, [number, number]> = {
  Q1: [0, 2],
  Q2: [3, 5],
  Q3: [6, 8],
  Q4: [9, 11],
};

export function deriveMilestoneStatusByDate(
  year: number,
  quarter: MilestoneQuarter,
  now: Date = new Date()
): MilestoneStatus {
  const [start, end] = QUARTER_MONTH_RANGE[quarter];
  const quarterStart = Date.UTC(year, start, 1);
  const quarterEnd = Date.UTC(year, end + 1, 0, 23, 59, 59);
  const nowMs = now.getTime();
  if (nowMs < quarterStart) return "upcoming";
  if (nowMs > quarterEnd) return "completed";
  return "active";
}
