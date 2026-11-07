import type {
  AccountKey,
  AssetSnapshotRow,
  CashFlowRow,
  DividendRow,
  HoldingSnapshotRow,
  OrderHistoryRow,
  TossSheetData,
} from "./sheets";

export interface DailySeriesPoint {
  date: string;
  label: string;
  totalAssets: number;
  holdingsEval: number;
  holdingsCost: number;
  profitAmount: number;
  profitRate: number;
  cash: number;
  cashKrw: number;
  cashUsd: number;
  fxPnlKrw: number;
  usdKrwRate: number;
  deltaAssets: number;
  deltaRate: number;
}

export interface MergedHoldingRow {
  key: string;
  symbol: string;
  name: string;
  currency: string;
  accountLabel: string;
  quantity: number;
  avgPrice: number;
  lastPrice: number;
  evalKrw: number;
  purchaseKrw: number;
  profitKrw: number;
  fxPnlKrw: number;
  profitRate: number;
  weightPct: number;
}

export function buildDailySeries(
  data: TossSheetData | null,
  account: AccountKey
): DailySeriesPoint[] {
  if (!data || data.assetSnapshots.length === 0) return [];

  if (account !== "ALL") {
    const rows = data.assetSnapshots
      .filter((r) => r.accountLabel === account)
      .sort((a, b) => a.date.localeCompare(b.date));
    return rows.map((r, idx) => {
      const prev = idx > 0 ? rows[idx - 1] : null;
      const deltaAssets = prev ? r.totalAssets - prev.totalAssets : 0;
      const deltaRate =
        prev && prev.totalAssets > 0
          ? (deltaAssets / prev.totalAssets) * 100
          : 0;
      return {
        date: r.date,
        label: r.date.slice(5),
        totalAssets: r.totalAssets,
        holdingsEval: r.holdingsEval,
        holdingsCost: r.holdingsCost,
        profitAmount: r.profitAmount,
        profitRate: r.profitRate,
        cash: r.cash,
        cashKrw: r.cashKrw,
        cashUsd: r.cashUsd,
        fxPnlKrw: r.fxPnlKrw,
        usdKrwRate: r.usdKrwRate,
        deltaAssets,
        deltaRate,
      };
    });
  }

  // Account === "ALL": combine 혜신 + 동헌 by date with forward-fill
  const allDates = Array.from(
    new Set(data.assetSnapshots.map((r) => r.date))
  ).sort();

  const byAccDate = new Map<string, AssetSnapshotRow>();
  for (const r of data.assetSnapshots) {
    byAccDate.set(`${r.accountLabel}__${r.date}`, r);
  }

  let lastHyesin: AssetSnapshotRow | null = null;
  let lastDongheon: AssetSnapshotRow | null = null;

  const combined: Omit<DailySeriesPoint, "deltaAssets" | "deltaRate">[] = [];
  for (const d of allDates) {
    const h = byAccDate.get(`혜신__${d}`) ?? lastHyesin;
    const dh = byAccDate.get(`동헌__${d}`) ?? lastDongheon;
    if (byAccDate.has(`혜신__${d}`)) lastHyesin = byAccDate.get(`혜신__${d}`)!;
    if (byAccDate.has(`동헌__${d}`)) lastDongheon = byAccDate.get(`동헌__${d}`)!;

    const parts = [h, dh].filter((x): x is AssetSnapshotRow => x !== null);
    if (parts.length === 0) continue;

    const totalAssets = parts.reduce((s, p) => s + p.totalAssets, 0);
    const holdingsEval = parts.reduce((s, p) => s + p.holdingsEval, 0);
    const holdingsCost = parts.reduce((s, p) => s + p.holdingsCost, 0);
    const profitAmount = parts.reduce((s, p) => s + p.profitAmount, 0);
    const profitRate =
      holdingsCost > 0 ? (profitAmount / holdingsCost) * 100 : 0;
    const cash = parts.reduce((s, p) => s + p.cash, 0);
    const cashKrw = parts.reduce((s, p) => s + p.cashKrw, 0);
    const cashUsd = parts.reduce((s, p) => s + p.cashUsd, 0);
    const fxPnlKrw = parts.reduce((s, p) => s + p.fxPnlKrw, 0);
    const rates = parts.map((p) => p.usdKrwRate).filter((v) => v > 0);
    const usdKrwRate =
      rates.length > 0
        ? rates.reduce((a, b) => a + b, 0) / rates.length
        : 0;

    combined.push({
      date: d,
      label: d.slice(5),
      totalAssets,
      holdingsEval,
      holdingsCost,
      profitAmount,
      profitRate,
      cash,
      cashKrw,
      cashUsd,
      fxPnlKrw,
      usdKrwRate,
    });
  }

  return combined.map((c, idx) => {
    const prev = idx > 0 ? combined[idx - 1] : null;
    const deltaAssets = prev ? c.totalAssets - prev.totalAssets : 0;
    const deltaRate =
      prev && prev.totalAssets > 0 ? (deltaAssets / prev.totalAssets) * 100 : 0;
    return {
      ...c,
      deltaAssets,
      deltaRate,
    };
  });
}

export function buildMonthlySeries(
  daily: DailySeriesPoint[]
): DailySeriesPoint[] {
  if (daily.length === 0) return [];
  const byMonth = new Map<string, DailySeriesPoint>();
  for (const pt of daily) {
    const ym = pt.date.slice(0, 7); // YYYY-MM
    byMonth.set(ym, pt); // keeps last snapshot of each month
  }
  const months = Array.from(byMonth.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  return months.map(([ym, pt], idx) => {
    const prev = idx > 0 ? months[idx - 1][1] : null;
    const deltaAssets = prev ? pt.totalAssets - prev.totalAssets : 0;
    const deltaRate =
      prev && prev.totalAssets > 0 ? (deltaAssets / prev.totalAssets) * 100 : 0;
    return {
      ...pt,
      label: ym,
      deltaAssets,
      deltaRate,
    };
  });
}

export function getAvailableHoldingDates(
  data: TossSheetData | null,
  account: AccountKey
): string[] {
  if (!data) return [];
  const filtered =
    account === "ALL"
      ? data.holdingsSnapshots
      : data.holdingsSnapshots.filter((h) => h.accountLabel === account);
  return Array.from(new Set(filtered.map((h) => h.date))).sort((a, b) =>
    b.localeCompare(a)
  );
}

export function getHoldingsAtDate(
  data: TossSheetData | null,
  account: AccountKey,
  targetDate: string,
  mergeSameSymbol: boolean
): MergedHoldingRow[] {
  if (!data || !targetDate) return [];

  let rows: HoldingSnapshotRow[] = [];

  if (account !== "ALL") {
    // Find latest date <= targetDate for this account
    const accDates = Array.from(
      new Set(
        data.holdingsSnapshots
          .filter((h) => h.accountLabel === account && h.date <= targetDate)
          .map((h) => h.date)
      )
    ).sort();
    const effDate = accDates[accDates.length - 1];
    if (!effDate) return [];
    rows = data.holdingsSnapshots.filter(
      (h) => h.accountLabel === account && h.date === effDate
    );
  } else {
    // For ALL, take latest date <= targetDate per account so both accounts show up
    for (const acc of ["혜신", "동헌"] as const) {
      const accDates = Array.from(
        new Set(
          data.holdingsSnapshots
            .filter((h) => h.accountLabel === acc && h.date <= targetDate)
            .map((h) => h.date)
        )
      ).sort();
      const effDate = accDates[accDates.length - 1];
      if (effDate) {
        rows.push(
          ...data.holdingsSnapshots.filter(
            (h) => h.accountLabel === acc && h.date === effDate
          )
        );
      }
    }
  }

  const totalEval = rows.reduce((s, r) => s + r.evalKrw, 0);

  if (account === "ALL" && mergeSameSymbol) {
    const grouped = new Map<string, MergedHoldingRow>();
    for (const r of rows) {
      const existing = grouped.get(r.symbol);
      if (!existing) {
        grouped.set(r.symbol, {
          key: r.symbol,
          symbol: r.symbol,
          name: r.name,
          currency: r.currency,
          accountLabel: r.accountLabel,
          quantity: r.quantity,
          avgPrice: r.avgPrice,
          lastPrice: r.lastPrice,
          evalKrw: r.evalKrw,
          purchaseKrw: r.purchaseKrw,
          profitKrw: r.profitKrw,
          fxPnlKrw: r.fxPnlKrw,
          profitRate: r.profitRate,
          weightPct: 0,
        });
      } else {
        const totalQty = existing.quantity + r.quantity;
        const avgPrice =
          totalQty > 0
            ? (existing.avgPrice * existing.quantity + r.avgPrice * r.quantity) /
              totalQty
            : existing.avgPrice;
        const evalKrw = existing.evalKrw + r.evalKrw;
        const purchaseKrw = existing.purchaseKrw + r.purchaseKrw;
        const profitKrw = existing.profitKrw + r.profitKrw;
        const fxPnlKrw = existing.fxPnlKrw + r.fxPnlKrw;
        const profitRate =
          purchaseKrw > 0 ? (profitKrw / purchaseKrw) * 100 : 0;
        const accSet = new Set(
          `${existing.accountLabel},${r.accountLabel}`.split(",")
        );
        grouped.set(r.symbol, {
          ...existing,
          accountLabel: Array.from(accSet).join("·"),
          quantity: totalQty,
          avgPrice,
          lastPrice: r.lastPrice || existing.lastPrice,
          evalKrw,
          purchaseKrw,
          profitKrw,
          fxPnlKrw,
          profitRate,
        });
      }
    }
    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        weightPct: totalEval > 0 ? (item.evalKrw / totalEval) * 100 : 0,
      }))
      .sort((a, b) => b.evalKrw - a.evalKrw);
  }

  return rows
    .map((r) => ({
      key: `${r.accountLabel}-${r.symbol}`,
      symbol: r.symbol,
      name: r.name,
      currency: r.currency,
      accountLabel: r.accountLabel,
      quantity: r.quantity,
      avgPrice: r.avgPrice,
      lastPrice: r.lastPrice,
      evalKrw: r.evalKrw,
      purchaseKrw: r.purchaseKrw,
      profitKrw: r.profitKrw,
      fxPnlKrw: r.fxPnlKrw,
      profitRate: r.profitRate,
      weightPct: totalEval > 0 ? (r.evalKrw / totalEval) * 100 : r.weightPct,
    }))
    .sort((a, b) => b.evalKrw - a.evalKrw);
}

export function filterOrders(
  data: TossSheetData | null,
  account: AccountKey
): OrderHistoryRow[] {
  if (!data) return [];
  return account === "ALL"
    ? data.ordersHistory
    : data.ordersHistory.filter((o) => o.accountLabel === account);
}

export function filterDividends(
  data: TossSheetData | null,
  account: AccountKey
): DividendRow[] {
  if (!data) return [];
  return account === "ALL"
    ? data.dividends
    : data.dividends.filter((d) => d.accountLabel === account);
}

export function filterCashFlows(
  data: TossSheetData | null,
  account: AccountKey
): CashFlowRow[] {
  if (!data) return [];
  return account === "ALL"
    ? data.cashFlows
    : data.cashFlows.filter((c) => c.accountLabel === account);
}
