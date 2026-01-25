'use client';

/**
 * Safe Mode Banner
 * Discretely displayed at top of dashboard when safe mode is active
 */

import React, { useEffect, useState } from 'react';
import { useSafeModeStatus, attemptAlphaShieldRecovery } from '@/lib/alphashield/safeMode';

export default function SafeModeBanner() {
  const [active, exitSafeMode] = useSafeModeStatus();
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    if (!active) return;
    attemptAlphaShieldRecovery(false).catch(() => {
      // Recovery is best-effort
    });
  }, [active]);

  if (!active) {
    return null;
  }

  const handleExit = () => {
    exitSafeMode();
  };

  const handleRecover = async () => {
    setIsRecovering(true);
    await attemptAlphaShieldRecovery(true);
    setIsRecovering(false);
  };

  return (
    <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <span className="text-orange-600 text-lg">⚠️</span>
          </div>
          <div>
            <p className="text-sm font-medium text-orange-900">
              Modo seguro activo (solo lectura)
            </p>
            <p className="text-xs text-orange-800">
              Se detectó un loop de errores. Las operaciones de escritura están deshabilitadas.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRecover}
            disabled={isRecovering}
            className="flex-shrink-0 px-3 py-2 text-sm font-medium text-orange-700 bg-white border border-orange-200 rounded hover:bg-orange-100 transition disabled:opacity-60"
          >
            {isRecovering ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button
            onClick={handleExit}
            className="flex-shrink-0 px-3 py-2 text-sm font-medium text-white bg-orange-600 rounded hover:bg-orange-700 transition"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
