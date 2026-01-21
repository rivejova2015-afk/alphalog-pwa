/**
 * AlphaCore Testing Utilities
 * 
 * Comprehensive testing helpers for FASE 7 validation:
 * - Offline mutation testing
 * - Conflict detection validation
 * - Deduplication checking
 * - AlphaShield integration verification
 */

import type { JournalEntry, Account } from '@/lib/alphacore/contracts';
import type { BaseFields, MutationStatus } from '@/lib/alphacore/types';
import type { MutationResponse } from '@/lib/alphacore/mutations';

/**
 * Test case for offline mutations
 */
export interface OfflineMutationTest {
  name: string;
  description: string;
  table: string;
  operation: 'create' | 'update' | 'delete';
  payload: any;
  expectedStatus: MutationStatus;
  offline: boolean;
  shouldSync: boolean;
}

/**
 * Test result structure
 */
export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number; // milliseconds
  error?: string;
  details?: Record<string, any>;
}

/**
 * Test suite results
 */
export interface TestSuiteResult {
  suiteName: string;
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  results: TestResult[];
}

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

/**
 * Generate test journal entry
 */
export function generateTestJournalEntry(
  overrides?: Record<string, any>
): Record<string, any> {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    user_id: 'test-user-' + crypto.randomUUID().slice(0, 8),
    mood: 'neutral',
    tags: ['test'],
    text: 'Test journal entry at ' + now,
    timestamp_utc: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version: 1,
    fingerprint: 'test-fp-' + crypto.randomUUID().slice(0, 8),
    ...overrides
  };
}

/**
 * Generate test account
 */
export function generateTestAccount(
  overrides?: Record<string, any>
): Record<string, any> {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    user_id: 'test-user-' + crypto.randomUUID().slice(0, 8),
    name: 'Test Account ' + crypto.randomUUID().slice(0, 4),
    type: 'trading',
    broker: 'Test Broker',
    account_number: 'TEST' + Math.random().toString(36).slice(2, 7).toUpperCase(),
    balance: 10000,
    currency: 'USD',
    is_active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version: 1,
    fingerprint: 'test-fp-' + crypto.randomUUID().slice(0, 8),
    ...overrides
  };
}

// ============================================================================
// TEST RUNNERS
// ============================================================================

/**
 * Run a single test with timing
 */
export async function runTest(
  testName: string,
  testFn: () => Promise<void>
): Promise<TestResult> {
  const startTime = performance.now();
  
  try {
    await testFn();
    return {
      testName,
      passed: true,
      duration: performance.now() - startTime,
      details: { status: 'passed' }
    };
  } catch (error) {
    return {
      testName,
      passed: false,
      duration: performance.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: { errorType: error instanceof Error ? error.constructor.name : typeof error }
    };
  }
}

/**
 * Run a test suite
 */
export async function runTestSuite(
  suiteName: string,
  tests: Array<{ name: string; fn: () => Promise<void> }>
): Promise<TestSuiteResult> {
  const startTime = performance.now();
  const results: TestResult[] = [];

  console.log(`\n📋 Running test suite: ${suiteName}`);
  console.log('─'.repeat(60));

  for (const test of tests) {
    const result = await runTest(test.name, test.fn);
    results.push(result);
    
    const icon = result.passed ? '✓' : '✗';
    const status = result.passed ? 'PASS' : 'FAIL';
    console.log(
      `${icon} ${test.name.padEnd(40)} [${status}] (${result.duration.toFixed(0)}ms)`
    );
    
    if (result.error) {
      console.log(`  └─ Error: ${result.error}`);
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const duration = performance.now() - startTime;

  console.log('─'.repeat(60));
  console.log(
    `Results: ${passed}/${results.length} passed, ${failed} failed (${duration.toFixed(0)}ms total)`
  );

  return {
    suiteName,
    totalTests: results.length,
    passed,
    failed,
    duration,
    results
  };
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that a value is true
 */
export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert equality
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${expected}, got ${actual}`
    );
  }
}

/**
 * Assert that mutation was successful
 */
export function assertMutationSuccess<T>(
  result: MutationResponse<T>,
  context?: string
): asserts result is MutationResponse<T> & { data: T & BaseFields } {
  if (result.error) {
    throw new Error(
      `${context ? context + ': ' : ''}Mutation failed: ${result.error.code} - ${result.error.message}`
    );
  }
  if (!result.data) {
    throw new Error(
      `${context || 'Mutation'}: No data returned`
    );
  }
}

/**
 * Assert that mutation failed
 */
export function assertMutationFailure(
  result: MutationResponse<any>,
  expectedCode: string,
  context?: string
): void {
  if (!result.error) {
    throw new Error(
      `${context ? context + ': ' : ''}Expected mutation to fail with code ${expectedCode}, but it succeeded`
    );
  }
  if (result.error.code !== expectedCode) {
    throw new Error(
      `${context ? context + ': ' : ''}Expected error code ${expectedCode}, got ${result.error.code}`
    );
  }
}

/**
 * Assert mutation status
 */
export function assertMutationStatus(
  result: MutationResponse<any>,
  expectedStatus: MutationStatus,
  context?: string
): void {
  if (result.status !== expectedStatus) {
    throw new Error(
      `${context ? context + ': ' : ''}Expected status ${expectedStatus}, got ${result.status}`
    );
  }
}

/**
 * Assert that value is defined
 */
export function assertDefined<T>(value: T | undefined | null, message: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert that array includes value
 */
export function assertIncludes<T>(
  array: T[],
  value: T,
  message?: string
): void {
  if (!array.includes(value)) {
    throw new Error(
      message || `Expected array to include ${value}, but it doesn't`
    );
  }
}

// ============================================================================
// MOCK UTILITIES
// ============================================================================

/**
 * Mock offline environment
 */
export class OfflineEnvironment {
  private originalOnLine: boolean;
  
  constructor(isOnline: boolean = false) {
    this.originalOnLine = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: isOnline,
        configurable: true
      });
    }
  }
  
  setOnline(isOnline: boolean): void {
    if (typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: isOnline,
        configurable: true
      });
    }
  }
  
  restore(): void {
    if (typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: this.originalOnLine,
        configurable: true
      });
    }
  }
}

/**
 * Measure operation timing
 */
export class Timer {
  private startTime: number = 0;
  
  start(): void {
    this.startTime = performance.now();
  }
  
  elapsed(): number {
    return performance.now() - this.startTime;
  }
  
  async measure<T>(fn: () => Promise<T>): Promise<[T, number]> {
    this.start();
    const result = await fn();
    return [result, this.elapsed()];
  }
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

/**
 * Test logging with formatting
 */
export const testLog = {
  section: (title: string): void => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'='.repeat(60)}`);
  },
  
  subsection: (title: string): void => {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'─'.repeat(60)}`);
  },
  
  info: (message: string): void => {
    console.log(`ℹ️  ${message}`);
  },
  
  success: (message: string): void => {
    console.log(`✅ ${message}`);
  },
  
  warning: (message: string): void => {
    console.log(`⚠️  ${message}`);
  },
  
  error: (message: string): void => {
    console.log(`❌ ${message}`);
  },
  
  debug: (label: string, data: any): void => {
    console.log(`🔍 ${label}:`, JSON.stringify(data, null, 2));
  }
};

// ============================================================================
// EXPORT TEST TEMPLATES
// ============================================================================

/**
 * Example offline mutation test
 */
export const EXAMPLE_OFFLINE_TEST: OfflineMutationTest = {
  name: 'Create journal entry while offline',
  description: 'Journal entry should be created in IndexedDB and synced when online',
  table: 'journal_entries',
  operation: 'create',
  payload: {
    text: 'Test entry',
    mood: 'neutral',
    tags: ['test']
  },
  expectedStatus: 'optimistic',
  offline: true,
  shouldSync: true
};

export const EXAMPLE_CONFLICT_TEST: OfflineMutationTest = {
  name: 'Detect duplicate journal entry',
  description: 'Should prevent creation of journal entry with same timestamp',
  table: 'journal_entries',
  operation: 'create',
  payload: {
    text: 'Test entry',
    mood: 'neutral',
    tags: ['test']
  },
  expectedStatus: 'failed',
  offline: false,
  shouldSync: false
};
