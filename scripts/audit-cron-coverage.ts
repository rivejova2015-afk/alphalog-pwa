// Audit: ¿qué endpoints cron existen vs cuáles están agendados?
//
// Lista todos los route.ts bajo src/app/api/ops/cron/ y src/app/api/cron/.
// Cross-referencia contra crontab (Fly sidecar) y .github/workflows/*.yml
// (GitHub Actions con `schedule:`).
//
// Exit code:
//   0 = todos los endpoints están agendados (excepto los marcados como one-shot).
//   1 = hay huérfanos no documentados.
//
// Uso:
//   npx tsx scripts/audit-cron-coverage.ts
//   npx tsx scripts/audit-cron-coverage.ts --json     # output JSON para CI

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REPO_ROOT      = process.cwd();
const CRON_DIRS      = ['src/app/api/ops/cron', 'src/app/api/cron'];
const CRONTAB_PATH   = 'crontab';
const WORKFLOWS_DIR  = '.github/workflows';
const ONE_SHOT_PATHS = new Set<string>([
  // Endpoints invocados manualmente, NO en cron recurrente.
  '/api/cron/security/backfill-encryption',
]);
const EXTRA_SCHEDULED = new Set<string>([
  // Endpoints en src/app/api/bot/* (no en /cron/) que sí están en crontab — se cuentan como cubiertos.
  '/api/bot/arbitrage/latency/run',
]);

function walk(dir: string, out: string[] = []): string[] {
  const abs = join(REPO_ROOT, dir);
  let entries: string[];
  try { entries = readdirSync(abs); } catch { return out; }
  for (const name of entries) {
    const full = join(abs, name);
    const rel  = relative(REPO_ROOT, full).split(sep).join('/');
    const st   = statSync(full);
    if (st.isDirectory()) walk(rel, out);
    else if (name === 'route.ts') out.push(rel);
  }
  return out;
}

function routeToPath(routeFile: string): string {
  // src/app/api/ops/cron/bot-slo-monitor/route.ts → /api/ops/cron/bot-slo-monitor
  return '/' + routeFile.replace(/^src\/app\//, '').replace(/\/route\.ts$/, '');
}

function readSafe(p: string): string {
  try { return readFileSync(join(REPO_ROOT, p), 'utf8'); } catch { return ''; }
}

function collectScheduledPaths(): Set<string> {
  const out = new Set<string>();

  // 1. crontab del sidecar
  const crontab = readSafe(CRONTAB_PATH);
  for (const line of crontab.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/(\/api\/[a-zA-Z0-9/_-]+)/);
    if (m) out.add(m[1]);
  }

  // 2. GitHub Actions workflows con `schedule:`
  let workflows: string[] = [];
  try { workflows = readdirSync(join(REPO_ROOT, WORKFLOWS_DIR)); } catch { /* no workflows dir */ }
  for (const wf of workflows) {
    if (!/\.ya?ml$/.test(wf)) continue;
    const body = readSafe(join(WORKFLOWS_DIR, wf));
    if (!/schedule\s*:/.test(body)) continue;
    for (const m of body.matchAll(/(\/api\/[a-zA-Z0-9/_-]+)/g)) out.add(m[1]);
  }

  return out;
}

function main() {
  const wantJson  = process.argv.includes('--json');
  const allRoutes = CRON_DIRS.flatMap((d) => walk(d).map(routeToPath));
  const scheduled = collectScheduledPaths();
  EXTRA_SCHEDULED.forEach((p) => scheduled.add(p));

  const orphans: string[] = [];
  const oneShot: string[] = [];
  for (const p of allRoutes) {
    if (scheduled.has(p)) continue;
    if (ONE_SHOT_PATHS.has(p)) oneShot.push(p);
    else orphans.push(p);
  }

  if (wantJson) {
    process.stdout.write(JSON.stringify({
      total_endpoints: allRoutes.length,
      scheduled:       allRoutes.length - orphans.length - oneShot.length,
      one_shot:        oneShot,
      orphans,
    }, null, 2) + '\n');
  } else {
    process.stdout.write(`Cron coverage audit\n`);
    process.stdout.write(`  Total endpoints:  ${allRoutes.length}\n`);
    process.stdout.write(`  Scheduled:        ${allRoutes.length - orphans.length - oneShot.length}\n`);
    process.stdout.write(`  One-shot (OK):    ${oneShot.length}${oneShot.length ? ' → ' + oneShot.join(', ') : ''}\n`);
    process.stdout.write(`  Orphans (FAIL):   ${orphans.length}\n`);
    for (const p of orphans) process.stdout.write(`    - ${p}\n`);
  }

  process.exit(orphans.length === 0 ? 0 : 1);
}

main();
