export const parseMoneyInput = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const sanitized = trimmed.replace(/[^\d.,-]/g, "");
  if (!sanitized || sanitized === "-" || sanitized === "." || sanitized === ",") {
    return null;
  }

  const lastComma = sanitized.lastIndexOf(",");
  const lastDot = sanitized.lastIndexOf(".");
  let normalized = sanitized;

  if (lastComma > lastDot) {
    normalized = sanitized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = sanitized.replace(/,/g, "");
  }

  const value = Number(normalized);
  if (Number.isNaN(value)) return null;
  return value;
};

export const formatMoney = (value: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
};
