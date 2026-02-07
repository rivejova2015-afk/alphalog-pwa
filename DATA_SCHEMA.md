# DATA_SCHEMA - AlphaLog

Fuente de verdad del modelo de datos (Supabase). Resumen de tablas clave y relaciones.

---

## Core Trading

### account_categories
- Categorías por usuario (user_id)
- Soft-delete (deleted_at)

### accounts
- Cuentas de trading por usuario (user_id)
- Relación: accounts.category_id → account_categories.id
- Campos: account_size, current_balance, operation_state, phase_status, role, withdrawals_enabled, currency, status

### setups
- Estrategias por usuario (user_id)

### trades
- Operaciones por usuario (user_id)
- Relación: trades.account_id → accounts.id
- Relación opcional: trades.setup_id → setups.id
- Campos obligatorios (New Trades Log): symbol, direction, status, entry_date, entry_price, exit_price, stop_loss_price, take_profit_price, lots, pnl, pnl_percent
- Soft-delete (deleted_at)

---

## CopyGroups (Sprint UPDATE_09)

### copy_groups
- CopyGroups por usuario (owner_id)
- active_version (int), sync_mode (hard|soft)

### copy_group_nodes
- Nodo por account dentro de un CopyGroup
- Relación: copy_group_nodes.copy_group_id → copy_groups.id
- Relación: copy_group_nodes.account_id → accounts.id
- role: master|slave
- status: active|paused|read_only
- risk_pct (numeric)
- Constraint: 1 master activo por CopyGroup

### copy_group_links
- Links multi-nivel entre cuentas
- parent_account_id → accounts.id
- child_account_id → accounts.id
- link_type: solid|shadow
- copy_multiplier
- Constraint: 1 parent SOLID por child
- Anti-loop: bloquea ciclos (CTE + trigger)

### copy_group_versions
- Versiones por CopyGroup (version_int)

### copy_group_snapshots
- Snapshot JSON por versión
- Incluye nodes, links, experiments y metadata

### copy_group_events
- Timeline de eventos por CopyGroup
- event_type: CONFIG_CHANGED, VERSION_CREATED, ROLLBACK_APPLIED, MASTER_TRADE_LOGGED, MASTER_TRADE_UPDATED, MIRROR_CREATED, MIRROR_FAILED, NEED_RESYNC, RETRY_SCHEDULED

### trade_replication_map
- Relación master_trade_id ↔ copy_group_id

### slave_trade_links
- Relación master_trade_id ↔ slave_trade_id
- Idempotencia: UNIQUE(master_trade_id, slave_account_id)
- status: replicated|pending|failed|need_resync

### copy_group_experiments
- Flags de Experiments por CopyGroup (jsonb)

### replication_jobs
- Cola simple de reintentos de mirror
- status: pending|processing|failed|done

---

## RLS (Row Level Security)
- owner-only: copy_groups y dependientes (join por copy_group_id)
- accounts/trades: auth.uid() = user_id
- Replicación server-side usa service role o RPC SECURITY DEFINER
