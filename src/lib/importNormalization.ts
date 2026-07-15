export function isThousandsUsdRevenueColumn(header: string | null | undefined) {
  return Boolean(header && /revenue\s*\(in\s*000s\s*usd\)/i.test(header));
}

export function parseRevenue(value: string, sourceHeader?: string | null) {
  if (!value.trim()) {
    return null;
  }

  const cleaned = value.replace(/[$,\s]/g, "").trim().toLowerCase();
  const explicitMultiplier = cleaned.endsWith("b")
    ? 1_000_000_000
    : cleaned.endsWith("m")
      ? 1_000_000
      : cleaned.endsWith("k")
        ? 1_000
        : null;
  const sourceMultiplier = isThousandsUsdRevenueColumn(sourceHeader) ? 1_000 : 1;
  const multiplier = explicitMultiplier ?? sourceMultiplier;
  const numeric = cleaned.replace(/[bmk]$/, "");
  const parsed = Number(numeric);

  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * multiplier) : null;
}
