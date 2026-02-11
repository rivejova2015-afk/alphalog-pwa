// Evidence Timeline Stitching
// Cose evidencias con trades y reportes por fecha para reconstruir sesiones.

export interface TimelineItem {
  id: string;
  type: string;
  date: Date;
  refId?: string;
}

export function stitchTimeline(items: TimelineItem[]): TimelineItem[][] {
  // Agrupa por día
  const byDay: Record<string, TimelineItem[]> = {};
  for (const item of items) {
    const day = item.date.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(item);
  }
  return Object.values(byDay);
}
