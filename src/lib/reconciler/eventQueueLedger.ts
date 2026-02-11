// Event Queue Ledger
// Cola interna de eventos (TradeClosedSaved, MasterTradeLogged, ReportGenerated) con idempotencia.
// Evita duplicados y "fantasmas". No afecta la UI.

export type EventType = "TradeClosedSaved" | "MasterTradeLogged" | "ReportGenerated";

export interface EventLedgerEntry {
  id: string;
  type: EventType;
  payload: any;
  timestamp: number;
  processed: boolean;
}

export class EventQueueLedger {
  private queue: EventLedgerEntry[] = [];
  private processedIds: Set<string> = new Set();

  enqueue(event: EventLedgerEntry) {
    if (this.processedIds.has(event.id)) return; // idempotencia
    if (this.queue.find(e => e.id === event.id)) return; // evitar duplicados
    this.queue.push(event);
  }

  dequeue(): EventLedgerEntry | undefined {
    const event = this.queue.shift();
    if (event) this.processedIds.add(event.id);
    return event;
  }

  get length() {
    return this.queue.length;
  }

  get unprocessed() {
    return this.queue.filter(e => !e.processed);
  }

  markProcessed(id: string) {
    this.processedIds.add(id);
    const entry = this.queue.find(e => e.id === id);
    if (entry) entry.processed = true;
  }
}
