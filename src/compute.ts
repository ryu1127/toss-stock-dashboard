import type {
  AccountKey,
  AssetSnapshotRow,
  CashFlowRow,
  DividendRow,
  HoldingSnapshotRow,
  OrderHistoryRow,
  PeriodPerformanceRow,
  RealizedTradeRow,
  TossSheetData,
} from "./sheets";

export const OVERSEAS_TAX_DEDUCTION_KRW = 2_500_000;
export const OVERSEAS_TAX_RATE = 0.22;

export interface DailySeriesPoint {
  date: string;
  label: string;
  totalAssets: number;
  holdingsEval: number;
  holdingsCost: number;
  profitAmount: number;
  stockPnlKrw: number;
  fxPnlKrw: number;
  profitRate: number;
  cash: number;
  cashKrw: number;
  cashUsd: number;
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
  avgBuyFx: number;
  evalKrw: number;
  purchaseKrw: number;
  stockPnlKrw: number;
  fxPnlKrw: number;
  profitKrw: number;
  profitRateNative: number;
  profitRate: number;
  weightPct: number;
}

export interface ComputedPeriodPerf {
  period: string;
  startDate: string;
  endDate: string;
  startAssets: number;
  endAssets: number;
  netCashFlow: number;
  simpleChange: number;
  simpleRate: number;
  pureProfit: number;
  dietzRate: number;
}

export interface YearlyTaxSummary {
  year: number;
  usdSellCount: number;
  usdProceedsKrw: number;
  usdCostKrw: number;
  usdStockPnlKrw: number;
  usdFxPnlKrw: number;
  usdFeeKrw: number;
  usdNetPnlKrw: number;
  deductionKrw: number;
  taxableBaseKrw: number;
  estimatedTaxKrw: number;
  remainingDeductionKrw: number;
  krwSellCount: number;
  krwProceedsKrw: number;
  krwCostKrw: number;
  krwFeeKrw: number;
  krwNetPnlKrw: number;
}

export interface UnrealizedTaxSim {
  currentYearRealizedUsdKrw: number;
  unrealizedGainKrw: number;
  unrealizedLossKrw: number;
  unrealizedNetKrw: number;
  combinedIfSellAllKrw: number;
  deductionKrw: number;
  taxableIfSellAllKrw: number;
  estTaxIfSellAllKrw: number;
  remainingFreeGainKrw: number;
  lossHarvestCandidates: {
    symbol: string;
    name: string;
    accountLabel: string;
    totalPnlKrw: number;
    stockPnlKrw: number;
    fxPnlKrw: number;
    potentialTaxSavingKrw: number;
  }[];
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
        stockPnlKrw: r.profitAmount - r.fxPnlKrw,
        fxPnlKrw: r.fxPnlKrw,
        profitRate: r.profitRate,
        cash: r.cash,
        cashKrw: r.cashKrw,
        cashUsd: r.cashUsd,
        usdKrwRate: r.usdKrwRate,
        deltaAssets,
        deltaRate,
      };
    });
  }

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
    if (byAccDate.has(`동헌__${d}`))
      lastDongheon = byAccDate.get(`동헌__${d}`)!;

    const parts = [h, dh].filter((x): x is AssetSnapshotRow => x !== null);
    if (parts.length === 0) continue;

    const totalAssets = parts.reduce((s, p) => s + p.totalAssets, 0);
    const holdingsEval = parts.reduce((s, p) => s + p.holdingsEval, 0);
    const holdingsCost = parts.reduce((s, p) => s + p.holdingsCost, 0);
    const profitAmount = parts.reduce((s, p) => s + p.profitAmount, 0);
    const fxPnlKrw = parts.reduce((s, p) => s + p.fxPnlKrw, 0);
    const stockPnlKrw = profitAmount - fxPnlKrw;
    const profitRate =
      holdingsCost > 0 ? (profitAmount / holdingsCost) * 100 : 0;
    const cash = parts.reduce((s, p) => s + p.cash, 0);
    const cashKrw = parts.reduce((s, p) => s + p.cashKrw, 0);
    const cashUsd = parts.reduce((s, p) => s + p.cashUsd, 0);
    const rates = parts.map((p) => p.usdKrwRate).filter((v) => v > 0);
    const usdKrwRate =
      rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

    combined.push({
      date: d,
      label: d.slice(5),
      totalAssets,
      holdingsEval,
      holdingsCost,
      profitAmount,
      stockPnlKrw,
      fxPnlKrw,
      profitRate,
      cash,
      cashKrw,
      cashUsd,
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
    const ym = pt.date.slice(0, 7);
    byMonth.set(ym, pt);
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
          avgBuyFx: r.avgBuyFx || 1,
          evalKrw: r.evalKrw,
          purchaseKrw: r.purchaseKrw,
          stockPnlKrw: r.stockPnlKrw ?? r.profitKrw - r.fxPnlKrw,
          fxPnlKrw: r.fxPnlKrw,
          profitKrw: r.profitKrw,
          profitRateNative: r.profitRateNative ?? r.profitRate,
          profitRate: r.profitRate,
          weightPct: 0,
        });
      } else {
        const totalQty = existing.quantity + r.quantity;
        const avgPrice =
          totalQty > 0
            ? (existing.avgPrice * existing.quantity +
                r.avgPrice * r.quantity) /
              totalQty
            : existing.avgPrice;
        const lastPrice = r.lastPrice || existing.lastPrice;
        const evalKrw = existing.evalKrw + r.evalKrw;
        const purchaseKrw = existing.purchaseKrw + r.purchaseKrw;
        const profitKrw = existing.profitKrw + r.profitKrw;
        const fxPnlKrw = existing.fxPnlKrw + r.fxPnlKrw;
        const stockPnlKrw =
          existing.stockPnlKrw + (r.stockPnlKrw ?? r.profitKrw - r.fxPnlKrw);
        const avgBuyFx =
          r.currency === "USD" && totalQty * avgPrice > 0
            ? purchaseKrw / (totalQty * avgPrice)
            : existing.avgBuyFx;
        const profitRate =
          purchaseKrw > 0 ? (profitKrw / purchaseKrw) * 100 : 0;
        const profitRateNative =
          avgPrice > 0 ? ((lastPrice - avgPrice) / avgPrice) * 100 : profitRate;
        const accSet = new Set(
          `${existing.accountLabel},${r.accountLabel}`.split(",")
        );
        grouped.set(r.symbol, {
          ...existing,
          accountLabel: Array.from(accSet).join("·"),
          quantity: totalQty,
          avgPrice,
          lastPrice,
          avgBuyFx,
          evalKrw,
          purchaseKrw,
          stockPnlKrw,
          fxPnlKrw,
          profitKrw,
          profitRateNative,
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
      avgBuyFx: r.avgBuyFx || 1,
      evalKrw: r.evalKrw,
      purchaseKrw: r.purchaseKrw,
      stockPnlKrw: r.stockPnlKrw ?? r.profitKrw - r.fxPnlKrw,
      fxPnlKrw: r.fxPnlKrw,
      profitKrw: r.profitKrw,
      profitRateNative: r.profitRateNative ?? r.profitRate,
      profitRate: r.profitRate,
      weightPct: totalEval > 0 ? (r.evalKrw / totalEval) * 100 : r.weightPct,
    }))
    .sort((a, b) => b.evalKrw - a.evalKrw);
}

// Compute Period Performance (Modified Dietz) from dailySeries + cashFlows (or sheet tab)
export function getPeriodPerformance(
  data: TossSheetData | null,
  account: AccountKey,
  dailySeries: DailySeriesPoint[],
  cashFlows: CashFlowRow[]
): ComputedPeriodPerf[] {
  if (account !== "ALL" && data && data.periodPerformance.length > 0) {
    const fromSheet = data.periodPerformance.filter(
      (p) => p.accountLabel === account
    );
    if (fromSheet.length > 0) {
      return fromSheet.map((p) => ({
        period: p.period,
        startDate: p.startDate,
        endDate: p.endDate,
        startAssets: p.startAssets,
        endAssets: p.endAssets,
        netCashFlow: p.netCashFlow,
        simpleChange: p.simpleChange,
        simpleRate: p.simpleRate,
        pureProfit: p.pureProfit,
        dietzRate: p.dietzRate,
      }));
    }
  }

  if (dailySeries.length < 2) return [];

  const minDateStr = dailySeries[0].date;
  const endPt = dailySeries[dailySeries.length - 1];
  const endDateStr = endPt.date;
  const endAssets = endPt.totalAssets;
  const endMs = new Date(endDateStr).getTime();
  const minMs = new Date(minDateStr).getTime();

  const shiftDays = (days: number) =>
    new Date(endMs - days * 86400_000).toISOString().slice(0, 10);

  const periodDefs: [string, string][] = [
    ["최근 1주", shiftDays(7)],
    ["최근 1개월", shiftDays(30)],
    ["최근 3개월", shiftDays(90)],
    ["최근 6개월", shiftDays(180)],
    ["올해 (YTD)", `${endDateStr.slice(0, 4)}-01-01`],
    ["최근 1년", shiftDays(365)],
    ["전체 기록 기간", minDateStr],
  ];

  const out: ComputedPeriodPerf[] = [];
  for (const [label, targetStart] of periodDefs) {
    const before = dailySeries.filter((p) => p.date <= targetStart);
    const startPt =
      before.length > 0 ? before[before.length - 1] : dailySeries[0];
    if (startPt.date >= endDateStr) continue;

    const targetMs = new Date(targetStart).getTime();
    if (
      label !== "전체 기록 기간" &&
      startPt.date === minDateStr &&
      minMs > targetMs + 14 * 86400_000
    ) {
      continue;
    }

    const startMs = new Date(startPt.date).getTime();
    const daysTotal = Math.max(1, (endMs - startMs) / 86400_000);

    let netCf = 0;
    let weightedCf = 0;
    for (const cf of cashFlows) {
      if (cf.date > startPt.date && cf.date <= endDateStr) {
        const signed = cf.type === "DEPOSIT" ? cf.amount : -cf.amount;
        netCf += signed;
        const cfMs = new Date(cf.date).getTime();
        const w = Math.max(
          0,
          Math.min(1, (endMs - cfMs) / (daysTotal * 86400_000))
        );
        weightedCf += signed * w;
      }
    }

    const startAssets = startPt.totalAssets;
    const simpleChange = endAssets - startAssets;
    const simpleRate =
      startAssets > 0 ? (simpleChange / startAssets) * 100 : 0;
    const pureProfit = endAssets - startAssets - netCf;
    const dietzDenom = startAssets + weightedCf;
    const dietzRate =
      dietzDenom > 0 ? (pureProfit / dietzDenom) * 100 : simpleRate;

    out.push({
      period: label,
      startDate: startPt.date,
      endDate: endDateStr,
      startAssets: Math.round(startAssets),
      endAssets: Math.round(endAssets),
      netCashFlow: Math.round(netCf),
      simpleChange: Math.round(simpleChange),
      simpleRate: Number(simpleRate.toFixed(2)),
      pureProfit: Math.round(pureProfit),
      dietzRate: Number(dietzRate.toFixed(2)),
    });
  }

  return out;
}

// Reconstruct realized trades in browser if sheet tab is not yet populated
function computeFallbackRealizedTrades(
  data: TossSheetData
): RealizedTradeRow[] {
  const byAcc = new Map<"혜신" | "동헌", OrderHistoryRow[]>();
  for (const o of data.ordersHistory) {
    if (o.filledQuantity <= 0) continue;
    const list = byAcc.get(o.accountLabel) ?? [];
    list.push(o);
    byAcc.set(o.accountLabel, list);
  }

  const out: RealizedTradeRow[] = [];
  for (const [accLabel, accOrders] of byAcc.entries()) {
    const sorted = [...accOrders].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.filledAt.localeCompare(b.filledAt) ||
        a.orderId.localeCompare(b.orderId)
    );

    const ledger = new Map<
      string,
      { qty: number; costNative: number; costKrw: number }
    >();

    for (const o of sorted) {
      let q = o.filledQuantity;
      let px = o.averageFilledPrice;
      const amtNative = o.filledAmount || q * px;
      if (o.symbol === "AMZN" && o.date < "2022-06-06") {
        q *= 20;
        px = q > 0 ? amtNative / q : px / 20;
      }
      const fx = o.currency === "USD" ? (o.fxRate > 500 ? o.fxRate : 1380) : 1;
      const commKrw = o.commission * fx;
      const taxKrw = o.tax * fx;
      const st = ledger.get(o.symbol) ?? {
        qty: 0,
        costNative: 0,
        costKrw: 0,
      };

      if (o.side === "BUY") {
        st.qty += q;
        st.costNative += amtNative + o.commission;
        st.costKrw += (amtNative + o.commission) * fx;
        ledger.set(o.symbol, st);
      } else {
        const sellQty = q;
        const avgCostNative = st.qty > 1e-9 ? st.costNative / st.qty : px;
        const avgCostKrw = st.qty > 1e-9 ? st.costKrw / st.qty : px * fx;
        const avgBuyFx =
          avgCostNative > 0 ? avgCostKrw / avgCostNative : fx;

        const costSoldNative = avgCostNative * sellQty;
        const costSoldKrw = avgCostKrw * sellQty;
        const proceedsKrw = amtNative * fx;
        const feeKrw = commKrw + taxKrw;
        const stockPnlKrw =
          o.currency === "USD"
            ? (amtNative - costSoldNative) * fx
            : proceedsKrw - costSoldKrw;
        const fxPnlKrw =
          o.currency === "USD" ? costSoldNative * (fx - avgBuyFx) : 0;
        const netPnlKrw = proceedsKrw - costSoldKrw - feeKrw;
        const pnlRate =
          costSoldKrw > 0 ? (netPnlKrw / costSoldKrw) * 100 : 0;

        if (st.qty > 1e-9) {
          const remainRatio = Math.max(0, (st.qty - sellQty) / st.qty);
          st.qty = Math.max(0, st.qty - sellQty);
          st.costNative *= remainRatio;
          st.costKrw *= remainRatio;
          ledger.set(o.symbol, st);
        }

        out.push({
          orderId: o.orderId,
          date: o.date,
          year: Number(o.date.slice(0, 4)),
          accountNumber: o.accountNumber,
          accountLabel: accLabel,
          accountAlias: o.accountAlias,
          symbol: o.symbol,
          name: o.name,
          currency: o.currency,
          qty: sellQty,
          sellPriceNative: px,
          avgBuyPriceNative: avgCostNative,
          sellFx: fx,
          avgBuyFx,
          proceedsKrw: Math.round(proceedsKrw),
          costKrw: Math.round(costSoldKrw),
          stockPnlKrw: Math.round(stockPnlKrw),
          fxPnlKrw: Math.round(fxPnlKrw),
          feeKrw: Math.round(feeKrw),
          netPnlKrw: Math.round(netPnlKrw),
          pnlRate: Number(pnlRate.toFixed(2)),
          recordedAt: o.recordedAt,
        });
      }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function getRealizedTrades(
  data: TossSheetData | null,
  account: AccountKey
): RealizedTradeRow[] {
  if (!data) return [];
  const source =
    data.realizedTrades && data.realizedTrades.length > 0
      ? data.realizedTrades
      : computeFallbackRealizedTrades(data);
  return account === "ALL"
    ? source
    : source.filter((r) => r.accountLabel === account);
}

export function buildYearlyTaxSummary(
  trades: RealizedTradeRow[],
  account: AccountKey
): YearlyTaxSummary[] {
  const byYear = new Map<number, RealizedTradeRow[]>();
  for (const t of trades) {
    const list = byYear.get(t.year) ?? [];
    list.push(t);
    byYear.set(t.year, list);
  }

  const out: YearlyTaxSummary[] = [];
  for (const [year, yrTrades] of byYear.entries()) {
    const usd = yrTrades.filter((t) => t.currency === "USD");
    const krw = yrTrades.filter((t) => t.currency !== "USD");

    const usdSellCount = usd.length;
    const usdProceedsKrw = usd.reduce((s, t) => s + t.proceedsKrw, 0);
    const usdCostKrw = usd.reduce((s, t) => s + t.costKrw, 0);
    const usdStockPnlKrw = usd.reduce((s, t) => s + t.stockPnlKrw, 0);
    const usdFxPnlKrw = usd.reduce((s, t) => s + t.fxPnlKrw, 0);
    const usdFeeKrw = usd.reduce((s, t) => s + t.feeKrw, 0);
    const usdNetPnlKrw = usd.reduce((s, t) => s + t.netPnlKrw, 0);

    // Overseas tax is assessed per individual taxpayer (2.5M KRW deduction per person)
    let deductionKrw = OVERSEAS_TAX_DEDUCTION_KRW;
    let taxableBaseKrw = 0;
    let remainingDeductionKrw = 0;

    if (account === "ALL") {
      // Calculate per person (혜신 & 동헌) and sum their tax bases
      for (const person of ["혜신", "동헌"] as const) {
        const pNet = usd
          .filter((t) => t.accountLabel === person)
          .reduce((s, t) => s + t.netPnlKrw, 0);
        taxableBaseKrw += Math.max(0, pNet - OVERSEAS_TAX_DEDUCTION_KRW);
        remainingDeductionKrw += Math.max(
          0,
          OVERSEAS_TAX_DEDUCTION_KRW - pNet
        );
      }
      deductionKrw = OVERSEAS_TAX_DEDUCTION_KRW * 2;
    } else {
      taxableBaseKrw = Math.max(0, usdNetPnlKrw - OVERSEAS_TAX_DEDUCTION_KRW);
      remainingDeductionKrw = Math.max(
        0,
        OVERSEAS_TAX_DEDUCTION_KRW - usdNetPnlKrw
      );
    }

    const estimatedTaxKrw = Math.round(taxableBaseKrw * OVERSEAS_TAX_RATE);

    const krwSellCount = krw.length;
    const krwProceedsKrw = krw.reduce((s, t) => s + t.proceedsKrw, 0);
    const krwCostKrw = krw.reduce((s, t) => s + t.costKrw, 0);
    const krwFeeKrw = krw.reduce((s, t) => s + t.feeKrw, 0);
    const krwNetPnlKrw = krw.reduce((s, t) => s + t.netPnlKrw, 0);

    out.push({
      year,
      usdSellCount,
      usdProceedsKrw,
      usdCostKrw,
      usdStockPnlKrw,
      usdFxPnlKrw,
      usdFeeKrw,
      usdNetPnlKrw,
      deductionKrw,
      taxableBaseKrw,
      estimatedTaxKrw,
      remainingDeductionKrw,
      krwSellCount,
      krwProceedsKrw,
      krwCostKrw,
      krwFeeKrw,
      krwNetPnlKrw,
    });
  }

  return out.sort((a, b) => b.year - a.year);
}

export function buildUnrealizedTaxSim(
  currentHoldings: MergedHoldingRow[],
  realizedTrades: RealizedTradeRow[],
  account: AccountKey
): UnrealizedTaxSim {
  const currentYear = new Date().getFullYear();
  const currentYearRealizedUsdKrw = realizedTrades
    .filter((t) => t.year === currentYear && t.currency === "USD")
    .reduce((s, t) => s + t.netPnlKrw, 0);

  const usdHoldings = currentHoldings.filter(
    (h) => h.currency.toUpperCase() === "USD"
  );
  const gainItems = usdHoldings.filter((h) => h.profitKrw > 0);
  const lossItems = usdHoldings.filter((h) => h.profitKrw < 0);

  const unrealizedGainKrw = gainItems.reduce((s, h) => s + h.profitKrw, 0);
  const unrealizedLossKrw = lossItems.reduce((s, h) => s + h.profitKrw, 0);
  const unrealizedNetKrw = unrealizedGainKrw + unrealizedLossKrw;

  const combinedIfSellAllKrw = currentYearRealizedUsdKrw + unrealizedNetKrw;
  const deductionKrw =
    account === "ALL"
      ? OVERSEAS_TAX_DEDUCTION_KRW * 2
      : OVERSEAS_TAX_DEDUCTION_KRW;
  const taxableIfSellAllKrw = Math.max(0, combinedIfSellAllKrw - deductionKrw);
  const estTaxIfSellAllKrw = Math.round(
    taxableIfSellAllKrw * OVERSEAS_TAX_RATE
  );
  const remainingFreeGainKrw = Math.max(
    0,
    deductionKrw - currentYearRealizedUsdKrw
  );

  return {
    currentYearRealizedUsdKrw,
    unrealizedGainKrw,
    unrealizedLossKrw,
    unrealizedNetKrw,
    combinedIfSellAllKrw,
    deductionKrw,
    taxableIfSellAllKrw,
    estTaxIfSellAllKrw,
    remainingFreeGainKrw,
    lossHarvestCandidates: lossItems
      .sort((a, b) => a.profitKrw - b.profitKrw)
      .map((h) => ({
        symbol: h.symbol,
        name: h.name,
        accountLabel: h.accountLabel,
        totalPnlKrw: h.profitKrw,
        stockPnlKrw: h.stockPnlKrw,
        fxPnlKrw: h.fxPnlKrw,
        potentialTaxSavingKrw: Math.round(
          Math.abs(h.profitKrw) * OVERSEAS_TAX_RATE
        ),
      })),
  };
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
