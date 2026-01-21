/**
 * SprintAudit - Generates comprehensive sprint status report
 * Checks files, endpoints, migrations against sprint definitions
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  SPRINT_DEFINITIONS,
  type FileCheck,
  type EndpointCheck,
  type MigrationCheck,
  type SprintDefinition,
} from './sprintDefinitions';

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
  fileRefs: string[];
}

export interface SprintAuditResult {
  id: number;
  name: string;
  description: string;
  status: 'ok' | 'partial' | 'missing';
  checks: CheckResult[];
  completeness: number; // 0-100%
}

export interface AuditReport {
  generatedAt: string;
  generatedBy: 'user' | 'system';
  repositoryInfo: {
    branch: string;
    commitHash?: string;
    path: string;
  };
  sprints: SprintAuditResult[];
  summary: {
    totalSprints: number;
    okSprints: number;
    partialSprints: number;
    missingSprints: number;
    overallCompleteness: number;
  };
  recommendations: string[];
}

class SprintAuditor {
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
  }

  /**
   * Check if file exists
   */
  private fileExists(path: string): boolean {
    try {
      return existsSync(join(this.repoPath, path));
    } catch {
      return false;
    }
  }

  /**
   * Check if endpoint exists (via route handler)
   */
  private endpointExists(endpoint: EndpointCheck): boolean {
    // Normalize path: /api/logs/ingest → src/app/api/logs/ingest/route.ts
    const pathParts = endpoint.path.split('/').filter(Boolean);
    const routePath = join(this.repoPath, 'src/app', ...pathParts, 'route.ts');
    return existsSync(routePath);
  }

  /**
   * Check if migration exists
   */
  private migrationExists(migration: MigrationCheck): boolean {
    const migrationsPath = join(this.repoPath, 'supabase', 'migrations');
    try {
      if (!existsSync(migrationsPath)) return false;
      const files = readdirSync(migrationsPath);
      return files.some((f) => f.includes(`${migration.number.toString().padStart(3, '0')}`));
    } catch {
      return false;
    }
  }

  /**
   * Audit single sprint
   */
  private auditSprint(sprint: SprintDefinition): SprintAuditResult {
    const checks: CheckResult[] = [];

    // Check files
    for (const file of sprint.files) {
      const exists = this.fileExists(file.path);
      checks.push({
        name: `File: ${file.path}`,
        ok: exists,
        detail: exists ? 'Found' : `Missing${file.required ? ' (REQUIRED)' : ''}`,
        fileRefs: [file.path],
      });
    }

    // Check endpoints
    for (const endpoint of sprint.endpoints) {
      const exists = this.endpointExists(endpoint);
      checks.push({
        name: `Endpoint: ${endpoint.method} ${endpoint.path}`,
        ok: exists,
        detail: exists ? 'Found' : `Missing${endpoint.required ? ' (REQUIRED)' : ''}`,
        fileRefs: [endpoint.path],
      });
    }

    // Check migrations
    for (const migration of sprint.migrations) {
      const exists = this.migrationExists(migration);
      checks.push({
        name: `Migration: ${migration.name}`,
        ok: exists,
        detail: exists ? 'Found' : `Missing${migration.required ? ' (REQUIRED)' : ''}`,
        fileRefs: migration.tables.map((t) => `table:${t}`),
      });
    }

    // Calculate completeness
    const requiredChecks = checks.filter((c) => {
      const checkName = c.name;
      const isRequired =
        sprint.files.some((f) => `File: ${f.path}` === checkName && f.required) ||
        sprint.endpoints.some((e) => `Endpoint: ${e.method} ${e.path}` === checkName && e.required) ||
        sprint.migrations.some((m) => `Migration: ${m.name}` === checkName && m.required);
      return isRequired;
    });

    const okRequiredChecks = requiredChecks.filter((c) => c.ok).length;
    const completeness = requiredChecks.length > 0 ? Math.round((okRequiredChecks / requiredChecks.length) * 100) : 100;

    // Determine status
    let status: 'ok' | 'partial' | 'missing' = 'ok';
    if (completeness < 100) {
      status = completeness >= 50 ? 'partial' : 'missing';
    }

    return {
      id: sprint.id,
      name: sprint.name,
      description: sprint.description,
      status,
      checks,
      completeness,
    };
  }

  /**
   * Generate full audit report
   */
  async generateReport(generatedBy: 'user' | 'system' = 'system'): Promise<AuditReport> {
    const sprints = Object.values(SPRINT_DEFINITIONS)
      .sort((a, b) => a.id - b.id)
      .map((sprint) => this.auditSprint(sprint));

    const okSprints = sprints.filter((s) => s.status === 'ok').length;
    const partialSprints = sprints.filter((s) => s.status === 'partial').length;
    const missingSprints = sprints.filter((s) => s.status === 'missing').length;
    const overallCompleteness = Math.round(
      sprints.reduce((sum, s) => sum + s.completeness, 0) / sprints.length,
    );

    // Generate recommendations
    const recommendations: string[] = [];
    if (missingSprints > 0) {
      recommendations.push(
        `⚠️ ${missingSprints} sprint(s) con <50% completeness. Priorizar: ${sprints
          .filter((s) => s.status === 'missing')
          .map((s) => `Sprint ${s.id}`)
          .join(', ')}`,
      );
    }
    if (partialSprints > 0) {
      recommendations.push(
        `📋 ${partialSprints} sprint(s) parcialmente completados (50-99%). Revisar: ${sprints
          .filter((s) => s.status === 'partial')
          .map((s) => `Sprint ${s.id}`)
          .join(', ')}`,
      );
    }
    if (overallCompleteness === 100) {
      recommendations.push('✅ Todos los sprints completados correctamente');
    } else if (overallCompleteness >= 75) {
      recommendations.push('👍 Progreso satisfactorio (75-99%)');
    } else if (overallCompleteness >= 50) {
      recommendations.push('⚠️ Progreso moderado (50-74%). Acelerar completación');
    } else {
      recommendations.push('🔴 Progreso crítico (<50%). Replanificar sprints');
    }

    return {
      generatedAt: new Date().toISOString(),
      generatedBy,
      repositoryInfo: {
        branch: 'main', // TODO: obtener de git
        path: this.repoPath,
      },
      sprints,
      summary: {
        totalSprints: sprints.length,
        okSprints,
        partialSprints,
        missingSprints,
        overallCompleteness,
      },
      recommendations,
    };
  }

  /**
   * Generate human-readable report
   */
  async generateMarkdownReport(report: AuditReport): Promise<string> {
    let md = `# Sprint Audit Report\n\n`;
    md += `**Generated**: ${new Date(report.generatedAt).toLocaleString()}\n`;
    md += `**Path**: ${report.repositoryInfo.path}\n\n`;

    // Summary
    md += `## 📊 Summary\n\n`;
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| Total Sprints | ${report.summary.totalSprints} |\n`;
    md += `| ✅ Complete | ${report.summary.okSprints} |\n`;
    md += `| ⚠️ Partial | ${report.summary.partialSprints} |\n`;
    md += `| ❌ Missing | ${report.summary.missingSprints} |\n`;
    md += `| Overall | ${report.summary.overallCompleteness}% |\n\n`;

    // Recommendations
    md += `## 💡 Recommendations\n\n`;
    report.recommendations.forEach((rec) => {
      md += `- ${rec}\n`;
    });
    md += '\n';

    // Details per sprint
    md += `## 🎯 Sprint Details\n\n`;
    for (const sprint of report.sprints) {
      const statusBadge = sprint.status === 'ok' ? '✅' : sprint.status === 'partial' ? '⚠️' : '❌';
      md += `### ${statusBadge} Sprint ${sprint.id}: ${sprint.name}\n\n`;
      md += `**Status**: ${sprint.status} (${sprint.completeness}%)\n\n`;

      md += `| Check | Result |\n`;
      md += `|-------|--------|\n`;
      for (const check of sprint.checks) {
        const checkMark = check.ok ? '✅' : '❌';
        md += `| ${check.name} | ${checkMark} ${check.detail} |\n`;
      }
      md += '\n';
    }

    return md;
  }
}

/**
 * Función principal: generar audit
 */
export async function auditSprints(): Promise<AuditReport> {
  const auditor = new SprintAuditor(process.cwd());
  return auditor.generateReport('system');
}

/**
 * Función: generar markdown
 */
export async function auditSprintsMarkdown(): Promise<string> {
  const auditor = new SprintAuditor(process.cwd());
  const report = await auditor.generateReport('system');
  return auditor.generateMarkdownReport(report);
}

export { SprintAuditor };
