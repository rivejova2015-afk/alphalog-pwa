/**
 * AlphaShield Codex Fix Prompt Generator
 * Generates self-contained prompts for Claude/GPT to help fix issues
 */

import { getUnsentLogs } from './queue';
import { DebugBundle } from './debugBundle';

interface ErrorSummary {
  area: string;
  message: string;
  fingerprint: string;
  count: number;
  lastOccurred: string;
}

/**
 * Generate error summary (group by fingerprint)
 */
async function generateErrorSummary(): Promise<ErrorSummary[]> {
  try {
    const logs = await getUnsentLogs();
    const errors = logs.filter(log => log.level === 'error');

    // Group by fingerprint
    const grouped = new Map<string, typeof errors>();
    for (const error of errors) {
      if (!grouped.has(error.fingerprint)) {
        grouped.set(error.fingerprint, []);
      }
      grouped.get(error.fingerprint)!.push(error);
    }

    // Create summaries
    const summaries: ErrorSummary[] = [];
    for (const [fingerprint, groupedErrors] of grouped.entries()) {
      const latest = groupedErrors[groupedErrors.length - 1];
      summaries.push({
        area: latest.area,
        message: latest.message,
        fingerprint,
        count: groupedErrors.length,
        lastOccurred: new Date(latest.timestamp).toISOString(),
      });
    }

    return summaries.sort((a, b) => b.count - a.count).slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Infer files involved based on error area
 */
function inferFilesFromArea(area: string): string[] {
  const areaFileMap: Record<string, string[]> = {
    // Core app
    auth: ['src/app/(auth)/', 'src/lib/auth/', 'middleware.ts'],
    pwa: ['src/app/manifest.ts', 'public/sw.js', 'next.config.ts'],

    // Dashboard
    dashboard: ['src/app/(dashboard)/page.tsx', 'src/components/dashboard/'],
    logs: ['src/app/dashboard/logs/', 'src/lib/alphashield/'],

    // Trading modules
    tradehub: ['src/app/dashboard/tradehub/', 'src/app/api/tradehub/'],
    terminal: ['src/app/dashboard/terminal/', 'src/app/api/terminal/'],
    journal: ['src/app/dashboard/journal/', 'src/app/api/journal/'],
    goals: ['src/app/dashboard/goals/', 'src/app/api/goals/'],
    setups: ['src/app/dashboard/setups/', 'src/app/api/setups/'],

    // Capital modules
    treasury: ['src/app/dashboard/treasury/', 'src/app/api/treasury/'],
    business: ['src/app/dashboard/business/', 'src/app/api/business/'],
    accounts: ['src/app/accounts/', 'src/app/api/accounts/'],
    analytics: ['src/app/analytics/', 'src/app/api/analytics/'],

    // System
    api: ['src/app/api/'],
    database: ['supabase/migrations/', 'src/lib/supabase/'],
  };

  return areaFileMap[area] || ['src/app/', 'src/lib/'];
}

/**
 * Generate fix prompt
 */
export async function generateCodexFixPrompt(debugBundle: DebugBundle): Promise<string> {
  try {
    const errorSummary = await generateErrorSummary();

    if (errorSummary.length === 0) {
      return generateEmptyErrorPrompt();
    }

    // Build the prompt
    let prompt = `# AlphaShield Debugging Prompt\n\n`;

    prompt += `## Problem Summary\n`;
    prompt += `The application is experiencing errors. Here's what we know:\n\n`;

    // Top errors
    for (let i = 0; i < errorSummary.length; i++) {
      const error = errorSummary[i];
      const files = inferFilesFromArea(error.area).join(', ');

      prompt += `### Error ${i + 1}: ${error.area}\n`;
      prompt += `- **Message**: ${error.message}\n`;
      prompt += `- **Frequency**: ${error.count} occurrence${error.count > 1 ? 's' : ''}\n`;
      prompt += `- **Last occurred**: ${error.lastOccurred}\n`;
      prompt += `- **Likely files**: ${files}\n`;
      prompt += `- **Fingerprint**: \`${error.fingerprint}\`\n\n`;
    }

    // System context
    prompt += `## System Context\n`;
    prompt += `- **Safe Mode**: ${debugBundle.safeMode ? 'ACTIVE' : 'inactive'}\n`;
    prompt += `- **Online**: ${debugBundle.systemDiagnostics.online ? 'yes' : 'no'}\n`;
    prompt += `- **Service Worker**: ${debugBundle.systemDiagnostics.serviceWorkerRegistered ? 'registered' : 'not registered'}\n`;
    prompt += `- **Push Permission**: ${debugBundle.systemDiagnostics.pushPermission}\n`;
    prompt += `- **Queue Size**: ${debugBundle.queueSize} pending logs\n`;
    if (debugBundle.buildVersion) {
      prompt += `- **Build Version**: ${debugBundle.buildVersion}\n`;
    }
    prompt += `\n`;

    // Steps to reproduce
    prompt += `## Steps to Reproduce\n`;
    prompt += `1. Navigate to the application\n`;
    prompt += `2. Trigger the action in the \`${errorSummary[0].area}\` module\n`;
    prompt += `3. Check the browser console for errors\n`;
    prompt += `4. See the error recur (${errorSummary[0].count} times observed)\n\n`;

    // Debug bundle
    prompt += `## Debug Information\n`;
    prompt += `\`\`\`json\n`;
    prompt += JSON.stringify(debugBundle, null, 2);
    prompt += `\n\`\`\`\n\n`;

    // Questions for the AI
    prompt += `## What to Check\n`;
    prompt += `1. Are there null/undefined checks missing in these areas?\n`;
    prompt += `2. Are API endpoints returning unexpected formats?\n`;
    prompt += `3. Are there race conditions in these modules?\n`;
    prompt += `4. Is the database schema consistent?\n`;
    prompt += `5. Are there offline/online edge cases?\n\n`;

    // Closing
    prompt += `## Next Steps\n`;
    prompt += `1. Review the error fingerprints and affected modules\n`;
    prompt += `2. Check the mentioned files for potential issues\n`;
    prompt += `3. Test the reproduction steps\n`;
    prompt += `4. Propose fixes based on the error context\n`;

    return prompt;
  } catch (error) {
    console.error('[AlphaShield] Error generating prompt:', error);
    return generateEmptyErrorPrompt();
  }
}

/**
 * Generate prompt when no errors are present
 */
function generateEmptyErrorPrompt(): string {
  return `# AlphaShield Debugging Prompt

## Status
No errors currently detected in the application logs.

## Recommendations
1. The application is running smoothly
2. Monitor for future issues using AlphaShield dashboard
3. Check browser console for warnings
4. Review recent changes that might cause issues

## Debug Information
Check the full debug bundle in the System Diagnostics panel.
`;
}

/**
 * Format prompt for copying
 */
export function formatPromptForClipboard(prompt: string): string {
  // Clean up formatting for clipboard
  return prompt.trim();
}

/**
 * Copy prompt to clipboard
 */
export async function copyPromptToClipboard(prompt: string): Promise<boolean> {
  try {
    const formatted = formatPromptForClipboard(prompt);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(formatted);
      return true;
    } else {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = formatted;
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (error) {
    console.error('[AlphaShield] Error copying prompt:', error);
    return false;
  }
}
