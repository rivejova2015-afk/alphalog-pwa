#!/usr/bin/env node
/**
 * Sprint Audit Script (JavaScript version)
 * Compara lo planeado (MIGRATION_PLAN.md) vs lo implementado (código real)
 * Genera docs/SPRINT_AUDIT.md con resultado completo
 */

const fs = require('fs');
const path = require('path');

// Helper: read file safely
function readFileIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

// Helper: find all route files
function findRoutes(baseDir = 'src/app') {
  const routes = [];

  function traverse(dir, prefix = '') {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item.startsWith('.') || item === 'node_modules') continue;

        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const newPrefix = prefix ? `${prefix}/${item}` : `/${item}`;
          traverse(fullPath, newPrefix);

          // Check for page.tsx, layout.tsx, etc.
          const pageFile = path.join(fullPath, 'page.tsx');
          if (fs.existsSync(pageFile)) {
            const routePath = newPrefix === '/' ? '/' : newPrefix;
            routes.push(routePath);
          }
        }
      }
    } catch (e) {
      // Silently skip errors
    }
  }

  traverse(baseDir);
  return routes.sort();
}

// Helper: find all API endpoints
function findEndpoints(apiDir = 'src/app/api') {
  const endpoints = [];

  function traverse(dir, prefix = '') {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item.startsWith('.') || item === 'node_modules') continue;

        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const newPrefix = prefix ? `${prefix}/${item}` : `/${item}`;
          traverse(fullPath, newPrefix);

          // Check for route.ts, route.js
          const routeFile = path.join(fullPath, 'route.ts');
          const routeFileJs = path.join(fullPath, 'route.js');
          if (fs.existsSync(routeFile) || fs.existsSync(routeFileJs)) {
            endpoints.push(`/api${newPrefix}`);
          }
        } else if (item === 'route.ts' || item === 'route.js') {
          endpoints.push(`/api${prefix}`);
        }
      }
    } catch (e) {
      // Silently skip errors
    }
  }

  if (fs.existsSync(apiDir)) {
    traverse(apiDir);
  }
  return endpoints.sort();
}

// Helper: find migrations
function findMigrations(migrationsDir = 'supabase/migrations') {
  const migrations = [];

  try {
    const files = fs.readdirSync(migrationsDir);
    for (const file of files) {
      if (file.endsWith('.sql')) {
        migrations.push(file);
      }
    }
  } catch (e) {
    // Silently skip if directory doesn't exist
  }

  return migrations.sort();
}

// Helper: find edge functions
function findEdgeFunctions(functionsDir = 'supabase/functions') {
  const functions = [];

  try {
    const items = fs.readdirSync(functionsDir);
    for (const item of items) {
      if (!item.startsWith('.')) {
        const fullPath = path.join(functionsDir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          functions.push(item);
        }
      }
    }
  } catch (e) {
    // Silently skip if directory doesn't exist
  }

  return functions.sort();
}

// Extract planned items from MIGRATION_PLAN.md
function extractPlannedSprints() {
  const sprints = {
    1: {
      number: 1,
      name: 'Proyecto Base + Supabase Setup',
      expectedRoutes: ['/'],
      expectedEndpoints: [],
      expectedMigrations: ['001_init_schema.sql'],
      expectedFunctions: [],
    },
    2: {
      number: 2,
      name: 'Supabase Auth + Middleware',
      expectedRoutes: ['/', '/auth/login', '/auth/signup', '/dashboard'],
      expectedEndpoints: ['/api/auth/logout'],
      expectedMigrations: [],
      expectedFunctions: [],
    },
    3: {
      number: 3,
      name: 'Dashboard + Accounts + Analytics',
      expectedRoutes: [
        '/',
        '/auth/login',
        '/auth/signup',
        '/dashboard',
        '/dashboard/accounts',
        '/dashboard/analytics',
      ],
      expectedEndpoints: [],
      expectedMigrations: [],
      expectedFunctions: [],
    },
    4: {
      number: 4,
      name: 'Terminal + Journal + Goals + Setups',
      expectedRoutes: [
        '/',
        '/dashboard',
        '/dashboard/terminal',
        '/dashboard/journal',
        '/dashboard/goals',
        '/dashboard/setups',
      ],
      expectedEndpoints: [],
      expectedMigrations: [],
      expectedFunctions: [],
    },
    5: {
      number: 5,
      name: 'Server Functions + Real-time Data',
      expectedRoutes: [],
      expectedEndpoints: ['/api/webhooks/mt5'],
      expectedMigrations: [],
      expectedFunctions: ['receive-mt5-data', 'generate-scheduled-report'],
    },
    6: {
      number: 6,
      name: 'PWA + Offline + Push',
      expectedRoutes: [],
      expectedEndpoints: [],
      expectedMigrations: [],
      expectedFunctions: [],
    },
  };

  return sprints;
}

// Determine sprint coverage based on implemented items
function determineSprints(routes, endpoints, migrations, functions) {
  const coveredSprints = new Set();

  // Sprint 1: has any migration
  if (migrations.length > 0) coveredSprints.add(1);

  // Sprint 2: has auth routes or auth endpoint
  if (
    routes.some(r => r.includes('/auth')) ||
    endpoints.some(e => e.includes('/auth'))
  ) {
    coveredSprints.add(2);
  }

  // Sprint 3: has accounts or analytics
  if (
    routes.some(r => r.includes('/accounts') || r.includes('/analytics')) ||
    routes.includes('/dashboard')
  ) {
    coveredSprints.add(3);
  }

  // Sprint 4: has terminal, journal, goals, setups
  if (
    routes.some(r =>
      ['/terminal', '/journal', '/goals', '/setups', '/tradehub', '/tradermap', '/business', '/logs', '/treasury'].some(
        x => r.includes(x)
      )
    )
  ) {
    coveredSprints.add(4);
  }

  // Sprint 5: has webhooks or edge functions
  if (
    endpoints.some(e => e.includes('/webhooks')) ||
    functions.length > 0
  ) {
    coveredSprints.add(5);
  }

  // Sprint 6: check for PWA files
  if (fs.existsSync('public/sw.js') && fs.existsSync('src/app/manifest.ts')) {
    coveredSprints.add(6);
  }

  return Array.from(coveredSprints).sort((a, b) => a - b);
}

// Main audit function
function runAudit() {
  console.log('🔍 Starting Sprint Audit...\n');

  const routes = findRoutes();
  const endpoints = findEndpoints();
  const migrations = findMigrations();
  const functions = findEdgeFunctions();
  const plannedSprints = extractPlannedSprints();
  const coveredSprints = determineSprints(routes, endpoints, migrations, functions);

  console.log(`✅ Found ${routes.length} routes`);
  console.log(`✅ Found ${endpoints.length} endpoints`);
  console.log(`✅ Found ${migrations.length} migrations`);
  console.log(`✅ Found ${functions.length} edge functions`);
  console.log(`✅ Sprints covered: ${coveredSprints.join(', ')}\n`);

  const result = {
    sprints: {},
    timestamp: new Date().toISOString(),
  };

  // Evaluate each sprint
  for (let i = 1; i <= 6; i++) {
    const plan = plannedSprints[i];
    const isCovered = coveredSprints.includes(i);

    let status = 'pending';
    const details = [];

    if (isCovered) {
      // Check completion level
      const plannedRouteCount = plan.expectedRoutes.length;
      const plannedEndpointCount = plan.expectedEndpoints.length;

      const implementedRoutesMatch = routes.filter(r =>
        plan.expectedRoutes.some(pr => pr === r || r.includes(pr))
      ).length;

      const implementedEndpointsMatch = endpoints.filter(e =>
        plan.expectedEndpoints.some(pe => pe === e || e.includes(pe))
      ).length;

      if (
        implementedRoutesMatch >= Math.ceil(plannedRouteCount * 0.8) &&
        implementedEndpointsMatch >= Math.ceil(plannedEndpointCount * 0.8)
      ) {
        status = 'completed';
        details.push(`✅ Routes: ${implementedRoutesMatch}/${plannedRouteCount}`);
        details.push(`✅ Endpoints: ${implementedEndpointsMatch}/${plannedEndpointCount}`);
      } else {
        status = 'partial';
        details.push(`⚠️ Routes: ${implementedRoutesMatch}/${plannedRouteCount}`);
        details.push(`⚠️ Endpoints: ${implementedEndpointsMatch}/${plannedEndpointCount}`);
      }
    } else {
      status = 'pending';
      details.push('❌ No implementation found');
    }

    result.sprints[i] = {
      plan,
      implemented: {
        routes: routes.filter(r =>
          plan.expectedRoutes.some(pr => pr === r || r.includes(pr))
        ),
        endpoints: endpoints.filter(e =>
          plan.expectedEndpoints.some(pe => pe === e || e.includes(pe))
        ),
        migrations: migrations.filter(m =>
          plan.expectedMigrations.some(pm => m.includes(pm.replace('.sql', '')))
        ),
        functions: functions.filter(f =>
          plan.expectedFunctions.some(pf => f === pf || f.includes(pf))
        ),
      },
      status,
      details,
    };
  }

  return result;
}

// Generate markdown report
function generateMarkdownReport(auditResult) {
  const completedCount = Object.values(auditResult.sprints).filter(
    s => s.status === 'completed'
  ).length;
  const partialCount = Object.values(auditResult.sprints).filter(
    s => s.status === 'partial'
  ).length;

  let markdown = `# Sprint Audit Report

**Generated**: ${new Date(auditResult.timestamp).toLocaleString()}

## Summary

| Status | Count |
|--------|-------|
| ✅ Completed | ${completedCount} |
| ⚠️ Partial | ${partialCount} |
| ❌ Pending | ${6 - completedCount - partialCount} |

---

`;

  for (let i = 1; i <= 6; i++) {
    const sprint = auditResult.sprints[i];
    const statusIcon =
      sprint.status === 'completed' ? '✅' : sprint.status === 'partial' ? '⚠️' : '❌';

    markdown += `## ${statusIcon} Sprint ${sprint.plan.number}: ${sprint.plan.name}

**Status**: ${sprint.status.toUpperCase()}

### Details
${sprint.details.map(d => `- ${d}`).join('\n')}

### Implemented
`;

    if (sprint.implemented.routes.length > 0) {
      markdown += `\n#### Routes\n${sprint.implemented.routes.map(r => `- [${r}](../src/app${r})`).join('\n')}\n`;
    }

    if (sprint.implemented.endpoints.length > 0) {
      markdown += `\n#### Endpoints\n${sprint.implemented.endpoints.map(e => `- [${e}](../src/app/api${e.replace('/api', '')})`).join('\n')}\n`;
    }

    if (sprint.implemented.migrations.length > 0) {
      markdown += `\n#### Migrations\n${sprint.implemented.migrations.map(m => `- [${m}](../supabase/migrations/${m})`).join('\n')}\n`;
    }

    if (sprint.implemented.functions.length > 0) {
      markdown += `\n#### Functions\n${sprint.implemented.functions.map(f => `- [${f}](../supabase/functions/${f})`).join('\n')}\n`;
    }

    markdown += '\n---\n\n';
  }

  markdown += `## Summary Statistics

### Actual Implementation
- **Routes**: ${Object.values(auditResult.sprints)
    .flatMap(s => s.implemented.routes)
    .filter((v, i, a) => a.indexOf(v) === i).length}
- **Endpoints**: ${Object.values(auditResult.sprints)
    .flatMap(s => s.implemented.endpoints)
    .filter((v, i, a) => a.indexOf(v) === i).length}
- **Migrations**: ${Object.values(auditResult.sprints)
    .flatMap(s => s.implemented.migrations)
    .filter((v, i, a) => a.indexOf(v) === i).length}
- **Edge Functions**: ${Object.values(auditResult.sprints)
    .flatMap(s => s.implemented.functions)
    .filter((v, i, a) => a.indexOf(v) === i).length}

---

**Audit Method**: Automated script analyzing source code, migrations, and endpoints.
See \`scripts/sprint-audit.js\` for details.
`;

  return markdown;
}

// Main execution
function main() {
  try {
    const auditResult = runAudit();
    const markdown = generateMarkdownReport(auditResult);

    // Ensure docs directory exists
    if (!fs.existsSync('docs')) {
      fs.mkdirSync('docs', { recursive: true });
    }

    // Write report
    fs.writeFileSync('docs/SPRINT_AUDIT.md', markdown, 'utf-8');
    console.log('✅ Report generated: docs/SPRINT_AUDIT.md\n');

    // Console output
    console.log('📊 Audit Results:');
    for (let i = 1; i <= 6; i++) {
      const sprint = auditResult.sprints[i];
      const statusIcon =
        sprint.status === 'completed' ? '✅' : sprint.status === 'partial' ? '⚠️' : '❌';
      console.log(`  ${statusIcon} Sprint ${i}: ${sprint.status.toUpperCase()}`);
    }
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

main();
