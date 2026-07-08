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
  | "accounts";

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
}

class QueryBuilder {
  private table: InScopeTable;
  private mode: "select" | "insert" | "update" | null = null;
  private selectCols = "*";
  private insertRows: Row[] = [];
  private updateRow: Row = {};
  private wheres: Array<{ col: string; op: "eq" | "is"; val: unknown }> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private wantSingle = false;

  constructor(table: InScopeTable) {
    this.table = table;
  }

  select(cols = "*") {
    this.mode = this.mode ?? "select";
    this.selectCols = cols;
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

  eq(col: string, val: unknown) {
    this.wheres.push({ col, op: "eq", val });
    return this;
  }

  is(col: string, val: unknown) {
    this.wheres.push({ col, op: "is", val });
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

  private buildWhereFragment(client: ReturnType<typeof postgres>) {
    if (this.wheres.length === 0) return client``;
    const clauses = this.wheres.map((w) => {
      if (w.op === "is") {
        // "is" is only ever used with null in the audited call sites.
        return client`${client(w.col)} IS NULL`;
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

      if (this.mode === "insert") {
        result = await client`
          INSERT INTO ${client(this.table)} ${client(this.insertRows)}
          RETURNING ${this.selectCols === "*" ? client`*` : client(this.selectCols.split(","))}
        `;
      } else if (this.mode === "update") {
        const where = this.buildWhereFragment(client);
        result = await client`
          UPDATE ${client(this.table)} SET ${client(this.updateRow)} ${where}
          RETURNING *
        `;
      } else {
        const where = this.buildWhereFragment(client);
        const orderFragment = this.orderCol
          ? client`ORDER BY ${client(this.orderCol)} ${this.orderAsc ? client`ASC` : client`DESC`}`
          : client``;
        const cols = this.selectCols === "*" ? client`*` : client(this.selectCols.split(","));
        result = await client`SELECT ${cols} FROM ${client(this.table)} ${where} ${orderFragment}`;
      }

      if (this.wantSingle) {
        resolve({ data: (result[0] ?? null) as T, error: null });
      } else {
        resolve({ data: result as T, error: null });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      resolve({ data: null, error: { message } });
      reject?.(err);
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
