// src/lib/validation/autoFix.ts

export interface AutoFixResult<T> {
  data: T;
  changed: boolean;
  changes: string[];
}

type StringOptions = {
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
};

const normalizeString = (value: unknown, options: StringOptions = {}) => {
  if (value === null || value === undefined) return undefined;
  let text = typeof value === "string" ? value : String(value);
  if (options.trim) text = text.trim();
  if (options.lowercase) text = text.toLowerCase();
  if (options.uppercase) text = text.toUpperCase();
  return text;
};

const normalizeNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const normalizeBoolean = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "true") return true;
    if (text === "false") return false;
  }
  if (typeof value === "number") return value !== 0;
  return undefined;
};

const normalizeDate = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return undefined;
};

const normalizeStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item, { trim: true }))
      .filter((item): item is string => Boolean(item));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
};

const trackChange = (changes: string[], key: string, before: unknown, after: unknown) => {
  if (before !== after) {
    changes.push(key);
  }
};

export const autoFixTradeCreate = (input: Record<string, unknown>): AutoFixResult<Record<string, unknown>> => {
  const output: Record<string, unknown> = { ...input };
  const changes: string[] = [];

  const symbol = normalizeString(input.symbol, { trim: true, uppercase: true });
  if (symbol !== undefined) {
    trackChange(changes, "symbol", input.symbol, symbol);
    output.symbol = symbol;
  }

  const direction = normalizeString(input.direction, { trim: true, uppercase: true });
  if (direction === "BUY" || direction === "SELL") {
    trackChange(changes, "direction", input.direction, direction);
    output.direction = direction;
  }

  const status = normalizeString(input.status, { trim: true, lowercase: true });
  if (status === "open" || status === "closed") {
    trackChange(changes, "status", input.status, status);
    output.status = status;
  }

  const entryDate = normalizeDate(input.entry_date);
  if (entryDate) {
    trackChange(changes, "entry_date", input.entry_date, entryDate);
    output.entry_date = entryDate;
  }

  const exitDate = normalizeDate(input.exit_date);
  if (exitDate !== undefined) {
    trackChange(changes, "exit_date", input.exit_date, exitDate);
    output.exit_date = exitDate;
  }

  const numbers: Array<[string, unknown]> = [
    ["entry_price", input.entry_price],
    ["exit_price", input.exit_price],
    ["lots", input.lots],
    ["stop_loss_price", input.stop_loss_price],
    ["take_profit_price", input.take_profit_price],
    ["pnl", input.pnl],
    ["pnl_percent", input.pnl_percent],
  ];

  numbers.forEach(([key, value]) => {
    const normalized = normalizeNumber(value);
    if (normalized !== undefined) {
      trackChange(changes, key, value, normalized);
      output[key] = normalized;
    }
  });

  const notes = normalizeString(input.notes, { trim: true });
  if (notes !== undefined) {
    trackChange(changes, "notes", input.notes, notes);
    output.notes = notes;
  }

  const setupId = normalizeString(input.setup_id, { trim: true });
  if (setupId !== undefined) {
    trackChange(changes, "setup_id", input.setup_id, setupId);
    output.setup_id = setupId;
  }

  const featured = normalizeBoolean(input.is_featured_in_report);
  if (featured !== undefined) {
    trackChange(changes, "is_featured_in_report", input.is_featured_in_report, featured);
    output.is_featured_in_report = featured;
  }

  return { data: output, changed: changes.length > 0, changes };
};

export const autoFixTradeUpdate = (input: Record<string, unknown>): AutoFixResult<Record<string, unknown>> => {
  const output: Record<string, unknown> = { ...input };
  const changes: string[] = [];

  if ("symbol" in input) {
    const symbol = normalizeString(input.symbol, { trim: true, uppercase: true });
    if (symbol !== undefined) {
      trackChange(changes, "symbol", input.symbol, symbol);
      output.symbol = symbol;
    }
  }

  if ("direction" in input) {
    const direction = normalizeString(input.direction, { trim: true, uppercase: true });
    if (direction === "BUY" || direction === "SELL") {
      trackChange(changes, "direction", input.direction, direction);
      output.direction = direction;
    }
  }

  if ("status" in input) {
    const status = normalizeString(input.status, { trim: true, lowercase: true });
    if (status === "open" || status === "closed") {
      trackChange(changes, "status", input.status, status);
      output.status = status;
    }
  }

  if ("entry_date" in input) {
    const entryDate = normalizeDate(input.entry_date);
    if (entryDate !== undefined) {
      trackChange(changes, "entry_date", input.entry_date, entryDate);
      output.entry_date = entryDate;
    }
  }

  if ("exit_date" in input) {
    const exitDate = normalizeDate(input.exit_date);
    if (exitDate !== undefined) {
      trackChange(changes, "exit_date", input.exit_date, exitDate);
      output.exit_date = exitDate;
    }
  }

  const numberKeys = [
    "entry_price",
    "exit_price",
    "lots",
    "stop_loss_price",
    "take_profit_price",
    "pnl",
    "pnl_percent",
  ];

  numberKeys.forEach((key) => {
    if (key in input) {
      const normalized = normalizeNumber((input as Record<string, unknown>)[key]);
      if (normalized !== undefined) {
        trackChange(changes, key, (input as Record<string, unknown>)[key], normalized);
        output[key] = normalized;
      }
    }
  });

  if ("notes" in input) {
    const notes = normalizeString(input.notes, { trim: true });
    if (notes !== undefined) {
      trackChange(changes, "notes", input.notes, notes);
      output.notes = notes;
    }
  }

  if ("setup_id" in input) {
    const setupId = normalizeString(input.setup_id, { trim: true });
    if (setupId !== undefined) {
      trackChange(changes, "setup_id", input.setup_id, setupId);
      output.setup_id = setupId;
    }
  }

  if ("is_featured_in_report" in input) {
    const featured = normalizeBoolean(input.is_featured_in_report);
    if (featured !== undefined) {
      trackChange(changes, "is_featured_in_report", input.is_featured_in_report, featured);
      output.is_featured_in_report = featured;
    }
  }

  if ("restore" in input) {
    const restore = normalizeBoolean(input.restore);
    if (restore !== undefined) {
      trackChange(changes, "restore", input.restore, restore);
      output.restore = restore;
    }
  }

  return { data: output, changed: changes.length > 0, changes };
};

export const autoFixJournalEntry = (input: Record<string, unknown>): AutoFixResult<Record<string, unknown>> => {
  const output: Record<string, unknown> = { ...input };
  const changes: string[] = [];

  const text = normalizeString(input.text, { trim: true });
  if (text !== undefined) {
    trackChange(changes, "text", input.text, text);
    output.text = text;
  }

  const mood = normalizeString(input.mood, { trim: true, lowercase: true });
  if (mood !== undefined) {
    trackChange(changes, "mood", input.mood, mood);
    output.mood = mood;
  }

  const tags = normalizeStringArray(input.tags);
  if (tags !== undefined) {
    trackChange(changes, "tags", input.tags, tags);
    output.tags = tags;
  }

  const focusAreas = normalizeStringArray(input.focus_areas);
  if (focusAreas !== undefined) {
    trackChange(changes, "focus_areas", input.focus_areas, focusAreas);
    output.focus_areas = focusAreas;
  }

  const actionItems = normalizeStringArray(input.action_items);
  if (actionItems !== undefined) {
    trackChange(changes, "action_items", input.action_items, actionItems);
    output.action_items = actionItems;
  }

  const moodScore = normalizeNumber(input.mood_score);
  if (moodScore !== undefined) {
    trackChange(changes, "mood_score", input.mood_score, moodScore);
    output.mood_score = moodScore;
  }

  const tradeId = normalizeString(input.trade_id, { trim: true });
  if (tradeId !== undefined) {
    trackChange(changes, "trade_id", input.trade_id, tradeId);
    output.trade_id = tradeId;
  }

  const isPrivate = normalizeBoolean(input.is_private);
  if (isPrivate !== undefined) {
    trackChange(changes, "is_private", input.is_private, isPrivate);
    output.is_private = isPrivate;
  }

  return { data: output, changed: changes.length > 0, changes };
};

export const autoFixSendEmail = (input: Record<string, unknown>): AutoFixResult<Record<string, unknown>> => {
  const output: Record<string, unknown> = { ...input };
  const changes: string[] = [];

  const mailboxId = normalizeString(input.mailbox_id, { trim: true });
  if (mailboxId !== undefined) {
    trackChange(changes, "mailbox_id", input.mailbox_id, mailboxId);
    output.mailbox_id = mailboxId;
  }

  const toEmail = normalizeString(input.to_email, { trim: true, lowercase: true });
  if (toEmail !== undefined) {
    trackChange(changes, "to_email", input.to_email, toEmail);
    output.to_email = toEmail;
  }

  const subject = normalizeString(input.subject_ciphertext, { trim: true });
  if (subject !== undefined) {
    trackChange(changes, "subject_ciphertext", input.subject_ciphertext, subject);
    output.subject_ciphertext = subject;
  }

  const body = normalizeString(input.body_ciphertext, { trim: true });
  if (body !== undefined) {
    trackChange(changes, "body_ciphertext", input.body_ciphertext, body);
    output.body_ciphertext = body;
  }

  if ("attachments" in input) {
    const attachments = Array.isArray(input.attachments) ? input.attachments : input.attachments ? [input.attachments] : undefined;
    if (attachments !== undefined) {
      const normalized = attachments.map((item) => {
        const entry = item as Record<string, unknown>;
        return {
          filename: normalizeString(entry.filename, { trim: true }) || "",
          content_base64: normalizeString(entry.content_base64, { trim: true }) || "",
          content_type: normalizeString(entry.content_type, { trim: true }) || "",
        };
      });
      trackChange(changes, "attachments", input.attachments, normalized);
      output.attachments = normalized;
    }
  }

  return { data: output, changed: changes.length > 0, changes };
};
