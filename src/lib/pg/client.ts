import postgres from "postgres";

export type InScopeTable =
  | "bot_instances"
  | "bot_accounts"
  | "bot_commands"
  | "bot_command_status"
  | "trading_algorithms"
  | "algorithms"
  | "trades"
  | "paper_trades"
  | "algo_paper_trades"
  | "coinarb_positions"
  | "coinarb_decisions"
  | "coinarb_smc_signals"
  | "coinarb_telemetry"
  | "bot_events"
  | "bot_skills"
  | "accounts"
  | "algo_cme_accounts"
  | "cme_connections"
  | "cme_equity_snapshots"
  | "cme_positions"
  | "cme_risk_configs"
  | "cme_signals"
  | "cme_trades_propfirm"
  | "cme_trades_real";

let sql: ReturnType<typeof postgres> | null = null;

function getSql() {
  if (sql) return sql;
  const url = process.env.ALPHALOG_PG_URL;
  if (!url) throw new Error("Missing ALPHALOG_PG_URL env var");
  sql = postgres(url, { max: 5 });
  return sql;
}

type Row = Record<string, unknown>;

interface PgResult<T> {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}

class QueryBuilder {
  private table: InScopeTable;
  private mode: "select" | "insert" | "update" | "delete" | "upsert" | null = null;
  private selectCols = "*";
  private wantCount = false;
  private insertRows: Row[] = [];
  private updateRow: Row = {};
  private upsertConflictCols: string[] = [];
  private wheres: Array<{ col: string; op: "eq" | "is" | "gt" | "lt" | "gte" | "in"; val: unknown }> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private wantSingle = false;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;

  constructor(table: InScopeTable) {
    this.table = table;
  }

  select(cols = "*", opts?: { count?: "exact" }) {
    this.mode = this.mode ?? "select";
    this.selectCols = cols;
    this.wantCount = opts?.count === "exact";
    return this;
  }

  // Semántica de Supabase: rango inclusivo, `.range(0, 19)` devuelve 20 filas
  // (LIMIT to-from+1 OFFSET from). Solo aplica al branch de select.
  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  insert(rows: Row | Row[]) {
    this.mode = "insert";
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(row: Row) {
    this.mode = "update";
    this.updateRow = row;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  upsert(rows: Row | Row[], opts: { onConflict: string }) {
    this.mode = "upsert";
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    this.upsertConflictCols = opts.onConflict.split(",").map((s) => s.trim());
    return this;
  }

  eq(col: string, val: unknown) {
    this.wheres.push({ col, op: "eq", val });
    return this;
  }

  is(col: string, val: unknown) {
    this.wheres.push({ col, op: "is", val });
    return this;
  }

  gt(col: string, val: unknown) {
    this.wheres.push({ col, op: "gt", val });
    return this;
  }

  lt(col: string, val: unknown) {
    this.wheres.push({ col, op: "lt", val });
    return this;
  }

  gte(col: string, val: unknown) {
    this.wheres.push({ col, op: "gte", val });
    return this;
  }

  in(col: string, vals: unknown[]) {
    this.wheres.push({ col, op: "in", val: vals });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  // Alias — el shim ya trataba single() como "0 filas -> null" (no como error
  // ante 0/2+ filas, a diferencia de Supabase real). maybeSingle() es el mismo
  // comportamiento, se agrega el alias para que los call sites que ya llaman
  // .maybeSingle() no necesiten cambiar de método, solo de import.
  maybeSingle() {
    this.wantSingle = true;
    return this;
  }

  private buildWhereFragment(client: ReturnType<typeof postgres>) {
    if (this.wheres.length === 0) return client``;
    const clauses = this.wheres.map((w) => {
      if (w.op === "is") {
        // "is" is only ever used with null in the audited call sites.
        return client`${client(w.col)} IS NULL`;
      }
      if (w.op === "gt") {
        return client`${client(w.col)} > ${w.val as never}`;
      }
      if (w.op === "lt") {
        return client`${client(w.col)} < ${w.val as never}`;
      }
      if (w.op === "gte") {
        return client`${client(w.col)} >= ${w.val as never}`;
      }
      if (w.op === "in") {
        // Semántica de Supabase: .in(col, []) no matchea ninguna fila — un
        // "IN ()" vacío es SQL inválido, así que se traduce a una condición
        // siempre falsa en vez de omitir el filtro.
        const arr = w.val as unknown[];
        if (arr.length === 0) return client`FALSE`;
        return client`${client(w.col)} IN ${client(arr as never)}`;
      }
      return client`${client(w.col)} = ${w.val as never}`;
    });
    return client`WHERE ${clauses.reduce((acc, c, i) => (i === 0 ? c : client`${acc} AND ${c}`))}`;
  }

  async then<T = Row[]>(
    resolve: (result: PgResult<T>) => void,
    reject?: (err: unknown) => void,
  ) {
    try {
      const client = getSql();
      let result: Row[];
      let count: number | null = null;

      if (this.mode === "insert") {
        result = await client`
          INSERT INTO ${client(this.table)} ${client(this.insertRows)}
          RETURNING ${this.selectCols === "*" ? client`*` : client(this.selectCols.split(",").map((s) => s.trim()))}
        `;
      } else if (this.mode === "upsert") {
        const updateCols = Object.keys(this.insertRows[0]).filter((c) => !this.upsertConflictCols.includes(c));
        const setFragment = updateCols
          .map((c) => client`${client(c)} = EXCLUDED.${client(c)}`)
          .reduce((acc, c, i) => (i === 0 ? c : client`${acc}, ${c}`));
        result = await client`
          INSERT INTO ${client(this.table)} ${client(this.insertRows)}
          ON CONFLICT (${client(this.upsertConflictCols)}) DO UPDATE SET ${setFragment}
          RETURNING *
        `;
      } else if (this.mode === "update") {
        const where = this.buildWhereFragment(client);
        result = await client`
          UPDATE ${client(this.table)} SET ${client(this.updateRow)} ${where}
          RETURNING *
        `;
      } else if (this.mode === "delete") {
        const where = this.buildWhereFragment(client);
        result = await client`DELETE FROM ${client(this.table)} ${where} RETURNING *`;
      } else {
        const where = this.buildWhereFragment(client);
        const orderFragment = this.orderCol
          ? client`ORDER BY ${client(this.orderCol)} ${this.orderAsc ? client`ASC` : client`DESC`}`
          : client``;
        const cols = this.selectCols === "*" ? client`*` : client(this.selectCols.split(",").map((s) => s.trim()));
        const rangeFragment =
          this.rangeFrom !== null && this.rangeTo !== null
            ? client`LIMIT ${this.rangeTo - this.rangeFrom + 1} OFFSET ${this.rangeFrom}`
            : client``;
        result = await client`SELECT ${cols} FROM ${client(this.table)} ${where} ${orderFragment} ${rangeFragment}`;

        if (this.wantCount) {
          const countResult = await client`SELECT count(*) FROM ${client(this.table)} ${where}`;
          count = Number((countResult[0] as { count: string | number }).count);
        }
      }

      if (this.wantSingle) {
        resolve({ data: (result[0] ?? null) as T, error: null, count });
      } else {
        resolve({ data: result as T, error: null, count });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      resolve({ data: null, error: { message } });
    }
  }
}

export function getPgClient() {
  return {
    from(table: InScopeTable) {
      return new QueryBuilder(table);
    },
  };
}
