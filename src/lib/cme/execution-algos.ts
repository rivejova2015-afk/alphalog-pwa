// Execution algorithms — slicing planners para órdenes de tamaño en Tradovate.
//
// Este módulo entrega **planners puros**: funciones que toman una signal +
// parámetros y devuelven un schedule de slices (timestamps + quantities).
// La conexión con el order-executor real (placeMarketOrder + lifecycle de
// fills/cancels) queda para sigueinte sesión — ese trabajo es scope L y
// requiere modificar el dispatcher para que iterate el schedule.
//
// Algoritmos:
//   1. TWAP (Time-Weighted Average Price): slices uniformes en tiempo.
//   2. VWAP (Volume-Weighted Average Price): slices proporcionales al perfil
//      de volumen histórico intraday (requiere volume profile data).
//   3. IS (Implementation Shortfall): front-loaded para minimizar timing risk,
//      con urgency configurable.
//
// Referencia: Johnson, "Algorithmic Trading and DMA" (cap 5-7).

export interface ExecutionSlice {
  /** Timestamp UTC ISO. La 1ra slice es ahora; las demás son offsets. */
  scheduledAt: string;
  /** Cantidad de contratos para esta slice. Suma de todas = qty total. */
  quantity: number;
  /** Índice de la slice (0-based) para audit. */
  sliceIndex: number;
}

export interface SchedulePlan {
  algo: "twap" | "vwap" | "is";
  totalQuantity: number;
  totalSlices: number;
  durationMinutes: number;
  slices: ExecutionSlice[];
  /** Seteado solo cuando planVwap cayó a distribución uniforme por un
   *  volumeProfile inutilizable — permite al caller loguear que VWAP no
   *  operó como VWAP esta vez, en vez de degradar en silencio. */
  fallbackReason?: string;
}

export interface TwapParams {
  totalQuantity: number;
  durationMinutes: number;
  sliceCount: number;
  /** Default: now. Override para tests / replay. */
  startAt?: Date;
}

/**
 * planTwap — divide la orden total en `sliceCount` slices distribuidas
 * uniformemente a lo largo de `durationMinutes`. Si `totalQuantity` no es
 * divisible exactamente por `sliceCount`, los primeros (totalQuantity %
 * sliceCount) slices reciben +1 contract para que la suma sea exacta.
 */
export function planTwap(params: TwapParams): SchedulePlan {
  const { totalQuantity, durationMinutes, sliceCount } = params;
  if (totalQuantity < 1) throw new Error("totalQuantity must be >= 1");
  if (sliceCount < 1) throw new Error("sliceCount must be >= 1");
  if (durationMinutes < 0) throw new Error("durationMinutes must be >= 0");
  const effectiveSliceCount = Math.min(sliceCount, totalQuantity);

  const baseQty = Math.floor(totalQuantity / effectiveSliceCount);
  const remainder = totalQuantity % effectiveSliceCount;
  const start = params.startAt ?? new Date();
  const intervalMs =
    effectiveSliceCount > 1
      ? (durationMinutes * 60 * 1000) / (effectiveSliceCount - 1)
      : 0;

  const slices: ExecutionSlice[] = [];
  for (let i = 0; i < effectiveSliceCount; i++) {
    const qty = baseQty + (i < remainder ? 1 : 0);
    const ts = new Date(start.getTime() + i * intervalMs);
    slices.push({
      scheduledAt: ts.toISOString(),
      quantity: qty,
      sliceIndex: i,
    });
  }

  return {
    algo: "twap",
    totalQuantity,
    totalSlices: effectiveSliceCount,
    durationMinutes,
    slices,
  };
}

export interface VwapParams {
  totalQuantity: number;
  durationMinutes: number;
  sliceCount: number;
  /** Perfil de volumen — array de pesos por bucket. Suma se normaliza. */
  volumeProfile: number[];
  startAt?: Date;
}

/**
 * planVwap — distribuye la orden proporcional al `volumeProfile`. El profile
 * típicamente viene del histórico intraday de los últimos N días para el
 * símbolo (ej. ES tradea más al open + close, menos al mediodía).
 *
 * Sin `volumeProfile` válido (vacío o NaN), cae a TWAP — el caller debería
 * cargar el profile desde `historical_bars` antes de invocar.
 */
export function planVwap(params: VwapParams): SchedulePlan {
  const { totalQuantity, durationMinutes, sliceCount, volumeProfile } = params;
  if (totalQuantity < 1) throw new Error("totalQuantity must be >= 1");

  // Fallback: si el profile es inutilizable, hacemos TWAP. Un profile real
  // (agregado por hora UTC desde barras históricas) puede tener buckets en
  // exactamente 0 para horas sin barras — ej. la ventana de mantenimiento
  // diario de Globex — así que esto ocurre en producción, no solo en tests.
  const cleanProfile = volumeProfile.filter((v) => Number.isFinite(v) && v > 0);
  if (cleanProfile.length === 0 || cleanProfile.length !== sliceCount) {
    const twap = planTwap({ totalQuantity, durationMinutes, sliceCount, startAt: params.startAt });
    return { ...twap, algo: "vwap", fallbackReason: "sparse_volume_profile" };
  }

  const sum = cleanProfile.reduce((a, b) => a + b, 0);
  const weights = cleanProfile.map((v) => v / sum);

  // Distribuir contratos proporcionales, redondeando al entero y ajustando
  // el residuo en los buckets con mayor peso.
  const rawQtys = weights.map((w) => w * totalQuantity);
  const flooredQtys = rawQtys.map((q) => Math.floor(q));
  let remainder = totalQuantity - flooredQtys.reduce((a, b) => a + b, 0);
  const sortedByRem = rawQtys
    .map((q, i) => ({ i, rem: q - Math.floor(q) }))
    .sort((a, b) => b.rem - a.rem);
  for (const { i } of sortedByRem) {
    if (remainder <= 0) break;
    flooredQtys[i] += 1;
    remainder -= 1;
  }

  const start = params.startAt ?? new Date();
  const intervalMs =
    sliceCount > 1 ? (durationMinutes * 60 * 1000) / (sliceCount - 1) : 0;

  const slices: ExecutionSlice[] = [];
  let sliceIndex = 0;
  for (let i = 0; i < sliceCount; i++) {
    if (flooredQtys[i] <= 0) continue;
    const ts = new Date(start.getTime() + i * intervalMs);
    slices.push({
      scheduledAt: ts.toISOString(),
      quantity: flooredQtys[i],
      sliceIndex: sliceIndex++,
    });
  }

  return {
    algo: "vwap",
    totalQuantity,
    totalSlices: slices.length,
    durationMinutes,
    slices,
  };
}

export interface IsParams {
  totalQuantity: number;
  durationMinutes: number;
  sliceCount: number;
  /** Urgency 0-1: 0 = sin urgencia (TWAP-like), 1 = ejecutar al inicio.
   *  Default 0.5 = front-loaded moderado (decay exponencial). */
  urgency?: number;
  startAt?: Date;
}

/**
 * planIs — Implementation Shortfall: minimiza el riesgo de timing concentrando
 * la ejecución al inicio del horizonte. La distribución se calcula con un decay
 * exponencial controlado por `urgency`:
 *
 *   weight_i = exp(-urgency * 2 * i / sliceCount)
 *
 * urgency=0 → todos los pesos iguales (= TWAP).
 * urgency=1 → fuerte front-loading: ~63% en el primer 1/3 del horizonte.
 */
export function planIs(params: IsParams): SchedulePlan {
  const { totalQuantity, durationMinutes, sliceCount } = params;
  const urgency = Math.max(0, Math.min(1, params.urgency ?? 0.5));

  if (totalQuantity < 1) throw new Error("totalQuantity must be >= 1");
  if (sliceCount < 1) throw new Error("sliceCount must be >= 1");

  const effectiveSliceCount = Math.min(sliceCount, totalQuantity);
  const weights: number[] = [];
  for (let i = 0; i < effectiveSliceCount; i++) {
    const w = Math.exp((-urgency * 2 * i) / effectiveSliceCount);
    weights.push(w);
  }
  const sumW = weights.reduce((a, b) => a + b, 0);

  const rawQtys = weights.map((w) => (w / sumW) * totalQuantity);
  const flooredQtys = rawQtys.map((q) => Math.floor(q));
  let remainder = totalQuantity - flooredQtys.reduce((a, b) => a + b, 0);
  const sortedByRem = rawQtys
    .map((q, i) => ({ i, rem: q - Math.floor(q) }))
    .sort((a, b) => b.rem - a.rem);
  for (const { i } of sortedByRem) {
    if (remainder <= 0) break;
    flooredQtys[i] += 1;
    remainder -= 1;
  }

  const start = params.startAt ?? new Date();
  const intervalMs =
    effectiveSliceCount > 1
      ? (durationMinutes * 60 * 1000) / (effectiveSliceCount - 1)
      : 0;

  const slices: ExecutionSlice[] = [];
  let sliceIndex = 0;
  for (let i = 0; i < effectiveSliceCount; i++) {
    if (flooredQtys[i] <= 0) continue;
    const ts = new Date(start.getTime() + i * intervalMs);
    slices.push({
      scheduledAt: ts.toISOString(),
      quantity: flooredQtys[i],
      sliceIndex: sliceIndex++,
    });
  }

  return {
    algo: "is",
    totalQuantity,
    totalSlices: slices.length,
    durationMinutes,
    slices,
  };
}
