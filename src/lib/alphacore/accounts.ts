/**
 * Accounts Module - AlphaCore Pilot Mutation
 * 
 * This file demonstrates AlphaCore patterns with the Accounts "Create Account" flow.
 * After this pilot succeeds, patterns should be replicated to other modules.
 * 
 * Flow:
 * 1. User fills AccountDialog form
 * 2. onSave() calls createAccountMutation()
 * 3. Mutation calls createEntity('accounts', payload)
 * 4. Mutation hits POST /api/alphacore/accounts/create endpoint
 * 5. Endpoint validates, dedupes, creates, logs to AlphaShield
 * 6. Response returns account with server ID
 * 7. Parent component refetches accounts list via useState/fetch
 */

import type { Account } from './contracts';
import type { BaseFields } from './types';
import { createEntity, updateEntity, softDeleteEntity } from './mutations';

/**
 * Create Account payload (no BaseFields)
 */
export interface CreateAccountPayload {
  name: string;
  category_id: string;
  account_size?: number | null;
  current_balance?: number | null;
  operation_state?: string | null;
  phase_status?: string | null;
  role?: string | null;
  withdrawals_enabled?: boolean;
}

/**
 * Update Account payload
 */
export interface UpdateAccountPayload {
  name?: string;
  category_id?: string;
  account_size?: number | null;
  current_balance?: number | null;
  operation_state?: string | null;
  phase_status?: string | null;
  role?: string | null;
  withdrawals_enabled?: boolean;
}

// ============================================================================
// MUTATION FUNCTION
// ============================================================================

/**
 * Create a new account with AlphaCore patterns
 * 
 * Invariant A: Create → Persist → Visible
 * - Optimistically show in UI
 * - Server persists with ID
 * - Replace temp ID with server ID when confirmed
 */
export async function createAccountMutation(
  payload: CreateAccountPayload
): Promise<{ data?: Account & BaseFields; error?: any; mutationId: string }> {
  return createEntity<Account>('accounts', payload, {
    optimistic: true,
    metadata: {
      entityName: 'Account',
      subsection: 'accounts',
    },
  });
}

/**
 * Update an existing account
 */
export async function updateAccountMutation(
  accountId: string,
  updates: UpdateAccountPayload
): Promise<{ data?: Account & BaseFields; error?: any; mutationId: string }> {
  return updateEntity<Account>('accounts', accountId, updates, {
    optimistic: true,
  });
}

/**
 * Soft-delete an account
 */
export async function deleteAccountMutation(
  accountId: string
): Promise<{ data?: Account & BaseFields; error?: any; mutationId: string }> {
  return softDeleteEntity<Account>('accounts', accountId);
}

/**
 * Restore a deleted account (set deleted_at = null)
 */
export async function restoreAccountMutation(
  accountId: string
): Promise<{ data?: Account & BaseFields; error?: any; mutationId: string }> {
  return updateEntity<Account>('accounts', accountId, { deleted_at: null } as any, {
    optimistic: true,
  });
}

// ============================================================================
// USAGE EXAMPLE (for AccountsPanel.client.tsx)
// ============================================================================

/**
 * EXAMPLE: How to use in AccountDialog component with useState/fetch pattern
 * 
 * export default function AccountDialog({
 *   account,
 *   categories,
 *   onSave,
 *   onClose,
 * }: AccountDialogProps) {
 *   const [name, setName] = useState(account?.name || '');
 *   const [categoryId, setCategoryId] = useState(account?.category_id || '');
 *   const [accountSize, setAccountSize] = useState(account?.account_size?.toString() || '');
 *   const [loading, setLoading] = useState(false);
 *   const [error, setError] = useState('');
 *   
 *   const handleSave = async () => {
 *     setLoading(true);
 *     setError('');
 *     
 *     try {
 *       const payload = {
 *         name,
 *         category_id: categoryId,
 *         account_size: accountSize ? parseFloat(accountSize) : null,
 *       };
 *       
 *       if (account) {
 *         // Update
 *         const result = await updateAccountMutation(account.id, payload);
 *         if (result.error) {
 *           setError(result.error.message);
 *           return;
 *         }
 *       } else {
 *         // Create
 *         const result = await createAccountMutation(payload);
 *         if (result.error) {
 *           setError(result.error.message);
 *           return;
 *         }
 *       }
 *       
 *       // Parent will refetch accounts list
 *       onClose();
 *     } finally {
 *       setLoading(false);
 *     }
 *   };
 *   
 *   return (
 *     <dialog>
 *       {error && <div style={{color: 'red'}}>{error}</div>}
 *       <input value={name} onChange={e => setName(e.target.value)} />
 *       <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
 *         {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
 *       </select>
 *       <button onClick={handleSave} disabled={loading || !name || !categoryId}>
 *         {loading ? 'Saving...' : 'Save'}
 *       </button>
 *     </dialog>
 *   );
 * }
 */

// ============================================================================
// ACCEPTANCE CRITERIA
// ============================================================================

/**
 * ACCEPTANCE CRITERIA for Accounts Create Pilot
 * 
 * ## Setup
 * - [ ] Build passes (npm run build)
 * - [ ] TypeScript strict mode passes
 * - [ ] No lint errors in mutations.ts, dedupe.ts, alphashield.ts
 * 
 * ## Functional
 * - [ ] User opens AccountsPanel
 * - [ ] Clicks "+ Nueva Cuenta"
 * - [ ] AccountDialog opens with empty form
 * - [ ] User enters:
 *   - Name: "Test Account"
 *   - Category: Select existing
 *   - Account Size: 10000 (optional)
 * - [ ] User clicks "Save"
 * 
 * ## Mutation Behavior (No Backend Endpoint Yet)
 * - [ ] createAccountMutation() called with payload
 * - [ ] Calls createEntity('accounts', payload)
 * - [ ] Generates mutation ID + logs to console
 * - [ ] Would call POST /api/alphacore/accounts/create (if exists)
 * - [ ] On success: returns account with ID + created_at
 * - [ ] On error: returns error object
 * 
 * ## AlphaShield Logging
 * - [ ] If error occurs, logged to app_logs table
 * - [ ] Error includes: code, message, table, operation
 * - [ ] Safe Mode tracking: 3+ errors in 60s → enabled
 * 
 * ## Deduplication
 * - [ ] If duplicate (same name in category): should error with 23505
 * - [ ] Error shown in dialog: "This account already exists"
 * - [ ] App doesn't crash; user can retry
 * 
 * ## React Query Integration
 * - [ ] After successful create, accounts list invalidated
 * - [ ] Parent AccountsPanel refetches list
 * - [ ] New account appears immediately (after server response)
 * - [ ] No manual refresh needed
 * 
 * ## Dialog Behavior
 * - [ ] On success: AccountDialog closes
 * - [ ] Parent AccountsPanel shows new account in list
 * - [ ] On error: Dialog stays open, error message shown, can retry
 * 
 * ## Next Phase (Backend Implementation)
 * - [ ] Create POST /api/alphacore/accounts/create endpoint
 * - [ ] Endpoint validates payload with Zod schema
 * - [ ] Calls Supabase insert (RLS enforced)
 * - [ ] Returns 409 on 23505 (duplicate)
 * - [ ] Logs to app_logs on success
 */
