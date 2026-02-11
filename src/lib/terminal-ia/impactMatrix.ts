// Impact Matrix Interna
// Produce una matriz estructurada (tema→impacto→sesgo→confianza) para sentiment_score.

export interface ImpactMatrixRow {
  topic: string;
  impact: string;
  bias: string;
  confidence: number;
}

export function buildImpactMatrix(news: { topic: string; impact: string; bias: string; confidence: number }[]): ImpactMatrixRow[] {
  return news.map(n => ({
    topic: n.topic,
    impact: n.impact,
    bias: n.bias,
    confidence: n.confidence
  }));
}
