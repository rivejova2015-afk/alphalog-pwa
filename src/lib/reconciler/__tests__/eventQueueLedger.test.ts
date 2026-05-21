import { describe, it, expect, beforeEach } from "vitest";
import { EventQueueLedger, type EventLedgerEntry } from "../eventQueueLedger";

function makeEvent(overrides: Partial<EventLedgerEntry> = {}): EventLedgerEntry {
  return {
    id: `e-${Math.random()}`,
    type: "TradeClosedSaved",
    payload: { foo: "bar" },
    timestamp: Date.now(),
    processed: false,
    ...overrides,
  };
}

describe("EventQueueLedger", () => {
  let ledger: EventQueueLedger;

  beforeEach(() => {
    ledger = new EventQueueLedger();
  });

  describe("enqueue", () => {
    it("agrega evento nuevo a la cola", () => {
      ledger.enqueue(makeEvent({ id: "e1" }));
      expect(ledger.length).toBe(1);
    });

    it("ignora evento con id ya processed (idempotencia)", () => {
      const e = makeEvent({ id: "e1" });
      ledger.enqueue(e);
      ledger.dequeue(); // processed
      ledger.enqueue(makeEvent({ id: "e1" })); // mismo id → ignorado
      expect(ledger.length).toBe(0);
    });

    it("ignora duplicados en la cola actual", () => {
      ledger.enqueue(makeEvent({ id: "e1" }));
      ledger.enqueue(makeEvent({ id: "e1" }));
      expect(ledger.length).toBe(1);
    });

    it("acepta los 3 tipos de event", () => {
      ledger.enqueue(makeEvent({ id: "a", type: "TradeClosedSaved" }));
      ledger.enqueue(makeEvent({ id: "b", type: "MasterTradeLogged" }));
      ledger.enqueue(makeEvent({ id: "c", type: "ReportGenerated" }));
      expect(ledger.length).toBe(3);
    });
  });

  describe("dequeue", () => {
    it("retorna el primer evento (FIFO)", () => {
      ledger.enqueue(makeEvent({ id: "first" }));
      ledger.enqueue(makeEvent({ id: "second" }));
      expect(ledger.dequeue()?.id).toBe("first");
      expect(ledger.dequeue()?.id).toBe("second");
    });

    it("retorna undefined cuando cola vacía", () => {
      expect(ledger.dequeue()).toBeUndefined();
    });

    it("dequeue marca el id como processed (no se puede re-enqueue)", () => {
      ledger.enqueue(makeEvent({ id: "x" }));
      ledger.dequeue();
      ledger.enqueue(makeEvent({ id: "x" }));
      expect(ledger.length).toBe(0);
    });
  });

  describe("length / unprocessed", () => {
    it("length refleja eventos en cola", () => {
      expect(ledger.length).toBe(0);
      ledger.enqueue(makeEvent());
      ledger.enqueue(makeEvent());
      expect(ledger.length).toBe(2);
    });

    it("unprocessed filtra processed=true", () => {
      ledger.enqueue(makeEvent({ id: "a" }));
      ledger.enqueue(makeEvent({ id: "b" }));
      ledger.markProcessed("a");
      const r = ledger.unprocessed;
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe("b");
    });
  });

  describe("markProcessed", () => {
    it("marca el entry en queue como processed=true", () => {
      ledger.enqueue(makeEvent({ id: "x" }));
      ledger.markProcessed("x");
      expect(ledger.unprocessed).toHaveLength(0);
    });

    it("agrega id a processedIds aunque no esté en queue", () => {
      ledger.markProcessed("ghost");
      // Intentar enqueue después no debería re-agregar
      ledger.enqueue(makeEvent({ id: "ghost" }));
      expect(ledger.length).toBe(0);
    });
  });
});
