// Threshold Presets + Versioning
// Presets “Conservador / Balanceado / Estricto” para thresholds, con versionado y rollback tipo git.

export type ThresholdPreset = "conservador" | "balanceado" | "estricto";

export interface ThresholdVersion {
  id: string;
  preset: ThresholdPreset;
  values: Record<string, number>;
  createdAt: Date;
}

export class ThresholdVersioning {
  private versions: ThresholdVersion[] = [];

  addVersion(preset: ThresholdPreset, values: Record<string, number>) {
    this.versions.push({
      id: `${preset}-${Date.now()}`,
      preset,
      values,
      createdAt: new Date()
    });
  }

  getLatest(): ThresholdVersion | undefined {
    return this.versions[this.versions.length - 1];
  }

  rollback() {
    if (this.versions.length > 1) this.versions.pop();
  }

  getAll() {
    return this.versions;
  }
}
