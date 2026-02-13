// Offline Queue for Creates
// Guarda operaciones (trades/evidence/report requests) offline y sincroniza después con idempotencia.

export interface OfflineCreate {
  id: string;
  type: "trade" | "evidence" | "report";
  payload: unknown;
  synced: boolean;
}

export class OfflineQueue {
  private queue: OfflineCreate[] = [];

  add(item: OfflineCreate) {
    this.queue.push(item);
  }

  getPending() {
    return this.queue.filter(i => !i.synced);
  }

  markSynced(id: string) {
    const item = this.queue.find(i => i.id === id);
    if (item) item.synced = true;
  }
}
