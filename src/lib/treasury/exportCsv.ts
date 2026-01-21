/**
 * Treasury CSV Export Library
 * Pure TypeScript, no external dependencies
 * Exports monthly summaries with payouts and transactions
 */

// Base interface for keyed data
interface KeyedData {
  [key: string]: string | number | boolean | null | undefined;
}

export interface Payout extends KeyedData {
  id: string;
  amount: number;
  status: string;
  sent_date?: string | null;
  received_date?: string | null;
}

export interface Transaction extends KeyedData {
  id: string;
  amount: number;
  type: string;
  date: string;
}

export interface ExportSummary {
  total_closed_pnl: number;
  total_payouts_planned: number;
  total_payouts_sent: number;
  total_payouts_received: number;
  total_tax_reserve_added: number;
  total_bonus_vault_added: number;
  export_month: string; // YYYY-MM
  export_date: string; // ISO date
}

export interface ExportData {
  summary: ExportSummary;
  payouts: Payout[];
  transactions: Transaction[];
}

/**
 * Escape CSV field: wrap in quotes and escape internal quotes
 */
function escapeCsvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert array of objects to CSV with header row
 */
function objectArrayToCsv<T extends KeyedData>(
  data: T[],
  columns: string[]
): string {
  if (data.length === 0) {
    return columns.map(escapeCsvField).join(',');
  }

  const rows: string[] = [];
  
  // Header row
  rows.push(columns.map(escapeCsvField).join(','));

  // Data rows
  for (const obj of data) {
    const row = columns.map((col) => {
      const value = obj[col];
      return escapeCsvField(value);
    });
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Format currency for CSV display
 */
function formatCurrencyForCsv(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00';
  return Number(amount).toFixed(2);
}

/**
 * Format date for CSV display (YYYY-MM-DD)
 */
function formatDateForCsv(dateInput: string | number | null | undefined): string {
  if (dateInput === null || dateInput === undefined || dateInput === '') return '';
  try {
    const date = typeof dateInput === 'number' ? new Date(dateInput) : new Date(String(dateInput));
    return date.toISOString().split('T')[0];
  } catch {
    return String(dateInput ?? '');
  }
}

/**
 * Generate complete Treasury export CSV
 * Format:
 * - Summary section
 * - Payouts section
 * - Transactions section
 */
export function generateTreasuryExportCsv(data: ExportData): string {
  const lines: string[] = [];

  // ===== SUMMARY SECTION =====
  lines.push('SUMMARY');
  lines.push('Metric,Value');
  lines.push(`Export Month,${escapeCsvField(data.summary.export_month)}`);
  lines.push(`Export Date,${escapeCsvField(data.summary.export_date)}`);
  lines.push(`Total Closed PnL,${formatCurrencyForCsv(data.summary.total_closed_pnl)}`);
  lines.push(`Total Payouts Planned,${formatCurrencyForCsv(data.summary.total_payouts_planned)}`);
  lines.push(`Total Payouts Sent,${formatCurrencyForCsv(data.summary.total_payouts_sent)}`);
  lines.push(`Total Payouts Received,${formatCurrencyForCsv(data.summary.total_payouts_received)}`);
  lines.push(`Total Tax Reserve Added,${formatCurrencyForCsv(data.summary.total_tax_reserve_added)}`);
  lines.push(`Total Bonus Vault Added,${formatCurrencyForCsv(data.summary.total_bonus_vault_added)}`);

  // Blank line
  lines.push('');

  // ===== PAYOUTS SECTION =====
  if (data.payouts.length > 0) {
    lines.push('PAYOUTS');
    
    // Prepare payout rows with formatted data
    const payoutRows = data.payouts.map((p) => ({
      'Account': p.account_name || p.account_id || '',
        'Cycle Start': formatDateForCsv(
          typeof p.cycle_start === 'string' || typeof p.cycle_start === 'number' ? p.cycle_start : undefined
        ),
        'Cycle End': formatDateForCsv(
          typeof p.cycle_expected_end === 'string' || typeof p.cycle_expected_end === 'number' ? p.cycle_expected_end : undefined
        ),
        'Payout Date': formatDateForCsv(
          typeof p.payout_date === 'string' || typeof p.payout_date === 'number' ? p.payout_date : undefined
        ),
      'Status': p.status || '',
      'Cash Amount': formatCurrencyForCsv(
        typeof p.cash_payout_amount === 'number'
          ? p.cash_payout_amount
          : (typeof p.cash_payout_amount === 'string' ? parseFloat(p.cash_payout_amount) : null)
      ),
      'Tax Reserve': formatCurrencyForCsv(
        typeof p.tax_reserve_amount === 'number'
          ? p.tax_reserve_amount
          : (typeof p.tax_reserve_amount === 'string' ? parseFloat(p.tax_reserve_amount) : null)
      ),
      'Bonus Vault': formatCurrencyForCsv(
        typeof p.bonus_vault_amount === 'number'
          ? p.bonus_vault_amount
          : (typeof p.bonus_vault_amount === 'string' ? parseFloat(p.bonus_vault_amount) : null)
      ),
      'Total PnL': formatCurrencyForCsv(
        typeof p.pnl_snapshot === 'number'
          ? p.pnl_snapshot
          : (typeof p.pnl_snapshot === 'string' ? parseFloat(p.pnl_snapshot) : null)
      ),
        'Created': formatDateForCsv(
          typeof p.created_at === 'string' || typeof p.created_at === 'number' ? p.created_at : undefined
        ),
    }));

    const payoutColumns = [
      'Account',
      'Cycle Start',
      'Cycle End',
      'Payout Date',
      'Status',
      'Cash Amount',
      'Tax Reserve',
      'Bonus Vault',
      'Total PnL',
      'Created',
    ];

    lines.push(objectArrayToCsv(payoutRows, payoutColumns));
  } else {
    lines.push('PAYOUTS');
    lines.push('(No payouts in this period)');
  }

  // Blank line
  lines.push('');

  // ===== TRANSACTIONS SECTION =====
  if (data.transactions.length > 0) {
    lines.push('TRANSACTIONS');

    // Prepare transaction rows with formatted data
    const transactionRows = data.transactions.map((t) => ({
        'Date': formatDateForCsv(
          typeof t.tx_date === 'string' || typeof t.tx_date === 'number' ? t.tx_date : undefined
        ),
      'Account': t.account_name || t.account_id || '',
      'Type': t.tx_type || '',
      'Description': t.description || '',
      'Amount': formatCurrencyForCsv(
        typeof t.amount === 'number' ? t.amount : (typeof t.amount === 'string' ? parseFloat(t.amount) : null)
      ),
      'Balance After': formatCurrencyForCsv(
        typeof t.balance_after === 'number' ? t.balance_after : (typeof t.balance_after === 'string' ? parseFloat(t.balance_after) : null)
      ),
      'Created': formatDateForCsv(
        typeof t.created_at === 'string' || typeof t.created_at === 'number' ? t.created_at : undefined
      ),
    }));

    const transactionColumns = [
      'Date',
      'Account',
      'Type',
      'Description',
      'Amount',
      'Balance After',
      'Created',
    ];

    lines.push(objectArrayToCsv(transactionRows, transactionColumns));
  } else {
    lines.push('TRANSACTIONS');
    lines.push('(No transactions in this period)');
  }

  // Blank line
  lines.push('');

  // Footer
  lines.push(`Export Generated: ${new Date().toISOString()}`);

  return lines.join('\n');
}

/**
 * Download CSV file to browser
 * Pure JavaScript, no dependencies
 */
export function downloadCsv(
  csvContent: string,
  filename: string
): void {
  if (typeof window === 'undefined') {
    throw new Error('downloadCsv can only be called from browser');
  }

  // Create blob with UTF-8 BOM (for Excel compatibility)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up URL object
  URL.revokeObjectURL(url);
}

/**
 * Prepare summary data from database records
 */
export function calculateExportSummary(
  trades: any[],
  payouts: any[],
  fromDate: Date,
  toDate: Date,
  month: string
): ExportSummary {
  // Filter closed trades in date range
  const closedTrades = trades.filter((t) => {
    if (t.status !== 'Closed') return false;
    const closedDate = new Date(t.closed_at || t.updated_at);
    return closedDate >= fromDate && closedDate <= toDate;
  });

  const totalClosedPnl = closedTrades.reduce((sum, t) => {
    return sum + (Number(t.pnl) || 0);
  }, 0);

  // Filter payouts by date range and status
  const payoutsInRange = payouts.filter((p) => {
    const pDate = new Date(p.payout_date || p.created_at);
    return pDate >= fromDate && pDate <= toDate;
  });

  const payoutsPlanned = payoutsInRange
    .filter((p) => p.status === 'planned')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const payoutsSent = payoutsInRange
    .filter((p) => p.status === 'sent')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const payoutsReceived = payoutsInRange
    .filter((p) => p.status === 'received')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalTaxReserve = payoutsInRange.reduce((sum, p) => {
    return sum + (Number(p.tax_reserve_amount) || 0);
  }, 0);

  const totalBonusVault = payoutsInRange.reduce((sum, p) => {
    return sum + (Number(p.bonus_vault_amount) || 0);
  }, 0);

  return {
    total_closed_pnl: totalClosedPnl,
    total_payouts_planned: payoutsPlanned,
    total_payouts_sent: payoutsSent,
    total_payouts_received: payoutsReceived,
    total_tax_reserve_added: totalTaxReserve,
    total_bonus_vault_added: totalBonusVault,
    export_month: month,
    export_date: new Date().toISOString().split('T')[0],
  };
}

/**
 * Parse YYYY-MM string and return date range (UTC)
 */
export function getMonthDateRange(monthString: string): {
  from: Date;
  to: Date;
} {
  // Parse YYYY-MM format
  const [year, month] = monthString.split('-').map(Number);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month format: ${monthString}, expected YYYY-MM`);
  }

  // First day of month (UTC)
  const from = new Date(Date.UTC(year, month - 1, 1));

  // Last day of month (UTC) - first day of next month minus 1 second
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  return { from, to };
}
