// Sprint BB — visible banner when CME Globex is closed.
//
// The dispatcher cron already short-circuits when Globex is closed (Sprint S),
// so any "why isn't my futures algo trading?" from the user during a weekend
// or daily-maintenance window deserves an explanation. This banner makes the
// closure observable without the user digging through logs.
//
// Server component — `isGlobexOpen` is a pure function, evaluated at request
// time. No client-side polling needed; the page is re-rendered on navigation.

import { isGlobexOpen } from "@/lib/cme/market-hours";
import { InfoBanner } from "./InfoBanner.client";

export function GlobexStatusBanner() {
  if (isGlobexOpen()) return null;

  return (
    <InfoBanner tone="amber">
      <strong className="text-amber-300">CME Globex cerrado:</strong>{" "}
      el dispatcher de Tradovate no evalúa señales hasta que reabra. Globex corre
      Dom 18:00 ET → Vie 17:00 ET con un break diario 17:00–18:00 ET. Algos de
      forex (MT4/MT5) y crypto (Coinarb) no se ven afectados.
    </InfoBanner>
  );
}
