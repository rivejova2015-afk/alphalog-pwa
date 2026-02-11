// Evidence Quality Meter
// Score silencioso por evidencia (completa, bien etiquetada, vinculada).

export interface EvidenceQuality {
  id: string;
  complete: boolean;
  wellTagged: boolean;
  linked: boolean;
}

export function computeEvidenceQuality(evidence: EvidenceQuality): number {
  let score = 0;
  if (evidence.complete) score += 0.5;
  if (evidence.wellTagged) score += 0.3;
  if (evidence.linked) score += 0.2;
  return score;
}
