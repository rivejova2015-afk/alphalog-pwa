// Silent Integrity Watchdog
// Detecta inconsistencias (ej: trade existe pero no aparece en KPI/overview) y lanza reconstrucción automática del índice del usuario.
// No afecta la UI, solo registra y repara en background.

import { useEffect } from "react";

export function useIntegrityWatchdog(checkIntegrity: () => Promise<boolean>, repairIndex: () => Promise<void>, onLog?: (msg: string) => void) {
  useEffect(() => {
    let cancelled = false;
    async function run() {
      while (!cancelled) {
        const ok = await checkIntegrity();
        if (!ok) {
          onLog?.("Inconsistencia detectada. Reconstruyendo índice...");
          await repairIndex();
          onLog?.("Reconstrucción completada.");
        }
        await new Promise(res => setTimeout(res, 60000)); // 1 min
      }
    }
    run();
    return () => { cancelled = true; };
  }, [checkIntegrity, repairIndex, onLog]);
}
