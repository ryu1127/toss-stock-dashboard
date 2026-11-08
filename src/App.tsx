import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildDailySeries,
  buildMonthlySeries,
  buildUnrealizedTaxSim,
  buildYearlyTaxSummary,
  filterCashFlows,
  filterDividends,
  filterOrders,
  getAvailableHoldingDates,
  getHoldingsAtDate,
  getPeriodPerformance,
  getRealizedTrades,
} from "./compute";
import {
  fmtCompactKrw,
  fmtKrw,
  fmtNum,
  fmtPct,
  fmtPrice,
  pnlArrow,
  pnlBadgeClass,
  pnlClass,
} from "./format";
import { type AccountKey, getSpreadsheetUrl } from "./sheets";
import { useDashboardStore } from "./store";

type MainTab =
  | "portfolio"
  | "trend"
  | "tax"
  | "orders"
  | "dividends"
  | "cashflow";

type KpiCardKey = "total" | "stock" | "pnl" | "cash" | "realized";
type RealizedDrawerSubTab = "realized" | "dividend" | "cashflow";

const PIE_COLORS = [
  "#3b82f6",
  "#ec4899",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#06b6d4",
  "#f43f5e",
  "#84cc16",
  "#6366f1",
  "#14b8a6",
];

export default function App() {
  const {
    account,
    setAccount,
    spreadsheetId,
    data,
    loading,
    error,
    signedIn,
    refresh,
    connectAndSync,
    disconnect,
    changeSpreadsheetId,
    addCashFlow,
    addDividend,
  } = useDashboardStore();

  const [activeTab, setActiveTab] = useState<MainTab>("portfolio");
  const [selectedKpi, setSelectedKpi] = useState<KpiCardKey | null>(null);
  const [realizedSubTab, setRealizedSubTab] =
    useState<RealizedDrawerSubTab>("realized");
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(
    null
  );

  const [showSheetModal, setShowSheetModal] = useState(false);
  const [sheetInput, setSheetInput] = useState(spreadsheetId);

  // Portfolio Tab states
  const holdingDates = useMemo(
    () => getAvailableHoldingDates(data, account),
    [data, account]
  );
  const [selectedHoldingDate, setSelectedHoldingDate] = useState<string>("");
  const [mergeHoldings, setMergeHoldings] = useState(true);
  const [allocMode, setAllocMode] = useState<"stock" | "market">("stock");
  const [holdingSearch, setHoldingSearch] = useState("");
  const [holdingMarketFilter, setHoldingMarketFilter] = useState<
    "ALL" | "KRW" | "USD"
  >("ALL");

  useEffect(() => {
    if (
      holdingDates.length > 0 &&
      (!selectedHoldingDate || !holdingDates.includes(selectedHoldingDate))
    ) {
      setSelectedHoldingDate(holdingDates[0]);
    }
  }, [holdingDates, selectedHoldingDate]);

  // Trend Tab states
  const [trendGranularity, setTrendGranularity] = useState<"monthly" | "daily">(
    "monthly"
  );
  const [trendRange, setTrendRange] = useState<
    "1M" | "3M" | "6M" | "1Y" | "ALL"
  >("ALL");
  const [trendYear, setTrendYear] = useState<string>("ALL");

  // Tax & Realized P&L Tab states
  const [taxYear, setTaxYear] = useState<string>("");
  const [taxMarketFilter, setTaxMarketFilter] = useState<
    "ALL" | "USD" | "KRW"
  >("ALL");
  const [taxSearch, setTaxSearch] = useState("");

  // Orders Tab states
  const [orderYear, setOrderYear] = useState<string>("ALL");
  const [orderSide, setOrderSide] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [orderCurrency, setOrderCurrency] = useState<"ALL" | "KRW" | "USD">(
    "ALL"
  );
  const [orderSearch, setOrderSearch] = useState("");

  // Dividends form states
  const todayIso = new Date().toISOString().slice(0, 10);
  const [divAcc, setDivAcc] = useState<"혜신" | "동헌">("혜신");
  const [divDate, setDivDate] = useState(todayIso);
  const [divSymbol, setDivSymbol] = useState("SGOV");
  const [divName, setDivName] = useState("SGOV");
  const [divCurrency, setDivCurrency] = useState<"USD" | "KRW">("USD");
  const [divGross, setDivGross] = useState("");
  const [divTax, setDivTax] = useState("");
  const [divNetKrw, setDivNetKrw] = useState("");
  const [divMemo, setDivMemo] = useState("");

  // CashFlow form states
  const [cfAcc, setCfAcc] = useState<"혜신" | "동헌">("혜신");
  const [cfDate, setCfDate] = useState(todayIso);
  const [cfType, setCfType] = useState<"DEPOSIT" | "WITHDRAW">("DEPOSIT");
  const [cfAmount, setCfAmount] = useState("");
  const [cfMemo, setCfMemo] = useState("");

  useEffect(() => {
    if (account === "혜신" || account === "동헌") {
      setDivAcc(account);
      setCfAcc(account);
    }
  }, [account]);

  // Computed Series & Summary
  const dailySeries = useMemo(
    () => buildDailySeries(data, account),
    [data, account]
  );
  const monthlySeries = useMemo(
    () => buildMonthlySeries(dailySeries),
    [dailySeries]
  );
  const latestSnap =
    dailySeries.length > 0 ? dailySeries[dailySeries.length - 1] : null;

  // Per-account latest snapshots (for Card 1 & Card 4 drill-down)
  const latestByAcc = useMemo(() => {
    const hSeries = buildDailySeries(data, "혜신");
    const dhSeries = buildDailySeries(data, "동헌");
    return {
      혜신: hSeries.length > 0 ? hSeries[hSeries.length - 1] : null,
      동헌: dhSeries.length > 0 ? dhSeries[dhSeries.length - 1] : null,
    };
  }, [data]);

  const orders = useMemo(() => filterOrders(data, account), [data, account]);
  const realizedTrades = useMemo(
    () => getRealizedTrades(data, account),
    [data, account]
  );
  const dividends = useMemo(
    () => filterDividends(data, account),
    [data, account]
  );
  const cashFlows = useMemo(
    () => filterCashFlows(data, account),
    [data, account]
  );

  const periodPerformance = useMemo(
    () => getPeriodPerformance(data, account, dailySeries, cashFlows),
    [data, account, dailySeries, cashFlows]
  );

  const yearlyTaxSummaries = useMemo(
    () => buildYearlyTaxSummary(realizedTrades, account),
    [realizedTrades, account]
  );

  useEffect(() => {
    if (yearlyTaxSummaries.length > 0 && !taxYear) {
      setTaxYear(String(yearlyTaxSummaries[0].year));
    }
  }, [yearlyTaxSummaries, taxYear]);

  const totalDividendsKrw = useMemo(
    () => dividends.reduce((s, d) => s + d.netAmountKrw, 0),
    [dividends]
  );

  const netDepositsKrw = useMemo(
    () =>
      cashFlows.reduce(
        (s, c) => s + (c.type === "DEPOSIT" ? c.amount : -c.amount),
        0
      ),
    [cashFlows]
  );

  // Portfolio Holdings for selected date
  const effectiveHoldingDate = selectedHoldingDate || holdingDates[0] || "";
  const holdingsAtDate = useMemo(
    () =>
      getHoldingsAtDate(data, account, effectiveHoldingDate, mergeHoldings),
    [data, account, effectiveHoldingDate, mergeHoldings]
  );

  // Latest holdings (for Unrealized Tax Simulation & KPI drill-down)
  const latestHoldingsSplit = useMemo(
    () => getHoldingsAtDate(data, account, holdingDates[0] || "", false),
    [data, account, holdingDates]
  );
  const latestHoldingsMerged = useMemo(
    () => getHoldingsAtDate(data, account, holdingDates[0] || "", true),
    [data, account, holdingDates]
  );

  const unrealizedSim = useMemo(
    () => buildUnrealizedTaxSim(latestHoldingsSplit, realizedTrades, account),
    [latestHoldingsSplit, realizedTrades, account]
  );

  const holdingsFxSummary = useMemo(() => {
    const totalEval = holdingsAtDate.reduce((s, h) => s + h.evalKrw, 0);
    const totalCost = holdingsAtDate.reduce((s, h) => s + h.purchaseKrw, 0);
    const totalPnl = holdingsAtDate.reduce((s, h) => s + h.profitKrw, 0);
    const totalFxPnl = holdingsAtDate.reduce((s, h) => s + h.fxPnlKrw, 0);
    const totalStockPnl = holdingsAtDate.reduce(
      (s, h) => s + h.stockPnlKrw,
      0
    );
    const usdItems = holdingsAtDate.filter(
      (h) => h.currency.toUpperCase() === "USD"
    );
    const krwItems = holdingsAtDate.filter(
      (h) => h.currency.toUpperCase() !== "USD"
    );
    const usdEval = usdItems.reduce((s, h) => s + h.evalKrw, 0);
    const usdCost = usdItems.reduce((s, h) => s + h.purchaseKrw, 0);
    const usdPnl = usdItems.reduce((s, h) => s + h.profitKrw, 0);
    const krwEval = krwItems.reduce((s, h) => s + h.evalKrw, 0);
    const krwCost = krwItems.reduce((s, h) => s + h.purchaseKrw, 0);
    const krwPnl = krwItems.reduce((s, h) => s + h.profitKrw, 0);

    return {
      totalEval,
      totalCost,
      totalPnl,
      totalFxPnl,
      totalStockPnl,
      usdCount: usdItems.length,
      usdEval,
      usdCost,
      usdPnl,
      krwCount: krwItems.length,
      krwEval,
      krwCost,
      krwPnl,
    };
  }, [holdingsAtDate]);

  const filteredHoldings = useMemo(() => {
    return holdingsAtDate.filter((h) => {
      if (
        holdingMarketFilter !== "ALL" &&
        h.currency.toUpperCase() !== holdingMarketFilter
      ) {
        return false;
      }
      if (holdingSearch.trim()) {
        const q = holdingSearch.trim().toLowerCase();
        return (
          h.name.toLowerCase().includes(q) ||
          h.symbol.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [holdingsAtDate, holdingMarketFilter, holdingSearch]);

  // Donut Chart Data
  const pieData = useMemo(() => {
    if (allocMode === "market") {
      let krwStock = 0;
      let usdStock = 0;
      for (const h of holdingsAtDate) {
        if (h.currency.toUpperCase() === "USD") usdStock += h.evalKrw;
        else krwStock += h.evalKrw;
      }
      const cashAmt = latestSnap?.cash ?? 0;
      return [
        { name: "해외주식 (USD)", value: Math.round(usdStock) },
        { name: "국내주식 (KRW)", value: Math.round(krwStock) },
        { name: "예수금 (현금)", value: Math.round(cashAmt) },
      ].filter((x) => x.value > 0);
    }

    const sorted = [...holdingsAtDate].sort((a, b) => b.evalKrw - a.evalKrw);
    const top = sorted.slice(0, 8);
    const rest = sorted.slice(8);
    const out = top.map((h) => ({
      name: h.name,
      value: Math.round(h.evalKrw),
    }));
    if (rest.length > 0) {
      out.push({
        name: `기타 ${rest.length}종목`,
        value: Math.round(rest.reduce((s, r) => s + r.evalKrw, 0)),
      });
    }
    return out;
  }, [holdingsAtDate, allocMode, latestSnap]);

  // Filtered Trend Series
  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    for (const d of dailySeries) yrs.add(d.date.slice(0, 4));
    return Array.from(yrs).sort((a, b) => b.localeCompare(a));
  }, [dailySeries]);

  const filteredTrendSeries = useMemo(() => {
    const base =
      trendGranularity === "monthly" ? monthlySeries : dailySeries;
    let list = base;
    if (trendYear !== "ALL") {
      list = list.filter((p) => p.date.startsWith(trendYear));
    }
    if (trendRange !== "ALL" && list.length > 0) {
      const lastDate = new Date(list[list.length - 1].date);
      const daysMap = { "1M": 31, "3M": 92, "6M": 183, "1Y": 366 };
      const cutoff = new Date(
        lastDate.getTime() - daysMap[trendRange] * 86400_000
      )
        .toISOString()
        .slice(0, 10);
      list = list.filter((p) => p.date >= cutoff);
    }
    return list;
  }, [dailySeries, monthlySeries, trendGranularity, trendRange, trendYear]);

  // Selected Tax Year Summary & Filtered Realized Trades
  const effectiveTaxYear =
    taxYear ||
    (yearlyTaxSummaries[0] ? String(yearlyTaxSummaries[0].year) : "ALL");

  const activeTaxSummary = useMemo(() => {
    if (effectiveTaxYear === "ALL") {
      const allSummary = buildYearlyTaxSummary(
        realizedTrades.map((r) => ({ ...r, year: 9999 })),
        account
      )[0];
      return (
        allSummary ?? {
          year: 9999,
          usdSellCount: 0,
          usdProceedsKrw: 0,
          usdCostKrw: 0,
          usdStockPnlKrw: 0,
          usdFxPnlKrw: 0,
          usdFeeKrw: 0,
          usdNetPnlKrw: 0,
          deductionKrw: 2_500_000,
          taxableBaseKrw: 0,
          estimatedTaxKrw: 0,
          remainingDeductionKrw: 2_500_000,
          krwSellCount: 0,
          krwProceedsKrw: 0,
          krwCostKrw: 0,
          krwFeeKrw: 0,
          krwNetPnlKrw: 0,
        }
      );
    }
    return (
      yearlyTaxSummaries.find((s) => String(s.year) === effectiveTaxYear) ?? {
        year: Number(effectiveTaxYear),
        usdSellCount: 0,
        usdProceedsKrw: 0,
        usdCostKrw: 0,
        usdStockPnlKrw: 0,
        usdFxPnlKrw: 0,
        usdFeeKrw: 0,
        usdNetPnlKrw: 0,
        deductionKrw: account === "ALL" ? 5_000_000 : 2_500_000,
        taxableBaseKrw: 0,
        estimatedTaxKrw: 0,
        remainingDeductionKrw: account === "ALL" ? 5_000_000 : 2_500_000,
        krwSellCount: 0,
        krwProceedsKrw: 0,
        krwCostKrw: 0,
        krwFeeKrw: 0,
        krwNetPnlKrw: 0,
      }
    );
  }, [yearlyTaxSummaries, effectiveTaxYear, realizedTrades, account]);

  const filteredRealizedTrades = useMemo(() => {
    return realizedTrades.filter((t) => {
      if (effectiveTaxYear !== "ALL" && String(t.year) !== effectiveTaxYear) {
        return false;
      }
      if (
        taxMarketFilter !== "ALL" &&
        t.currency.toUpperCase() !== taxMarketFilter
      ) {
        return false;
      }
      if (taxSearch.trim()) {
        const q = taxSearch.trim().toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [realizedTrades, effectiveTaxYear, taxMarketFilter, taxSearch]);

  // Filtered Orders
  const orderYears = useMemo(() => {
    const yrs = new Set<string>();
    for (const o of orders) yrs.add(o.date.slice(0, 4));
    return Array.from(yrs).sort((a, b) => b.localeCompare(a));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (orderYear !== "ALL" && !o.date.startsWith(orderYear)) return false;
      if (orderSide !== "ALL" && o.side !== orderSide) return false;
      if (
        orderCurrency !== "ALL" &&
        o.currency.toUpperCase() !== orderCurrency
      )
        return false;
      if (orderSearch.trim()) {
        const q = orderSearch.trim().toLowerCase();
        return (
          o.name.toLowerCase().includes(q) ||
          o.symbol.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, orderYear, orderSide, orderCurrency, orderSearch]);

  const orderSummary = useMemo(() => {
    let buySum = 0;
    let sellSum = 0;
    let buyCnt = 0;
    let sellCnt = 0;
    for (const o of filteredOrders) {
      if (o.side === "BUY") {
        buySum += o.filledAmountKrw;
        buyCnt++;
      } else {
        sellSum += o.filledAmountKrw;
        sellCnt++;
      }
    }
    return {
      totalCount: filteredOrders.length,
      buySum,
      sellSum,
      buyCnt,
      sellCnt,
      netBuy: buySum - sellSum,
    };
  }, [filteredOrders]);

  // Dividend Analytics
  const divByYear = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dividends) {
      const y = d.date.slice(0, 4);
      map.set(y, (map.get(y) ?? 0) + d.netAmountKrw);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, amount]) => ({ year, amount }));
  }, [dividends]);

  const divByStock = useMemo(() => {
    const map = new Map<
      string,
      { symbol: string; name: string; amount: number; count: number }
    >();
    for (const d of dividends) {
      const key = d.symbol || d.name;
      const cur = map.get(key) ?? {
        symbol: d.symbol,
        name: d.name || d.symbol,
        amount: 0,
        count: 0,
      };
      cur.amount += d.netAmountKrw;
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [dividends]);

  const currentYear = new Date().getFullYear().toString();
  const thisYearDivKrw = useMemo(
    () =>
      dividends
        .filter((d) => d.date.startsWith(currentYear))
        .reduce((s, d) => s + d.netAmountKrw, 0),
    [dividends, currentYear]
  );

  // CashFlow Analytics
  const cfSummary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const c of cashFlows) {
      if (c.type === "DEPOSIT") totalIn += c.amount;
      else totalOut += c.amount;
    }
    const netIn = totalIn - totalOut;
    const currentAssets = latestSnap?.totalAssets ?? 0;
    const pureProfit =
      netIn > 0 ? currentAssets - netIn : latestSnap?.profitAmount ?? 0;
    const pureRate =
      netIn > 0 ? (pureProfit / netIn) * 100 : latestSnap?.profitRate ?? 0;
    return { totalIn, totalOut, netIn, currentAssets, pureProfit, pureRate };
  }, [cashFlows, latestSnap]);

  const totalRealizedNetPnl = useMemo(
    () => realizedTrades.reduce((s, r) => s + r.netPnlKrw, 0),
    [realizedTrades]
  );

  // Stock 360 Modal Data
  const stock360Data = useMemo(() => {
    if (!selectedStockSymbol) return null;
    const sym = selectedStockSymbol;
    const holdingRows = latestHoldingsSplit.filter((h) => h.symbol === sym);
    const holdingMerged = latestHoldingsMerged.find((h) => h.symbol === sym);
    const stockOrders = orders.filter((o) => o.symbol === sym);
    const stockRealized = realizedTrades.filter((r) => r.symbol === sym);
    const stockDividends = dividends.filter((d) => d.symbol === sym);

    const name =
      holdingMerged?.name ||
      stockOrders[0]?.name ||
      stockRealized[0]?.name ||
      stockDividends[0]?.name ||
      sym;
    const currency =
      holdingMerged?.currency ||
      stockOrders[0]?.currency ||
      stockRealized[0]?.currency ||
      stockDividends[0]?.currency ||
      "KRW";

    const totalRealized = stockRealized.reduce((s, r) => s + r.netPnlKrw, 0);
    const totalDiv = stockDividends.reduce((s, d) => s + d.netAmountKrw, 0);
    const unrealizedPnl = holdingMerged?.profitKrw ?? 0;
    const totalLifetimeReturn = unrealizedPnl + totalRealized + totalDiv;

    return {
      symbol: sym,
      name,
      currency,
      holdingRows,
      holdingMerged,
      stockOrders,
      stockRealized,
      stockDividends,
      totalRealized,
      totalDiv,
      unrealizedPnl,
      totalLifetimeReturn,
    };
  }, [
    selectedStockSymbol,
    latestHoldingsSplit,
    latestHoldingsMerged,
    orders,
    realizedTrades,
    dividends,
  ]);

  const toggleKpi = (key: KpiCardKey) => {
    setSelectedKpi((prev) => (prev === key ? null : key));
  };

  const jumpToTab = (tab: MainTab) => {
    setActiveTab(tab);
    setSelectedKpi(null);
  };

  const handleAddDividend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!divSymbol.trim() || !divNetKrw) return;
    await addDividend({
      accountLabel: divAcc,
      date: divDate,
      symbol: divSymbol,
      name: divName || divSymbol,
      currency: divCurrency,
      grossAmountNative: Number(divGross) || 0,
      taxNative: Number(divTax) || 0,
      netAmountKrw: Number(divNetKrw) || 0,
      memo: divMemo,
    });
    setDivGross("");
    setDivTax("");
    setDivNetKrw("");
    setDivMemo("");
  };

  const handleAddCashFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfAmount || Number(cfAmount) <= 0) return;
    await addCashFlow({
      accountLabel: cfAcc,
      date: cfDate,
      type: cfType,
      amount: Number(cfAmount),
      memo: cfMemo,
    });
    setCfAmount("");
    setCfMemo("");
  };

  return (
    <div className="dashboard-shell">
      {/* Top Bar */}
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-logo">📈</div>
          <div>
            <div className="brand-title">
              토스 증권 자산 대시보드
              <span className="acc-tag">TossStock Cloud</span>
            </div>
            <div className="brand-sub">
              구글 시트 14개 탭 실시간 연동 · 👩 혜신 & 👨 동헌 통합 포트폴리오 · 양도세 · 환차손익 분석
            </div>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="status-pill">
            <span
              className={"status-dot " + (signedIn ? "online" : "offline")}
            />
            {signedIn ? "구글 시트 연결됨" : "로그인 필요"}
          </span>

          {!signedIn ? (
            <button
              className="btn btn-primary"
              onClick={connectAndSync}
              disabled={loading}
            >
              🔐 구글 시트 연결
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? "⏳ 동기화 중..." : "🔄 시트 새로고침"}
            </button>
          )}

          <a
            className="btn"
            href={getSpreadsheetUrl(spreadsheetId)}
            target="_blank"
            rel="noreferrer"
          >
            🔗 백업 시트 열기 ↗
          </a>

          <a
            className="btn"
            href="https://ryu1127.github.io/asset-dashboard-private/"
          >
            🏠 우리집 가계부
          </a>

          <button
            className="btn"
            onClick={() => {
              setSheetInput(spreadsheetId);
              setShowSheetModal(!showSheetModal);
            }}
            title="시트 ID 설정"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Sheet ID Settings Modal */}
      {showSheetModal && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-head">
            <div>
              <h3 className="panel-title">⚙️ 백업 구글 시트 설정</h3>
              <div className="panel-sub">
                TossStock 파이썬 백엔드가 백업하는 구글 스프레드시트 ID 또는 URL을 지정합니다.
              </div>
            </div>
            {signedIn && (
              <button className="btn" onClick={disconnect}>
                로그아웃
              </button>
            )}
          </div>
          <div className="filter-bar">
            <input
              className="text-input"
              style={{ flex: 1, minWidth: 280 }}
              value={sheetInput}
              onChange={(e) => setSheetInput(e.target.value)}
              placeholder="스프레드시트 URL 또는 ID 입력"
            />
            <button
              className="btn btn-primary"
              onClick={async () => {
                await changeSpreadsheetId(sheetInput);
                setShowSheetModal(false);
              }}
            >
              저장 및 불러오기
            </button>
            <button className="btn" onClick={() => setShowSheetModal(false)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="alert-banner">
          <span>⚠️ {error}</span>
          <button className="btn btn-primary" onClick={connectAndSync}>
            구글 계정 다시 연결
          </button>
        </div>
      )}

      {/* First-time Connect Hero if no cached data */}
      {!data && !loading && (
        <div className="connect-hero">
          <h2>🔐 구글 계정으로 토스 주식 백업 시트를 불러오세요</h2>
          <p>
            개인 자산 보호를 위해 코드 저장소에는 어떠한 개인 데이터도 포함되지 않습니다.
            <br />
            우리집 가계부(<code>asset-dashboard-private</code>)와 동일한 구글 계정으로 연결하면
            <strong> [혜신] · [동헌] 14개 시트 탭</strong>을 즉시 불러옵니다.
          </p>
          <button
            className="btn btn-primary"
            style={{ fontSize: 15, padding: "12px 24px" }}
            onClick={connectAndSync}
          >
            🚀 구글 계정으로 즉시 연동하기
          </button>
        </div>
      )}

      {/* Account Switcher & Snapshot Meta */}
      <div className="account-bar">
        <div className="account-tabs">
          {(
            [
              { key: "ALL", label: "👨‍👩‍👧 두 계좌 전체 합산" },
              { key: "혜신", label: "👩 혜신 계좌" },
              { key: "동헌", label: "👨 동헌 계좌" },
            ] as { key: AccountKey; label: string }[]
          ).map((item) => (
            <button
              key={item.key}
              className={
                "account-tab" + (account === item.key ? " active" : "")
              }
              onClick={() => setAccount(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="meta-badges">
          {latestSnap && (
            <span className="meta-badge">
              📅 최근 기록 기준일: <strong>{latestSnap.date}</strong>
            </span>
          )}
          {latestSnap && latestSnap.usdKrwRate > 0 && (
            <span className="meta-badge">
              💱 적용환율:{" "}
              <strong>{fmtNum(latestSnap.usdKrwRate, 2)}원/$</strong>
            </span>
          )}
          {data?.fetchedAt && (
            <span className="meta-badge">
              🕒 동기화:{" "}
              {new Date(data.fetchedAt).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Top 5 Interactive KPI Cards */}
      <section className="kpi-grid">
        {/* Card 1: Total Assets */}
        <div
          className={
            "kpi-card clickable" + (selectedKpi === "total" ? " active" : "")
          }
          style={{ "--kpi-accent": "#3b82f6" } as React.CSSProperties}
          onClick={() => toggleKpi("total")}
        >
          <div className="kpi-label">
            <span>🏦 총자산 (주식+예수금)</span>
            <span className={pnlBadgeClass(latestSnap?.deltaAssets)}>
              {pnlArrow(latestSnap?.deltaAssets)}{" "}
              {fmtPct(latestSnap?.deltaRate ?? 0)}
            </span>
          </div>
          <div className="kpi-value">
            {fmtKrw(latestSnap?.totalAssets ?? 0)}
          </div>
          <div className="kpi-sub">
            <span>직전 대비</span>
            <strong className={pnlClass(latestSnap?.deltaAssets)}>
              {fmtKrw(latestSnap?.deltaAssets ?? 0, true)}
            </strong>
          </div>
          <div className="kpi-footer-hint">
            <span>계좌별·자산군별 구성 보기</span>
            <span>{selectedKpi === "total" ? "▲ 닫기" : "🔍 상세 ▾"}</span>
          </div>
        </div>

        {/* Card 2: Stock Eval */}
        <div
          className={
            "kpi-card clickable" + (selectedKpi === "stock" ? " active" : "")
          }
          style={{ "--kpi-accent": "#8b5cf6" } as React.CSSProperties}
          onClick={() => toggleKpi("stock")}
        >
          <div className="kpi-label">
            <span>📈 주식 평가액</span>
            <span className="badge-flat">
              보유 {holdingsAtDate.length}종목
            </span>
          </div>
          <div className="kpi-value">
            {fmtKrw(latestSnap?.holdingsEval ?? 0)}
          </div>
          <div className="kpi-sub">
            <span>매수원금</span>
            <strong>{fmtKrw(latestSnap?.holdingsCost ?? 0)}</strong>
          </div>
          <div className="kpi-footer-hint">
            <span>국내·해외 비중 & 보유 TOP 10</span>
            <span>{selectedKpi === "stock" ? "▲ 닫기" : "🔍 상세 ▾"}</span>
          </div>
        </div>

        {/* Card 3: Unrealized P&L (Stock + FX) */}
        <div
          className={
            "kpi-card clickable" + (selectedKpi === "pnl" ? " active" : "")
          }
          style={
            {
              "--kpi-accent":
                (latestSnap?.profitAmount ?? 0) >= 0 ? "#ff6b6b" : "#60a5fa",
            } as React.CSSProperties
          }
          onClick={() => toggleKpi("pnl")}
        >
          <div className="kpi-label">
            <span>🎯 평가손익 (주가 + 환차)</span>
            <span className={pnlBadgeClass(latestSnap?.profitRate)}>
              {fmtPct(latestSnap?.profitRate ?? 0)}
            </span>
          </div>
          <div
            className={"kpi-value " + pnlClass(latestSnap?.profitAmount ?? 0)}
          >
            {fmtKrw(latestSnap?.profitAmount ?? 0, true)}
          </div>
          <div className="kpi-sub">
            <span
              className="kpi-chip"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedKpi("pnl");
              }}
            >
              주가{" "}
              <strong className={pnlClass(holdingsFxSummary.totalStockPnl)}>
                {fmtCompactKrw(holdingsFxSummary.totalStockPnl, true)}
              </strong>
            </span>
            <span
              className="kpi-chip"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedKpi("pnl");
              }}
            >
              환차{" "}
              <strong className={pnlClass(holdingsFxSummary.totalFxPnl)}>
                {fmtCompactKrw(holdingsFxSummary.totalFxPnl, true)}
              </strong>
            </span>
          </div>
          <div className="kpi-footer-hint">
            <span>수익·손실 TOP 5 & 환차 분해</span>
            <span>{selectedKpi === "pnl" ? "▲ 닫기" : "🔍 상세 ▾"}</span>
          </div>
        </div>

        {/* Card 4: Total Cash */}
        <div
          className={
            "kpi-card clickable" + (selectedKpi === "cash" ? " active" : "")
          }
          style={{ "--kpi-accent": "#10b981" } as React.CSSProperties}
          onClick={() => toggleKpi("cash")}
        >
          <div className="kpi-label">
            <span>💰 총 예수금 (현금)</span>
            <span className="badge-flat">
              비중{" "}
              {latestSnap && latestSnap.totalAssets > 0
                ? ((latestSnap.cash / latestSnap.totalAssets) * 100).toFixed(1)
                : "0.0"}
              %
            </span>
          </div>
          <div className="kpi-value">{fmtKrw(latestSnap?.cash ?? 0)}</div>
          <div className="kpi-sub">
            <span>원화 {fmtCompactKrw(latestSnap?.cashKrw ?? 0)}</span>
            <span>·</span>
            <span>달러 ${fmtNum(latestSnap?.cashUsd ?? 0, 2)}</span>
          </div>
          <div className="kpi-footer-hint">
            <span>계좌별 원화·달러 예수금 내역</span>
            <span>{selectedKpi === "cash" ? "▲ 닫기" : "🔍 상세 ▾"}</span>
          </div>
        </div>

        {/* Card 5: Cumulative Realized P&L & Dividends & Net Deposits */}
        <div
          className={
            "kpi-card clickable" +
            (selectedKpi === "realized" ? " active" : "")
          }
          style={{ "--kpi-accent": "#f59e0b" } as React.CSSProperties}
          onClick={() => {
            if (selectedKpi === "realized") {
              setSelectedKpi(null);
            } else {
              setRealizedSubTab("realized");
              setSelectedKpi("realized");
            }
          }}
        >
          <div className="kpi-label">
            <span>💸 누적 실현손익 & 배당</span>
            <span
              className="badge-up"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                setRealizedSubTab("dividend");
                setSelectedKpi("realized");
              }}
              title="클릭하여 배당금 세부내역 보기"
            >
              배당 {dividends.length}건 ▾
            </span>
          </div>
          <div className={"kpi-value " + pnlClass(totalRealizedNetPnl)}>
            {fmtKrw(totalRealizedNetPnl, true)}
          </div>
          <div className="kpi-sub">
            <span
              className="kpi-chip"
              onClick={(e) => {
                e.stopPropagation();
                setRealizedSubTab("dividend");
                setSelectedKpi("realized");
              }}
            >
              배당{" "}
              <strong className="text-up">
                {fmtCompactKrw(totalDividendsKrw, true)}
              </strong>
            </span>
            <span
              className="kpi-chip"
              onClick={(e) => {
                e.stopPropagation();
                setRealizedSubTab("cashflow");
                setSelectedKpi("realized");
              }}
            >
              순입금 <strong>{fmtCompactKrw(netDepositsKrw)}</strong>
            </span>
          </div>
          <div className="kpi-footer-hint">
            <span>실현손익 · 배당 · 순입금 해부</span>
            <span>{selectedKpi === "realized" ? "▲ 닫기" : "🔍 상세 ▾"}</span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          INTERACTIVE KPI DRILL-DOWN DRAWER
         ===================================================================== */}
      {selectedKpi && (
        <section className="kpi-detail-drawer">
          {/* 1) TOTAL ASSETS DRAWER */}
          {selectedKpi === "total" && (
            <>
              <div className="drawer-header">
                <div>
                  <h3 className="drawer-title">
                    🏦 총자산 세부 구성 & 계좌별·기간별 요약
                  </h3>
                  <div className="drawer-sub">
                    현재 총자산{" "}
                    <strong>{fmtKrw(latestSnap?.totalAssets ?? 0)}</strong>의
                    계좌별 비중, 자산군 배분, 기간별 증감 내역입니다.
                  </div>
                </div>
                <div className="filter-bar">
                  <button
                    className="btn btn-primary"
                    onClick={() => jumpToTab("trend")}
                  >
                    📅 자산 추이 & 기간별 성과 탭 전체 보기 →
                  </button>
                  <button
                    className="btn"
                    onClick={() => setSelectedKpi(null)}
                  >
                    ✕ 닫기
                  </button>
                </div>
              </div>

              {/* Asset Class Stacked Bar */}
              {latestSnap && latestSnap.totalAssets > 0 && (
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.65)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "12px 16px",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12.5,
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <span>
                      🇺🇸 해외주식:{" "}
                      <strong>{fmtKrw(holdingsFxSummary.usdEval)}</strong> (
                      {(
                        (holdingsFxSummary.usdEval / latestSnap.totalAssets) *
                        100
                      ).toFixed(1)}
                      %)
                    </span>
                    <span>
                      🇰🇷 국내주식:{" "}
                      <strong>{fmtKrw(holdingsFxSummary.krwEval)}</strong> (
                      {(
                        (holdingsFxSummary.krwEval / latestSnap.totalAssets) *
                        100
                      ).toFixed(1)}
                      %)
                    </span>
                    <span>
                      💰 예수금(현금):{" "}
                      <strong>{fmtKrw(latestSnap.cash)}</strong> (
                      {(
                        (latestSnap.cash / latestSnap.totalAssets) *
                        100
                      ).toFixed(1)}
                      %)
                    </span>
                  </div>
                  <div className="alloc-bar-stack">
                    <div
                      style={{
                        width: `${
                          (holdingsFxSummary.usdEval /
                            latestSnap.totalAssets) *
                          100
                        }%`,
                        background: "#3b82f6",
                      }}
                    />
                    <div
                      style={{
                        width: `${
                          (holdingsFxSummary.krwEval /
                            latestSnap.totalAssets) *
                          100
                        }%`,
                        background: "#8b5cf6",
                      }}
                    />
                    <div
                      style={{
                        width: `${
                          (latestSnap.cash / latestSnap.totalAssets) * 100
                        }%`,
                        background: "#10b981",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Account Comparison Cards (혜신 vs 동헌) */}
              <div className="grid-2" style={{ marginBottom: 14 }}>
                {(["혜신", "동헌"] as const).map((accName) => {
                  const snap = latestByAcc[accName];
                  if (!snap) return null;
                  const combinedTotal =
                    (latestByAcc.혜신?.totalAssets ?? 0) +
                    (latestByAcc.동헌?.totalAssets ?? 0);
                  const sharePct =
                    combinedTotal > 0
                      ? (snap.totalAssets / combinedTotal) * 100
                      : 0;
                  return (
                    <div
                      key={accName}
                      className="mini-box"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <strong style={{ fontSize: 15 }}>
                          {accName === "혜신" ? "👩 혜신 계좌" : "👨 동헌 계좌"}{" "}
                          <span className="acc-tag">
                            비중 {sharePct.toFixed(1)}%
                          </span>
                        </strong>
                        <button
                          className="btn"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => setAccount(accName)}
                        >
                          {account === accName
                            ? "현재 선택됨"
                            : `${accName} 계좌만 보기`}
                        </button>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>
                        {fmtKrw(snap.totalAssets)}{" "}
                        <span
                          className={pnlBadgeClass(snap.profitRate)}
                          style={{ verticalAlign: "middle" }}
                        >
                          {pnlArrow(snap.profitRate)} {fmtPct(snap.profitRate)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "var(--muted)",
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>주식평가 {fmtKrw(snap.holdingsEval)}</span>
                        <span>·</span>
                        <span>매수원금 {fmtKrw(snap.holdingsCost)}</span>
                        <span>·</span>
                        <span>예수금 {fmtKrw(snap.cash)}</span>
                        <span>·</span>
                        <span className={pnlClass(snap.profitAmount)}>
                          손익 {fmtKrw(snap.profitAmount, true)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Period Performance Mini Row */}
              {periodPerformance.length > 0 && (
                <div className="mini-summary-row" style={{ marginBottom: 0 }}>
                  {periodPerformance.slice(0, 4).map((p) => (
                    <div key={p.period} className="mini-box">
                      <div className="label">
                        {p.period} ({p.startDate.slice(5)}~)
                      </div>
                      <div className={"val " + pnlClass(p.pureProfit)}>
                        {fmtCompactKrw(p.pureProfit, true)}{" "}
                        <span className={pnlBadgeClass(p.dietzRate)}>
                          {fmtPct(p.dietzRate)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 2) STOCK EVAL DRAWER */}
          {selectedKpi === "stock" && (
            <>
              <div className="drawer-header">
                <div>
                  <h3 className="drawer-title">
                    📈 주식 평가액 세부 구성 (해외 vs 국내 · 보유 TOP 10)
                  </h3>
                  <div className="drawer-sub">
                    종목을 클릭하면 해당 종목의 매매이력·실현손익·배당금을 한눈에 보는{" "}
                    <strong>종목 360° 상세창</strong>이 열립니다.
                  </div>
                </div>
                <div className="filter-bar">
                  <button
                    className="btn btn-primary"
                    onClick={() => jumpToTab("portfolio")}
                  >
                    📊 포트폴리오 탭 전체 보기 →
                  </button>
                  <button
                    className="btn"
                    onClick={() => setSelectedKpi(null)}
                  >
                    ✕ 닫기
                  </button>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 14 }}>
                <div className="mini-box">
                  <div className="label">
                    🇺🇸 해외주식 (USD) · {holdingsFxSummary.usdCount}종목
                  </div>
                  <div className="val">
                    {fmtKrw(holdingsFxSummary.usdEval)}{" "}
                    <span
                      className={pnlBadgeClass(holdingsFxSummary.usdPnl)}
                      style={{ marginLeft: 6 }}
                    >
                      {fmtCompactKrw(holdingsFxSummary.usdPnl, true)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 4,
                    }}
                  >
                    매수원금 {fmtKrw(holdingsFxSummary.usdCost)} · 주식 내 비중{" "}
                    {holdingsFxSummary.totalEval > 0
                      ? (
                          (holdingsFxSummary.usdEval /
                            holdingsFxSummary.totalEval) *
                          100
                        ).toFixed(1)
                      : "0.0"}
                    %
                  </div>
                </div>

                <div className="mini-box">
                  <div className="label">
                    🇰🇷 국내주식 (KRW) · {holdingsFxSummary.krwCount}종목
                  </div>
                  <div className="val">
                    {fmtKrw(holdingsFxSummary.krwEval)}{" "}
                    <span
                      className={pnlBadgeClass(holdingsFxSummary.krwPnl)}
                      style={{ marginLeft: 6 }}
                    >
                      {fmtCompactKrw(holdingsFxSummary.krwPnl, true)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 4,
                    }}
                  >
                    매수원금 {fmtKrw(holdingsFxSummary.krwCost)} · 주식 내 비중{" "}
                    {holdingsFxSummary.totalEval > 0
                      ? (
                          (holdingsFxSummary.krwEval /
                            holdingsFxSummary.totalEval) *
                          100
                        ).toFixed(1)
                      : "0.0"}
                    %
                  </div>
                </div>
              </div>

              <div className="table-wrap" style={{ maxHeight: 310 }}>
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>시장</th>
                      <th>계좌</th>
                      <th>종목명 (클릭 시 360° 상세)</th>
                      <th className="num">보유수량</th>
                      <th className="num">평가금액(원)</th>
                      <th className="num">매수원금(원)</th>
                      <th className="num">총평가손익(원)</th>
                      <th className="num">수익률</th>
                      <th className="num">비중</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdingsAtDate.slice(0, 10).map((h, i) => (
                      <tr
                        key={h.key}
                        className="clickable-row"
                        onClick={() => setSelectedStockSymbol(h.symbol)}
                      >
                        <td>#{i + 1}</td>
                        <td>
                          <span
                            className={
                              "market-tag " +
                              (h.currency === "USD" ? "usd" : "krw")
                            }
                          >
                            {h.currency}
                          </span>
                        </td>
                        <td>
                          <span className="acc-tag">{h.accountLabel}</span>
                        </td>
                        <td>
                          🔍 <strong>{h.name}</strong>{" "}
                          <span
                            style={{ color: "var(--muted)", fontSize: 11.5 }}
                          >
                            ({h.symbol})
                          </span>
                        </td>
                        <td className="num">{fmtNum(h.quantity, 4)}</td>
                        <td className="num">
                          <strong>{fmtKrw(h.evalKrw)}</strong>
                        </td>
                        <td className="num">{fmtKrw(h.purchaseKrw)}</td>
                        <td className={"num " + pnlClass(h.profitKrw)}>
                          <strong>{fmtKrw(h.profitKrw, true)}</strong>
                        </td>
                        <td className="num">
                          <span className={pnlBadgeClass(h.profitRate)}>
                            {fmtPct(h.profitRate)}
                          </span>
                        </td>
                        <td className="num">{h.weightPct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 3) UNREALIZED P&L (STOCK + FX) DRAWER */}
          {selectedKpi === "pnl" && (
            <>
              <div className="drawer-header">
                <div>
                  <h3 className="drawer-title">
                    🎯 평가손익 정밀 해부 (순수 주가손익 vs 환차손익 · 수익/손실 TOP 5)
                  </h3>
                  <div className="drawer-sub">
                    원화 평가손익을 순수 주가 등락에 의한 손익과 달러 환율 변동에 의한 환차손익으로 나누어 보여줍니다.
                  </div>
                </div>
                <div className="filter-bar">
                  <button
                    className="btn btn-primary"
                    onClick={() => jumpToTab("portfolio")}
                  >
                    📊 포트폴리오 & 환차손익 탭으로 이동 →
                  </button>
                  <button
                    className="btn"
                    onClick={() => setSelectedKpi(null)}
                  >
                    ✕ 닫기
                  </button>
                </div>
              </div>

              <div className="mini-summary-row">
                <div className="mini-box">
                  <div className="label">📈 순수 주가 변동 손익</div>
                  <div
                    className={
                      "val " + pnlClass(holdingsFxSummary.totalStockPnl)
                    }
                  >
                    {fmtKrw(holdingsFxSummary.totalStockPnl, true)}
                  </div>
                </div>
                <div className="mini-box">
                  <div className="label">💱 환율 변동 손익 (환차손익)</div>
                  <div
                    className={"val " + pnlClass(holdingsFxSummary.totalFxPnl)}
                  >
                    {fmtKrw(holdingsFxSummary.totalFxPnl, true)}
                  </div>
                </div>
                <div className="mini-box">
                  <div className="label">🎯 합산 총 평가손익 (원화)</div>
                  <div
                    className={"val " + pnlClass(holdingsFxSummary.totalPnl)}
                  >
                    {fmtKrw(holdingsFxSummary.totalPnl, true)}
                  </div>
                </div>
                <div className="mini-box">
                  <div className="label">수익 종목 vs 손실 종목 수</div>
                  <div className="val">
                    <span className="text-up">
                      🔴 수익{" "}
                      {holdingsAtDate.filter((h) => h.profitKrw > 0).length}개
                    </span>{" "}
                    /{" "}
                    <span className="text-down">
                      🔵 손실{" "}
                      {holdingsAtDate.filter((h) => h.profitKrw < 0).length}개
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0 }}>
                {/* Top 5 Winners */}
                <div className="table-wrap">
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th>🔴 수익 효자 TOP 5</th>
                        <th className="num">주가손익</th>
                        <th className="num">환차손익</th>
                        <th className="num">총손익 (수익률)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...holdingsAtDate]
                        .filter((h) => h.profitKrw > 0)
                        .sort((a, b) => b.profitKrw - a.profitKrw)
                        .slice(0, 5)
                        .map((h) => (
                          <tr
                            key={h.key}
                            className="clickable-row"
                            onClick={() => setSelectedStockSymbol(h.symbol)}
                          >
                            <td>
                              🔍 <strong>{h.name}</strong>{" "}
                              <span className="acc-tag">{h.accountLabel}</span>
                            </td>
                            <td className={"num " + pnlClass(h.stockPnlKrw)}>
                              {fmtCompactKrw(h.stockPnlKrw, true)}
                            </td>
                            <td className={"num " + pnlClass(h.fxPnlKrw)}>
                              {h.currency === "USD"
                                ? fmtCompactKrw(h.fxPnlKrw, true)
                                : "—"}
                            </td>
                            <td className="num text-up">
                              <strong>{fmtCompactKrw(h.profitKrw, true)}</strong>{" "}
                              ({fmtPct(h.profitRate)})
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Top 5 Losers */}
                <div className="table-wrap">
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th>🔵 손실 유의 TOP 5</th>
                        <th className="num">주가손익</th>
                        <th className="num">환차손익</th>
                        <th className="num">총손익 (수익률)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...holdingsAtDate]
                        .filter((h) => h.profitKrw < 0)
                        .sort((a, b) => a.profitKrw - b.profitKrw)
                        .slice(0, 5)
                        .map((h) => (
                          <tr
                            key={h.key}
                            className="clickable-row"
                            onClick={() => setSelectedStockSymbol(h.symbol)}
                          >
                            <td>
                              🔍 <strong>{h.name}</strong>{" "}
                              <span className="acc-tag">{h.accountLabel}</span>
                            </td>
                            <td className={"num " + pnlClass(h.stockPnlKrw)}>
                              {fmtCompactKrw(h.stockPnlKrw, true)}
                            </td>
                            <td className={"num " + pnlClass(h.fxPnlKrw)}>
                              {h.currency === "USD"
                                ? fmtCompactKrw(h.fxPnlKrw, true)
                                : "—"}
                            </td>
                            <td className="num text-down">
                              <strong>{fmtCompactKrw(h.profitKrw, true)}</strong>{" "}
                              ({fmtPct(h.profitRate)})
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 4) CASH DRAWER */}
          {selectedKpi === "cash" && (
            <>
              <div className="drawer-header">
                <div>
                  <h3 className="drawer-title">
                    💰 예수금(현금) 통화별 · 계좌별 상세 내역
                  </h3>
                  <div className="drawer-sub">
                    원화 예수금과 달러 예수금($) 보유 현황 및 최근 입출금·배당 현금 흐름입니다.
                  </div>
                </div>
                <div className="filter-bar">
                  <button
                    className="btn btn-primary"
                    onClick={() => jumpToTab("cashflow")}
                  >
                    🏧 입출금 탭 전체 보기 →
                  </button>
                  <button
                    className="btn"
                    onClick={() => setSelectedKpi(null)}
                  >
                    ✕ 닫기
                  </button>
                </div>
              </div>

              <div className="mini-summary-row" style={{ marginBottom: 0 }}>
                <div className="mini-box">
                  <div className="label">🇰🇷 원화 예수금 합계</div>
                  <div className="val">{fmtKrw(latestSnap?.cashKrw ?? 0)}</div>
                </div>
                <div className="mini-box">
                  <div className="label">
                    🇺🇸 달러 예수금 합계 (환율{" "}
                    {fmtNum(latestSnap?.usdKrwRate ?? 0, 1)}원)
                  </div>
                  <div className="val">
                    ${fmtNum(latestSnap?.cashUsd ?? 0, 2)}{" "}
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>
                      (약{" "}
                      {fmtKrw(
                        (latestSnap?.cashUsd ?? 0) *
                          (latestSnap?.usdKrwRate ?? 1380)
                      )}
                      )
                    </span>
                  </div>
                </div>
                <div className="mini-box">
                  <div className="label">👩 혜신 계좌 예수금</div>
                  <div className="val">
                    {fmtKrw(latestByAcc.혜신?.cash ?? 0)}{" "}
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      (${fmtNum(latestByAcc.혜신?.cashUsd ?? 0, 2)})
                    </span>
                  </div>
                </div>
                <div className="mini-box">
                  <div className="label">👨 동헌 계좌 예수금</div>
                  <div className="val">
                    {fmtKrw(latestByAcc.동헌?.cash ?? 0)}{" "}
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      (${fmtNum(latestByAcc.동헌?.cashUsd ?? 0, 2)})
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 5) REALIZED P&L + DIVIDENDS + NET DEPOSITS DRAWER */}
          {selectedKpi === "realized" && (
            <>
              <div className="drawer-header">
                <div>
                  <h3 className="drawer-title">
                    💸 누적 실현손익 · 배당금 · 순입금 통합 상세 내역
                  </h3>
                  <div className="drawer-sub">
                    하단 버튼을 눌러 <strong>실현손익·양도세</strong>,{" "}
                    <strong>세후 배당금</strong>, <strong>순입금 원금</strong> 세부 내역을 바로 전환해 보세요.
                  </div>
                </div>

                <div className="filter-bar">
                  <div className="seg-group">
                    <button
                      className={
                        "seg-btn" +
                        (realizedSubTab === "realized" ? " active" : "")
                      }
                      onClick={() => setRealizedSubTab("realized")}
                    >
                      💸 실현손익 ({realizedTrades.length}건)
                    </button>
                    <button
                      className={
                        "seg-btn" +
                        (realizedSubTab === "dividend" ? " active" : "")
                      }
                      onClick={() => setRealizedSubTab("dividend")}
                    >
                      💵 누적 배당 ({dividends.length}건)
                    </button>
                    <button
                      className={
                        "seg-btn" +
                        (realizedSubTab === "cashflow" ? " active" : "")
                      }
                      onClick={() => setRealizedSubTab("cashflow")}
                    >
                      🏧 순입금 ({cashFlows.length}건)
                    </button>
                  </div>

                  <button
                    className="btn"
                    onClick={() => setSelectedKpi(null)}
                  >
                    ✕ 닫기
                  </button>
                </div>
              </div>

              {/* SubTab A: Realized Trades */}
              {realizedSubTab === "realized" && (
                <>
                  <div className="mini-summary-row">
                    <div className="mini-box">
                      <div className="label">전체 누적 순실현손익</div>
                      <div
                        className={"val " + pnlClass(totalRealizedNetPnl)}
                      >
                        {fmtKrw(totalRealizedNetPnl, true)}
                      </div>
                    </div>
                    <div className="mini-box">
                      <div className="label">
                        {yearlyTaxSummaries[0]?.year ?? currentYear}년 해외주식 실현손익
                      </div>
                      <div
                        className={
                          "val " +
                          pnlClass(yearlyTaxSummaries[0]?.usdNetPnlKrw ?? 0)
                        }
                      >
                        {fmtKrw(
                          yearlyTaxSummaries[0]?.usdNetPnlKrw ?? 0,
                          true
                        )}
                      </div>
                    </div>
                    <div className="mini-box">
                      <div className="label">
                        {yearlyTaxSummaries[0]?.year ?? currentYear}년 예상 양도세 (22%)
                      </div>
                      <div className="val">
                        {fmtKrw(
                          yearlyTaxSummaries[0]?.estimatedTaxKrw ?? 0
                        )}
                      </div>
                    </div>
                    <div
                      className="mini-box"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        className="btn btn-primary"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => jumpToTab("tax")}
                      >
                        💸 실현손익 & 양도소득세 탭 전체 보기 →
                      </button>
                    </div>
                  </div>

                  <div className="table-wrap" style={{ maxHeight: 280 }}>
                    <table className="stock-table">
                      <thead>
                        <tr>
                          <th>체결일</th>
                          <th>계좌</th>
                          <th>종목명 (클릭 시 360° 상세)</th>
                          <th className="num">매도수량</th>
                          <th className="num">매도금액(원)</th>
                          <th className="num">취득원가(원)</th>
                          <th className="num">주가손익</th>
                          <th className="num">환차손익</th>
                          <th className="num">순실현손익(원)</th>
                          <th className="num">수익률</th>
                        </tr>
                      </thead>
                      <tbody>
                        {realizedTrades.slice(0, 8).map((t) => (
                          <tr
                            key={`${t.accountLabel}-${t.orderId}`}
                            className="clickable-row"
                            onClick={() => setSelectedStockSymbol(t.symbol)}
                          >
                            <td>{t.date}</td>
                            <td>
                              <span className="acc-tag">{t.accountLabel}</span>
                            </td>
                            <td>
                              🔍 <strong>{t.name}</strong> ({t.symbol})
                            </td>
                            <td className="num">{fmtNum(t.qty, 4)}</td>
                            <td className="num">{fmtKrw(t.proceedsKrw)}</td>
                            <td className="num">{fmtKrw(t.costKrw)}</td>
                            <td className={"num " + pnlClass(t.stockPnlKrw)}>
                              {fmtKrw(t.stockPnlKrw, true)}
                            </td>
                            <td className={"num " + pnlClass(t.fxPnlKrw)}>
                              {t.currency === "USD"
                                ? fmtKrw(t.fxPnlKrw, true)
                                : "—"}
                            </td>
                            <td className={"num " + pnlClass(t.netPnlKrw)}>
                              <strong>{fmtKrw(t.netPnlKrw, true)}</strong>
                            </td>
                            <td className="num">
                              <span className={pnlBadgeClass(t.pnlRate)}>
                                {fmtPct(t.pnlRate)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* SubTab B: Dividends */}
              {realizedSubTab === "dividend" && (
                <>
                  <div className="mini-summary-row">
                    <div className="mini-box">
                      <div className="label">총 누적 세후배당금</div>
                      <div className="val text-up">
                        {fmtKrw(totalDividendsKrw, true)}
                      </div>
                    </div>
                    <div className="mini-box">
                      <div className="label">{currentYear}년 세후배당금</div>
                      <div className="val text-up">
                        {fmtKrw(thisYearDivKrw, true)}
                      </div>
                    </div>
                    <div className="mini-box">
                      <div className="label">최다 배당 TOP 종목</div>
                      <div className="val">
                        {divByStock[0]
                          ? `${divByStock[0].name} (${fmtCompactKrw(
                              divByStock[0].amount
                            )})`
                          : "—"}
                      </div>
                    </div>
                    <div
                      className="mini-box"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        className="btn btn-primary"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => jumpToTab("dividends")}
                      >
                        💵 배당금 내역 탭 전체 보기 →
                      </button>
                    </div>
                  </div>

                  <div className="table-wrap" style={{ maxHeight: 280 }}>
                    <table className="stock-table">
                      <thead>
                        <tr>
                          <th>지급일</th>
                          <th>계좌</th>
                          <th>종목명 (클릭 시 360° 상세)</th>
                          <th>통화</th>
                          <th className="num">세전배당금</th>
                          <th className="num">세금</th>
                          <th className="num">세후배당금(원)</th>
                          <th>메모</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dividends.slice(0, 8).map((d) => (
                          <tr
                            key={`${d.accountLabel}-${d.id}`}
                            className="clickable-row"
                            onClick={() => setSelectedStockSymbol(d.symbol)}
                          >
                            <td>{d.date}</td>
                            <td>
                              <span className="acc-tag">{d.accountLabel}</span>
                            </td>
                            <td>
                              🔍 <strong>{d.name}</strong> ({d.symbol})
                            </td>
                            <td>{d.currency}</td>
                            <td className="num">
                              {fmtPrice(d.grossAmountNative, d.currency)}
                            </td>
                            <td className="num">
                              {fmtPrice(d.taxNative, d.currency)}
                            </td>
                            <td className="num text-up">
                              <strong>{fmtKrw(d.netAmountKrw, true)}</strong>
                            </td>
                            <td
                              style={{ color: "var(--muted)", fontSize: 12 }}
                            >
                              {d.memo}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* SubTab C: Net Deposits & CashFlows */}
              {realizedSubTab === "cashflow" && (
                <>
                  <div className="mini-summary-row">
                    <div className="mini-box">
                      <div className="label">🔴 누적 총 입금액</div>
                      <div className="val text-up">
                        {fmtKrw(cfSummary.totalIn)}
                      </div>
                    </div>
                    <div className="mini-box">
                      <div className="label">🔵 누적 총 출금액</div>
                      <div className="val text-down">
                        {fmtKrw(cfSummary.totalOut)}
                      </div>
                    </div>
                    <div className="mini-box">
                      <div className="label">
                        순입금 대비 실질 수익금 (수익률)
                      </div>
                      <div
                        className={"val " + pnlClass(cfSummary.pureProfit)}
                      >
                        {fmtKrw(cfSummary.pureProfit, true)} (
                        {fmtPct(cfSummary.pureRate)})
                      </div>
                    </div>
                    <div
                      className="mini-box"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        className="btn btn-primary"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => jumpToTab("cashflow")}
                      >
                        🏧 입출금 & 실질 수익 탭 전체 보기 →
                      </button>
                    </div>
                  </div>

                  <div className="table-wrap" style={{ maxHeight: 260 }}>
                    <table className="stock-table">
                      <thead>
                        <tr>
                          <th>날짜</th>
                          <th>계좌</th>
                          <th>구분</th>
                          <th className="num">금액(원)</th>
                          <th>메모</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashFlows.slice(0, 8).map((c) => (
                          <tr key={`${c.accountLabel}-${c.id}`}>
                            <td>{c.date}</td>
                            <td>
                              <span className="acc-tag">{c.accountLabel}</span>
                            </td>
                            <td>
                              <span
                                className={
                                  c.type === "DEPOSIT"
                                    ? "badge-up"
                                    : "badge-down"
                                }
                              >
                                {c.type === "DEPOSIT" ? "🔴 입금" : "🔵 출금"}
                              </span>
                            </td>
                            <td
                              className={
                                "num " +
                                (c.type === "DEPOSIT"
                                  ? "text-up"
                                  : "text-down")
                              }
                            >
                              <strong>
                                {c.type === "DEPOSIT" ? "+" : "-"}
                                {fmtKrw(c.amount)}
                              </strong>
                            </td>
                            <td>{c.memo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}

      {/* =====================================================================
          STOCK 360° DETAIL MODAL (When clicking any stock row)
         ===================================================================== */}
      {stock360Data && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedStockSymbol(null)}
        >
          <div
            className="stock-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <h2 className="drawer-title">
                  🔍 {stock360Data.name}{" "}
                  <span style={{ color: "var(--muted)", fontSize: 14 }}>
                    ({stock360Data.symbol})
                  </span>
                  <span
                    className={
                      "market-tag " +
                      (stock360Data.currency === "USD" ? "usd" : "krw")
                    }
                  >
                    {stock360Data.currency}
                  </span>
                </h2>
                <div className="drawer-sub">
                  현재 보유 현황 · 매매 체결 이력({stock360Data.stockOrders.length}건) · 매도 실현손익({stock360Data.stockRealized.length}건) · 배당 수령({stock360Data.stockDividends.length}건) 통합 분석
                </div>
              </div>
              <button
                className="btn"
                onClick={() => setSelectedStockSymbol(null)}
              >
                ✕ 닫기
              </button>
            </div>

            <div className="mini-summary-row">
              <div className="mini-box">
                <div className="label">현재 보유 평가액 (보유수량)</div>
                <div className="val">
                  {stock360Data.holdingMerged
                    ? `${fmtKrw(stock360Data.holdingMerged.evalKrw)} (${fmtNum(
                        stock360Data.holdingMerged.quantity,
                        4
                      )}주)`
                    : "현재 미보유 (전량 매도)"}
                </div>
              </div>
              <div className="mini-box">
                <div className="label">현재 미실현 평가손익</div>
                <div className={"val " + pnlClass(stock360Data.unrealizedPnl)}>
                  {fmtKrw(stock360Data.unrealizedPnl, true)}{" "}
                  {stock360Data.holdingMerged && (
                    <span style={{ fontSize: 12 }}>
                      ({fmtPct(stock360Data.holdingMerged.profitRate)})
                    </span>
                  )}
                </div>
              </div>
              <div className="mini-box">
                <div className="label">과거 매도 누적 실현손익</div>
                <div className={"val " + pnlClass(stock360Data.totalRealized)}>
                  {fmtKrw(stock360Data.totalRealized, true)} (
                  {stock360Data.stockRealized.length}회)
                </div>
              </div>
              <div className="mini-box">
                <div className="label">누적 수령 배당금 (총 누적 기여손익)</div>
                <div className="val text-up">
                  {fmtKrw(stock360Data.totalDiv, true)}{" "}
                  <span
                    className={pnlClass(stock360Data.totalLifetimeReturn)}
                    style={{ fontSize: 12 }}
                  >
                    (총 {fmtCompactKrw(stock360Data.totalLifetimeReturn, true)})
                  </span>
                </div>
              </div>
            </div>

            {stock360Data.stockRealized.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <strong
                  style={{ display: "block", fontSize: 13.5, marginBottom: 8 }}
                >
                  💸 이 종목의 매도 실현손익 내역 ({stock360Data.stockRealized.length}건)
                </strong>
                <div className="table-wrap" style={{ maxHeight: 200 }}>
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th>체결일</th>
                        <th>계좌</th>
                        <th className="num">매도수량</th>
                        <th className="num">매도단가</th>
                        <th className="num">취득평단가</th>
                        <th className="num">주가손익</th>
                        <th className="num">환차손익</th>
                        <th className="num">순실현손익(원)</th>
                        <th className="num">수익률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock360Data.stockRealized.map((r) => (
                        <tr key={`${r.accountLabel}-${r.orderId}`}>
                          <td>{r.date}</td>
                          <td>
                            <span className="acc-tag">{r.accountLabel}</span>
                          </td>
                          <td className="num">{fmtNum(r.qty, 4)}</td>
                          <td className="num">
                            {fmtPrice(r.sellPriceNative, r.currency)}
                          </td>
                          <td className="num">
                            {fmtPrice(r.avgBuyPriceNative, r.currency)}
                          </td>
                          <td className={"num " + pnlClass(r.stockPnlKrw)}>
                            {fmtKrw(r.stockPnlKrw, true)}
                          </td>
                          <td className={"num " + pnlClass(r.fxPnlKrw)}>
                            {r.currency === "USD"
                              ? fmtKrw(r.fxPnlKrw, true)
                              : "—"}
                          </td>
                          <td className={"num " + pnlClass(r.netPnlKrw)}>
                            <strong>{fmtKrw(r.netPnlKrw, true)}</strong>
                          </td>
                          <td className="num">
                            <span className={pnlBadgeClass(r.pnlRate)}>
                              {fmtPct(r.pnlRate)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {stock360Data.stockDividends.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <strong
                  style={{ display: "block", fontSize: 13.5, marginBottom: 8 }}
                >
                  💵 이 종목에서 받은 배당금 내역 ({stock360Data.stockDividends.length}건)
                </strong>
                <div className="table-wrap" style={{ maxHeight: 190 }}>
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th>지급일</th>
                        <th>계좌</th>
                        <th className="num">세전배당</th>
                        <th className="num">세금</th>
                        <th className="num">세후배당금(원)</th>
                        <th>메모</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock360Data.stockDividends.map((d) => (
                        <tr key={`${d.accountLabel}-${d.id}`}>
                          <td>{d.date}</td>
                          <td>
                            <span className="acc-tag">{d.accountLabel}</span>
                          </td>
                          <td className="num">
                            {fmtPrice(d.grossAmountNative, d.currency)}
                          </td>
                          <td className="num">
                            {fmtPrice(d.taxNative, d.currency)}
                          </td>
                          <td className="num text-up">
                            <strong>{fmtKrw(d.netAmountKrw, true)}</strong>
                          </td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>
                            {d.memo}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <strong
                style={{ display: "block", fontSize: 13.5, marginBottom: 8 }}
              >
                🧾 이 종목의 전체 매수·매도 체결 이력 ({stock360Data.stockOrders.length}건)
              </strong>
              <div className="table-wrap" style={{ maxHeight: 240 }}>
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>거래일자</th>
                      <th>계좌</th>
                      <th>구분</th>
                      <th className="num">체결수량</th>
                      <th className="num">체결단가</th>
                      <th className="num">환율</th>
                      <th className="num">체결금액(원)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock360Data.stockOrders.map((o) => (
                      <tr key={`${o.accountLabel}-${o.orderId}`}>
                        <td>{o.date}</td>
                        <td>
                          <span className="acc-tag">{o.accountLabel}</span>
                        </td>
                        <td>
                          <span
                            className={
                              o.side === "BUY" ? "badge-up" : "badge-down"
                            }
                          >
                            {o.side === "BUY" ? "🔴 매수" : "🔵 매도"}
                          </span>
                        </td>
                        <td className="num">{fmtNum(o.filledQuantity, 4)}</td>
                        <td className="num">
                          {fmtPrice(o.averageFilledPrice, o.currency)}
                        </td>
                        <td className="num">
                          {o.currency === "USD" && o.fxRate > 1
                            ? `${fmtNum(o.fxRate, 1)}원`
                            : "—"}
                        </td>
                        <td
                          className={
                            "num " +
                            (o.side === "BUY" ? "text-up" : "text-down")
                          }
                        >
                          <strong>{fmtKrw(o.filledAmountKrw)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main 6 Navigation Tabs */}
      <nav className="nav-tabs">
        {(
          [
            { id: "portfolio", label: "📊 포트폴리오 & 환차손익" },
            { id: "trend", label: "📅 자산 추이 & 기간별 성과" },
            {
              id: "tax",
              label: `💸 실현손익 & 양도소득세 (${realizedTrades.length}건)`,
            },
            { id: "orders", label: `🧾 매매 체결 이력 (${orders.length}건)` },
            { id: "dividends", label: `💵 배당금 내역 (${dividends.length}건)` },
            { id: "cashflow", label: "🏧 입출금 & 실질 수익" },
          ] as { id: MainTab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            className={"nav-tab" + (activeTab === t.id ? " active" : "")}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* TAB 1: Portfolio & Holdings (with FX P&L Decomposition) */}
      {activeTab === "portfolio" && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">
                📊 보유종목 타임머신 & 주가·환차손익 분해
              </h2>
              <div className="panel-sub">
                해외주식의 원화 평가손익을 순수 주가 변동분(주가손익)과 환율 변동분(환차손익)으로 정밀 분해합니다. 종목을 클릭하면 <strong>360° 상세 모달</strong>이 열립니다.
              </div>
            </div>

            <div className="filter-bar">
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>
                📅 스냅샷 기준일:
              </label>
              <select
                className="select-input"
                value={effectiveHoldingDate}
                onChange={(e) => setSelectedHoldingDate(e.target.value)}
              >
                {holdingDates.map((d, i) => (
                  <option key={d} value={d}>
                    {d} {i === 0 ? "(최신)" : ""}
                  </option>
                ))}
              </select>

              {account === "ALL" && (
                <div className="seg-group">
                  <button
                    className={"seg-btn" + (mergeHoldings ? " active" : "")}
                    onClick={() => setMergeHoldings(true)}
                  >
                    🔗 동일종목 합산
                  </button>
                  <button
                    className={"seg-btn" + (!mergeHoldings ? " active" : "")}
                    onClick={() => setMergeHoldings(false)}
                  >
                    👥 계좌별 분리
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* FX Decomposition Summary Banner */}
          <div className="mini-summary-row">
            <div className="mini-box">
              <div className="label">총 평가금액 (원금 합계)</div>
              <div className="val">
                {fmtKrw(holdingsFxSummary.totalEval)}{" "}
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  (원금 {fmtCompactKrw(holdingsFxSummary.totalCost)})
                </span>
              </div>
            </div>
            <div className="mini-box">
              <div className="label">📈 순수 주가 평가손익 (원)</div>
              <div
                className={"val " + pnlClass(holdingsFxSummary.totalStockPnl)}
              >
                {fmtKrw(holdingsFxSummary.totalStockPnl, true)}
              </div>
            </div>
            <div className="mini-box">
              <div className="label">💱 환율 변동 평가손익 (환차손익)</div>
              <div className={"val " + pnlClass(holdingsFxSummary.totalFxPnl)}>
                {fmtKrw(holdingsFxSummary.totalFxPnl, true)}
              </div>
            </div>
            <div className="mini-box">
              <div className="label">🎯 총 평가손익 (주가 + 환차)</div>
              <div className={"val " + pnlClass(holdingsFxSummary.totalPnl)}>
                {fmtKrw(holdingsFxSummary.totalPnl, true)}
              </div>
            </div>
          </div>

          <div className="grid-2">
            {/* Allocation Donut Chart */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.55)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <strong style={{ fontSize: 14 }}>🍩 자산 배분 비중</strong>
                <div className="seg-group">
                  <button
                    className={
                      "seg-btn" + (allocMode === "stock" ? " active" : "")
                    }
                    onClick={() => setAllocMode("stock")}
                  >
                    종목별
                  </button>
                  <button
                    className={
                      "seg-btn" + (allocMode === "market" ? " active" : "")
                    }
                    onClick={() => setAllocMode("market")}
                  >
                    국내·해외·현금
                  </button>
                </div>
              </div>

              <div style={{ height: 270 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={2}
                    >
                      {pieData.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={PIE_COLORS[idx % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => fmtKrw(val)}
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid rgba(148,163,184,0.3)",
                        borderRadius: 10,
                        color: "#f1f5f9",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Per-Stock Profit/Loss Bar Chart */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.55)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <strong style={{ fontSize: 14 }}>
                  📊 종목별 총평가손익 (🔴 수익 / 🔵 손실)
                </strong>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  상위 10개 종목
                </span>
              </div>

              <div style={{ height: 270 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...holdingsAtDate]
                      .sort(
                        (a, b) =>
                          Math.abs(b.profitKrw) - Math.abs(a.profitKrw)
                      )
                      .slice(0, 10)
                      .map((h) => ({
                        name:
                          h.name.length > 9
                            ? h.name.slice(0, 9) + "…"
                            : h.name,
                        profitKrw: Math.round(h.profitKrw),
                      }))}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 24, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148,163,184,0.12)"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => fmtCompactKrw(v)}
                      stroke="#94a3b8"
                      fontSize={11}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      stroke="#e2e8f0"
                      fontSize={11.5}
                    />
                    <ReferenceLine x={0} stroke="rgba(148,163,184,0.4)" />
                    <Tooltip
                      formatter={(val: number) => [
                        fmtKrw(val, true),
                        "총평가손익",
                      ]}
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid rgba(148,163,184,0.3)",
                        borderRadius: 10,
                        color: "#f1f5f9",
                      }}
                    />
                    <Bar dataKey="profitKrw" radius={[4, 4, 4, 4]}>
                      {[...holdingsAtDate]
                        .sort(
                          (a, b) =>
                            Math.abs(b.profitKrw) - Math.abs(a.profitKrw)
                        )
                        .slice(0, 10)
                        .map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={
                              entry.profitKrw >= 0 ? "#ff6b6b" : "#60a5fa"
                            }
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Holdings Table Filter & Search */}
          <div className="panel-head" style={{ marginTop: 8 }}>
            <div className="filter-bar">
              <div className="seg-group">
                {(
                  [
                    { k: "ALL", l: "전체 시장" },
                    { k: "USD", l: "🇺🇸 해외 (USD)" },
                    { k: "KRW", l: "🇰🇷 국내 (KRW)" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.k}
                    className={
                      "seg-btn" +
                      (holdingMarketFilter === m.k ? " active" : "")
                    }
                    onClick={() => setHoldingMarketFilter(m.k)}
                  >
                    {m.l}
                  </button>
                ))}
              </div>

              <input
                className="text-input"
                placeholder="🔍 종목명 또는 티커 검색..."
                value={holdingSearch}
                onChange={(e) => setHoldingSearch(e.target.value)}
              />
            </div>

            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              총 <strong>{filteredHoldings.length}</strong>개 종목 · 평가금액 합계{" "}
              <strong>
                {fmtKrw(filteredHoldings.reduce((s, h) => s + h.evalKrw, 0))}
              </strong>
            </div>
          </div>

          <div className="table-wrap">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>시장</th>
                  <th>계좌</th>
                  <th>종목명 (클릭 시 360° 상세)</th>
                  <th className="num">보유수량</th>
                  <th className="num">평단가</th>
                  <th className="num">현재가</th>
                  <th className="num">매수환율</th>
                  <th className="num">평가금액(원)</th>
                  <th className="num">매수원금(원)</th>
                  <th className="num">주가손익(원)</th>
                  <th className="num">환차손익(원)</th>
                  <th className="num">총평가손익(원)</th>
                  <th className="num">수익률(원화)</th>
                  <th className="num">비중(%)</th>
                </tr>
              </thead>
              <tbody>
                {filteredHoldings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={14}
                      style={{
                        textAlign: "center",
                        padding: 36,
                        color: "var(--muted)",
                      }}
                    >
                      표시할 보유종목 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredHoldings.map((h) => (
                    <tr
                      key={h.key}
                      className="clickable-row"
                      onClick={() => setSelectedStockSymbol(h.symbol)}
                    >
                      <td>
                        <span
                          className={
                            "market-tag " +
                            (h.currency.toUpperCase() === "USD" ? "usd" : "krw")
                          }
                        >
                          {h.currency.toUpperCase() === "USD"
                            ? "해외 USD"
                            : "국내 KRW"}
                        </span>
                      </td>
                      <td>
                        <span className="acc-tag">{h.accountLabel}</span>
                      </td>
                      <td>
                        🔍 <strong>{h.name}</strong>{" "}
                        <span style={{ color: "var(--muted)", fontSize: 11.5 }}>
                          ({h.symbol})
                        </span>
                      </td>
                      <td className="num">{fmtNum(h.quantity, 4)}</td>
                      <td className="num">
                        {fmtPrice(h.avgPrice, h.currency)}
                      </td>
                      <td className="num">
                        {fmtPrice(h.lastPrice, h.currency)}
                      </td>
                      <td className="num" style={{ color: "var(--muted)" }}>
                        {h.currency.toUpperCase() === "USD" && h.avgBuyFx > 1
                          ? `${fmtNum(h.avgBuyFx, 1)}원`
                          : "—"}
                      </td>
                      <td className="num">
                        <strong>{fmtKrw(h.evalKrw)}</strong>
                      </td>
                      <td className="num">{fmtKrw(h.purchaseKrw)}</td>
                      <td className={"num " + pnlClass(h.stockPnlKrw)}>
                        {fmtKrw(h.stockPnlKrw, true)}
                      </td>
                      <td className={"num " + pnlClass(h.fxPnlKrw)}>
                        {h.currency.toUpperCase() === "USD"
                          ? fmtKrw(h.fxPnlKrw, true)
                          : "—"}
                      </td>
                      <td className={"num " + pnlClass(h.profitKrw)}>
                        <strong>{fmtKrw(h.profitKrw, true)}</strong>
                      </td>
                      <td className="num">
                        <span className={pnlBadgeClass(h.profitRate)}>
                          {pnlArrow(h.profitRate)} {fmtPct(h.profitRate)}
                        </span>
                      </td>
                      <td className="num">{h.weightPct.toFixed(1)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Daily / Monthly Asset Trend & Period Performance */}
      {activeTab === "trend" && (
        <>
          {periodPerformance.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">
                    🏆 기간별 투자 성과 요약 (Modified Dietz 실질 성장률)
                  </h2>
                  <div className="panel-sub">
                    최근 1주 · 1개월 · 3개월 · 6개월 · 올해(YTD) · 1년 · 전체 기록 기간 동안 입출금 왜곡을 제거한 순수 투자손익과 실질 성장률입니다.
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>구간</th>
                      <th>산정 기간</th>
                      <th className="num">기초자산(원)</th>
                      <th className="num">기말자산(원)</th>
                      <th className="num">기간 내 순입출금(원)</th>
                      <th className="num">단순 자산증감(원)</th>
                      <th className="num">단순 증감률(%)</th>
                      <th className="num">순수 투자손익(입출금 제외)</th>
                      <th className="num">실질 투자성장률(Dietz %)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodPerformance.map((p) => (
                      <tr key={p.period}>
                        <td>
                          <strong>{p.period}</strong>
                        </td>
                        <td style={{ color: "var(--muted)", fontSize: 12 }}>
                          {p.startDate} ~ {p.endDate}
                        </td>
                        <td className="num">{fmtKrw(p.startAssets)}</td>
                        <td className="num">
                          <strong>{fmtKrw(p.endAssets)}</strong>
                        </td>
                        <td className={"num " + pnlClass(p.netCashFlow)}>
                          {p.netCashFlow !== 0
                            ? fmtKrw(p.netCashFlow, true)
                            : "0원"}
                        </td>
                        <td className={"num " + pnlClass(p.simpleChange)}>
                          {fmtKrw(p.simpleChange, true)}
                        </td>
                        <td className={"num " + pnlClass(p.simpleRate)}>
                          {fmtPct(p.simpleRate)}
                        </td>
                        <td className={"num " + pnlClass(p.pureProfit)}>
                          <strong>{fmtKrw(p.pureProfit, true)}</strong>
                        </td>
                        <td className="num">
                          <span className={pnlBadgeClass(p.dietzRate)}>
                            {pnlArrow(p.dietzRate)} {fmtPct(p.dietzRate)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">📅 일별 · 월별 자산 추이</h2>
                <div className="panel-sub">
                  월말 기준 요약 또는 일별 전체 스냅샷으로 총자산·매수원금·평가손익 흐름을 비교합니다.
                </div>
              </div>

              <div className="filter-bar">
                <div className="seg-group">
                  <button
                    className={
                      "seg-btn" +
                      (trendGranularity === "monthly" ? " active" : "")
                    }
                    onClick={() => setTrendGranularity("monthly")}
                  >
                    📆 월말 요약 (추천)
                  </button>
                  <button
                    className={
                      "seg-btn" +
                      (trendGranularity === "daily" ? " active" : "")
                    }
                    onClick={() => setTrendGranularity("daily")}
                  >
                    📅 일별 전체 보기
                  </button>
                </div>

                <div className="seg-group">
                  {(
                    [
                      { k: "1M", l: "1개월" },
                      { k: "3M", l: "3개월" },
                      { k: "6M", l: "6개월" },
                      { k: "1Y", l: "1년" },
                      { k: "ALL", l: "전체" },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.k}
                      className={
                        "seg-btn" + (trendRange === r.k ? " active" : "")
                      }
                      onClick={() => setTrendRange(r.k)}
                    >
                      {r.l}
                    </button>
                  ))}
                </div>

                <select
                  className="select-input"
                  value={trendYear}
                  onChange={(e) => setTrendYear(e.target.value)}
                >
                  <option value="ALL">전체 연도</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                height: 320,
                background: "rgba(15, 23, 42, 0.55)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                marginBottom: 18,
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={filteredTrendSeries}
                  margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#3b82f6"
                        stopOpacity={0.45}
                      />
                      <stop
                        offset="95%"
                        stopColor="#3b82f6"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient id="gradStock" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop
                        offset="95%"
                        stopColor="#8b5cf6"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.12)"
                  />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                  <YAxis
                    tickFormatter={(v) => fmtCompactKrw(v)}
                    stroke="#94a3b8"
                    fontSize={11.5}
                    width={80}
                  />
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      fmtKrw(val),
                      name,
                    ]}
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid rgba(148,163,184,0.3)",
                      borderRadius: 10,
                      color: "#f1f5f9",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="totalAssets"
                    name="총자산(주식+예수금)"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#gradTotal)"
                  />
                  <Area
                    type="monotone"
                    dataKey="holdingsEval"
                    name="주식평가액"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#gradStock)"
                  />
                  <Area
                    type="monotone"
                    dataKey="holdingsCost"
                    name="매수원금"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1.8}
                    fill="none"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid-2">
              <div
                style={{
                  height: 250,
                  background: "rgba(15, 23, 42, 0.55)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <strong
                  style={{ display: "block", fontSize: 13.5, marginBottom: 8 }}
                >
                  🎯 평가손익 추이 (🔴 수익 / 🔵 손실)
                </strong>
                <ResponsiveContainer width="100%" height="88%">
                  <BarChart data={filteredTrendSeries}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148,163,184,0.12)"
                    />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                    <YAxis
                      tickFormatter={(v) => fmtCompactKrw(v)}
                      stroke="#94a3b8"
                      fontSize={11}
                      width={72}
                    />
                    <ReferenceLine y={0} stroke="rgba(148,163,184,0.4)" />
                    <Tooltip
                      formatter={(val: number) => [
                        fmtKrw(val, true),
                        "평가손익",
                      ]}
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid rgba(148,163,184,0.3)",
                        borderRadius: 10,
                      }}
                    />
                    <Bar dataKey="profitAmount">
                      {filteredTrendSeries.map((pt, i) => (
                        <Cell
                          key={i}
                          fill={pt.profitAmount >= 0 ? "#ff6b6b" : "#60a5fa"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  height: 250,
                  background: "rgba(15, 23, 42, 0.55)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <strong
                  style={{ display: "block", fontSize: 13.5, marginBottom: 8 }}
                >
                  📊{" "}
                  {trendGranularity === "monthly"
                    ? "전월 대비 총자산 증감"
                    : "전일 대비 총자산 증감"}{" "}
                  (🔴 증가 / 🔵 감소)
                </strong>
                <ResponsiveContainer width="100%" height="88%">
                  <BarChart data={filteredTrendSeries}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148,163,184,0.12)"
                    />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                    <YAxis
                      tickFormatter={(v) => fmtCompactKrw(v)}
                      stroke="#94a3b8"
                      fontSize={11}
                      width={72}
                    />
                    <ReferenceLine y={0} stroke="rgba(148,163,184,0.4)" />
                    <Tooltip
                      formatter={(val: number) => [
                        fmtKrw(val, true),
                        "자산 증감",
                      ]}
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid rgba(148,163,184,0.3)",
                        borderRadius: 10,
                      }}
                    />
                    <Bar dataKey="deltaAssets">
                      {filteredTrendSeries.map((pt, i) => (
                        <Cell
                          key={i}
                          fill={pt.deltaAssets >= 0 ? "#ff6b6b" : "#60a5fa"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="table-wrap">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>기준일자</th>
                    <th className="num">총자산(원)</th>
                    <th className="num">
                      {trendGranularity === "monthly"
                        ? "전월 대비(원)"
                        : "전일 대비(원)"}
                    </th>
                    <th className="num">주식평가액(원)</th>
                    <th className="num">매수원금(원)</th>
                    <th className="num">예수금(원)</th>
                    <th className="num">평가손익(원)</th>
                    <th className="num">수익률(%)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredTrendSeries].reverse().map((pt) => (
                    <tr key={pt.date}>
                      <td>
                        <strong>{pt.date}</strong>
                      </td>
                      <td className="num">
                        <strong>{fmtKrw(pt.totalAssets)}</strong>
                      </td>
                      <td className={"num " + pnlClass(pt.deltaAssets)}>
                        {pt.deltaAssets !== 0
                          ? `${fmtKrw(pt.deltaAssets, true)} (${fmtPct(
                              pt.deltaRate
                            )})`
                          : "—"}
                      </td>
                      <td className="num">{fmtKrw(pt.holdingsEval)}</td>
                      <td className="num">{fmtKrw(pt.holdingsCost)}</td>
                      <td className="num">{fmtKrw(pt.cash)}</td>
                      <td className={"num " + pnlClass(pt.profitAmount)}>
                        <strong>{fmtKrw(pt.profitAmount, true)}</strong>
                      </td>
                      <td className="num">
                        <span className={pnlBadgeClass(pt.profitRate)}>
                          {pnlArrow(pt.profitRate)} {fmtPct(pt.profitRate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 3: Realized P&L & Overseas Capital Gains Tax */}
      {activeTab === "tax" && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">
                🏛️ 해외주식 양도소득세 계산기 & 연도별 실현손익 분석
              </h2>
              <div className="panel-sub">
                이동평균법 기준 매도 건별 취득원가·실현 주가손익·실현 환차손익을 분해하고, 해외주식 연 250만원 기본공제 후 22% 양도소득세를 자동 산출합니다.
              </div>
            </div>

            <div className="filter-bar">
              <label style={{ fontSize: 12.5, color: "var(--muted)" }}>
                📅 과세연도:
              </label>
              <select
                className="select-input"
                value={effectiveTaxYear}
                onChange={(e) => setTaxYear(e.target.value)}
              >
                {yearlyTaxSummaries.map((s) => (
                  <option key={s.year} value={String(s.year)}>
                    {s.year}년 귀속 (해외 {s.usdSellCount}건 / 국내{" "}
                    {s.krwSellCount}건)
                  </option>
                ))}
                <option value="ALL">전체 연도 누적</option>
              </select>
            </div>
          </div>

          <div className="kpi-grid" style={{ marginBottom: 18 }}>
            <div
              className="kpi-card"
              style={{ "--kpi-accent": "#3b82f6" } as React.CSSProperties}
            >
              <div className="kpi-label">
                <span>🇺🇸 해외주식 순실현손익</span>
                <span className="badge-flat">
                  매도 {activeTaxSummary.usdSellCount}건
                </span>
              </div>
              <div
                className={
                  "kpi-value " + pnlClass(activeTaxSummary.usdNetPnlKrw)
                }
              >
                {fmtKrw(activeTaxSummary.usdNetPnlKrw, true)}
              </div>
              <div className="kpi-sub">
                <span>
                  매도총액 {fmtCompactKrw(activeTaxSummary.usdProceedsKrw)}
                </span>
              </div>
            </div>

            <div
              className="kpi-card"
              style={{ "--kpi-accent": "#8b5cf6" } as React.CSSProperties}
            >
              <div className="kpi-label">
                <span>↳ 주가손익 vs 환차손익</span>
                <span className="badge-flat">원화 환산 분해</span>
              </div>
              <div
                className={
                  "kpi-value " + pnlClass(activeTaxSummary.usdStockPnlKrw)
                }
                style={{ fontSize: 18 }}
              >
                주가 {fmtKrw(activeTaxSummary.usdStockPnlKrw, true)}
              </div>
              <div className="kpi-sub">
                <span>환차손익</span>
                <strong className={pnlClass(activeTaxSummary.usdFxPnlKrw)}>
                  {fmtKrw(activeTaxSummary.usdFxPnlKrw, true)}
                </strong>
                <span>
                  · 제비용 -{fmtCompactKrw(activeTaxSummary.usdFeeKrw)}
                </span>
              </div>
            </div>

            <div
              className="kpi-card"
              style={{ "--kpi-accent": "#10b981" } as React.CSSProperties}
            >
              <div className="kpi-label">
                <span>🛡️ 기본공제 후 과세표준</span>
                <span className="badge-flat">
                  공제 {fmtCompactKrw(activeTaxSummary.deductionKrw)}
                </span>
              </div>
              <div className="kpi-value">
                {fmtKrw(activeTaxSummary.taxableBaseKrw)}
              </div>
              <div className="kpi-sub">
                <span>남은 비과세 한도</span>
                <strong className="text-up">
                  {fmtKrw(activeTaxSummary.remainingDeductionKrw)}
                </strong>
              </div>
            </div>

            <div
              className="kpi-card"
              style={{ "--kpi-accent": "#f59e0b" } as React.CSSProperties}
            >
              <div className="kpi-label">
                <span>🏛️ 예상 양도소득세 (22%)</span>
                <span
                  className={
                    activeTaxSummary.estimatedTaxKrw > 0
                      ? "badge-up"
                      : "badge-flat"
                  }
                >
                  {activeTaxSummary.estimatedTaxKrw > 0
                    ? "신고·납부 대상"
                    : "세액 없음 (0원)"}
                </span>
              </div>
              <div className="kpi-value">
                {fmtKrw(activeTaxSummary.estimatedTaxKrw)}
              </div>
              <div className="kpi-sub">
                <span>양도세 20% + 지방소득세 2%</span>
              </div>
            </div>

            <div
              className="kpi-card"
              style={{ "--kpi-accent": "#ec4899" } as React.CSSProperties}
            >
              <div className="kpi-label">
                <span>🇰🇷 국내주식 순실현손익</span>
                <span className="badge-flat">
                  매도 {activeTaxSummary.krwSellCount}건 (비과세)
                </span>
              </div>
              <div
                className={
                  "kpi-value " + pnlClass(activeTaxSummary.krwNetPnlKrw)
                }
              >
                {fmtKrw(activeTaxSummary.krwNetPnlKrw, true)}
              </div>
              <div className="kpi-sub">
                <span>
                  수수료·거래세 -{fmtKrw(activeTaxSummary.krwFeeKrw)}
                </span>
              </div>
            </div>
          </div>

          {/* Unrealized Tax & Tax-Loss Harvesting Simulation */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.65)",
              border: "1px solid var(--border-strong)",
              borderRadius: 14,
              padding: 18,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div>
                <strong style={{ fontSize: 15 }}>
                  💡 올해 미실현 해외주식 양도세 & 손익통산(Tax-Loss Harvesting) 절세 시뮬레이션
                </strong>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    marginTop: 2,
                  }}
                >
                  현재 보유 중인 해외주식(USD)을 올해 안에 전량 매도한다고 가정할 때의 예상 세액과 손실 상계 가능 종목입니다.
                </div>
              </div>
              <span className="acc-tag">
                올해 남은 비과세 공제 한도:{" "}
                {fmtKrw(unrealizedSim.remainingFreeGainKrw)}
              </span>
            </div>

            <div className="mini-summary-row" style={{ marginBottom: 12 }}>
              <div className="mini-box">
                <div className="label">올해 기실현 해외손익</div>
                <div
                  className={
                    "val " + pnlClass(unrealizedSim.currentYearRealizedUsdKrw)
                  }
                >
                  {fmtKrw(unrealizedSim.currentYearRealizedUsdKrw, true)}
                </div>
              </div>
              <div className="mini-box">
                <div className="label">보유 해외주식 미실현 평가익(+)</div>
                <div className="val text-up">
                  {fmtKrw(unrealizedSim.unrealizedGainKrw, true)}
                </div>
              </div>
              <div className="mini-box">
                <div className="label">보유 해외주식 미실현 평가손(-)</div>
                <div className="val text-down">
                  {fmtKrw(unrealizedSim.unrealizedLossKrw, true)}
                </div>
              </div>
              <div className="mini-box">
                <div className="label">
                  현재 전량 매도 시 예상 양도세 (22%)
                </div>
                <div className="val">
                  {fmtKrw(unrealizedSim.estTaxIfSellAllKrw)}{" "}
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    (과표 {fmtCompactKrw(unrealizedSim.taxableIfSellAllKrw)})
                  </span>
                </div>
              </div>
            </div>

            {unrealizedSim.lossHarvestCandidates.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: "var(--muted)", fontWeight: 700 }}>
                  ✂️ 손익통산(손실 확정 매도) 후보 종목 (클릭 시 360° 상세):
                </span>
                {unrealizedSim.lossHarvestCandidates.map((c) => (
                  <span
                    key={`${c.accountLabel}-${c.symbol}`}
                    className="badge-down"
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedStockSymbol(c.symbol)}
                  >
                    🔍 [{c.accountLabel}] {c.name} ({fmtKrw(c.totalPnlKrw)} · 최대{" "}
                    {fmtKrw(c.potentialTaxSavingKrw)} 절세)
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Yearly Tax Summary Table */}
          <div style={{ marginBottom: 18 }}>
            <h3 className="panel-title" style={{ marginBottom: 10 }}>
              📅 연도별 해외·국내 실현손익 및 양도세 요약표
            </h3>
            <div className="table-wrap">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>귀속연도</th>
                    <th className="num">해외 매도건수</th>
                    <th className="num">해외 실현주가손익</th>
                    <th className="num">해외 실현환차손익</th>
                    <th className="num">해외 제비용</th>
                    <th className="num">해외 순실현손익</th>
                    <th className="num">과세표준(공제후)</th>
                    <th className="num">예상 양도세(22%)</th>
                    <th className="num">국내 순실현손익(비과세)</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyTaxSummaries.map((s) => (
                    <tr key={s.year}>
                      <td>
                        <strong>{s.year}년</strong>
                      </td>
                      <td className="num">{s.usdSellCount}건</td>
                      <td className={"num " + pnlClass(s.usdStockPnlKrw)}>
                        {fmtKrw(s.usdStockPnlKrw, true)}
                      </td>
                      <td className={"num " + pnlClass(s.usdFxPnlKrw)}>
                        {fmtKrw(s.usdFxPnlKrw, true)}
                      </td>
                      <td className="num">-{fmtKrw(s.usdFeeKrw)}</td>
                      <td className={"num " + pnlClass(s.usdNetPnlKrw)}>
                        <strong>{fmtKrw(s.usdNetPnlKrw, true)}</strong>
                      </td>
                      <td className="num">{fmtKrw(s.taxableBaseKrw)}</td>
                      <td className="num">
                        <span
                          className={
                            s.estimatedTaxKrw > 0 ? "badge-up" : "badge-flat"
                          }
                        >
                          {fmtKrw(s.estimatedTaxKrw)}
                        </span>
                      </td>
                      <td className={"num " + pnlClass(s.krwNetPnlKrw)}>
                        {fmtKrw(s.krwNetPnlKrw, true)} ({s.krwSellCount}건)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual Realized Trade Details */}
          <div className="panel-head">
            <h3 className="panel-title">
              📋 매도(실현) 건별 주가손익 · 환차손익 명세 ({filteredRealizedTrades.length}건)
            </h3>
            <div className="filter-bar">
              <div className="seg-group">
                {(
                  [
                    { k: "ALL", l: "전체 시장" },
                    { k: "USD", l: "🇺🇸 해외 (양도세 대상)" },
                    { k: "KRW", l: "🇰🇷 국내 (비과세)" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.k}
                    className={
                      "seg-btn" + (taxMarketFilter === m.k ? " active" : "")
                    }
                    onClick={() => setTaxMarketFilter(m.k)}
                  >
                    {m.l}
                  </button>
                ))}
              </div>
              <input
                className="text-input"
                placeholder="🔍 종목명/코드 검색..."
                value={taxSearch}
                onChange={(e) => setTaxSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="table-wrap">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>체결일</th>
                  <th>계좌</th>
                  <th>시장</th>
                  <th>종목명 (클릭 시 360° 상세)</th>
                  <th className="num">매도수량</th>
                  <th className="num">매도단가</th>
                  <th className="num">취득평단가</th>
                  <th className="num">매도/매수환율</th>
                  <th className="num">매도금액(원)</th>
                  <th className="num">취득원가(원)</th>
                  <th className="num">실현주가손익</th>
                  <th className="num">실현환차손익</th>
                  <th className="num">제비용(원)</th>
                  <th className="num">순실현손익(원)</th>
                  <th className="num">실현수익률</th>
                </tr>
              </thead>
              <tbody>
                {filteredRealizedTrades.length === 0 ? (
                  <tr>
                    <td
                      colSpan={15}
                      style={{
                        textAlign: "center",
                        padding: 36,
                        color: "var(--muted)",
                      }}
                    >
                      선택한 조건의 매도(실현) 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredRealizedTrades.map((t) => (
                    <tr
                      key={`${t.accountLabel}-${t.orderId}`}
                      className="clickable-row"
                      onClick={() => setSelectedStockSymbol(t.symbol)}
                    >
                      <td>{t.date}</td>
                      <td>
                        <span className="acc-tag">{t.accountLabel}</span>
                      </td>
                      <td>
                        <span
                          className={
                            "market-tag " +
                            (t.currency === "USD" ? "usd" : "krw")
                          }
                        >
                          {t.currency === "USD" ? "해외 USD" : "국내 KRW"}
                        </span>
                      </td>
                      <td>
                        🔍 <strong>{t.name}</strong>{" "}
                        <span style={{ color: "var(--muted)", fontSize: 11.5 }}>
                          ({t.symbol})
                        </span>
                      </td>
                      <td className="num">{fmtNum(t.qty, 4)}</td>
                      <td className="num">
                        {fmtPrice(t.sellPriceNative, t.currency)}
                      </td>
                      <td className="num">
                        {fmtPrice(t.avgBuyPriceNative, t.currency)}
                      </td>
                      <td
                        className="num"
                        style={{ color: "var(--muted)", fontSize: 12 }}
                      >
                        {t.currency === "USD"
                          ? `${fmtNum(t.sellFx, 1)} / ${fmtNum(t.avgBuyFx, 1)}`
                          : "—"}
                      </td>
                      <td className="num">{fmtKrw(t.proceedsKrw)}</td>
                      <td className="num">{fmtKrw(t.costKrw)}</td>
                      <td className={"num " + pnlClass(t.stockPnlKrw)}>
                        {fmtKrw(t.stockPnlKrw, true)}
                      </td>
                      <td className={"num " + pnlClass(t.fxPnlKrw)}>
                        {t.currency === "USD"
                          ? fmtKrw(t.fxPnlKrw, true)
                          : "—"}
                      </td>
                      <td className="num">-{fmtKrw(t.feeKrw)}</td>
                      <td className={"num " + pnlClass(t.netPnlKrw)}>
                        <strong>{fmtKrw(t.netPnlKrw, true)}</strong>
                      </td>
                      <td className="num">
                        <span className={pnlBadgeClass(t.pnlRate)}>
                          {pnlArrow(t.pnlRate)} {fmtPct(t.pnlRate)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Orders History */}
      {activeTab === "orders" && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">🧾 매매 체결 이력</h2>
              <div className="panel-sub">
                연도·매수/매도·통화·종목별로 체결 내역을 필터링합니다. 종목을 클릭하면 <strong>360° 상세 모달</strong>이 열립니다.
              </div>
            </div>

            <div className="filter-bar">
              <select
                className="select-input"
                value={orderYear}
                onChange={(e) => setOrderYear(e.target.value)}
              >
                <option value="ALL">전체 연도</option>
                {orderYears.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>

              <div className="seg-group">
                {(
                  [
                    { k: "ALL", l: "전체" },
                    { k: "BUY", l: "🔴 매수만" },
                    { k: "SELL", l: "🔵 매도만" },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.k}
                    className={
                      "seg-btn" + (orderSide === s.k ? " active" : "")
                    }
                    onClick={() => setOrderSide(s.k)}
                  >
                    {s.l}
                  </button>
                ))}
              </div>

              <div className="seg-group">
                {(
                  [
                    { k: "ALL", l: "전체 통화" },
                    { k: "USD", l: "USD" },
                    { k: "KRW", l: "KRW" },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.k}
                    className={
                      "seg-btn" + (orderCurrency === c.k ? " active" : "")
                    }
                    onClick={() => setOrderCurrency(c.k)}
                  >
                    {c.l}
                  </button>
                ))}
              </div>

              <input
                className="text-input"
                placeholder="🔍 종목명/코드 검색..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="mini-summary-row">
            <div className="mini-box">
              <div className="label">조회 체결 건수</div>
              <div className="val">{fmtNum(orderSummary.totalCount)}건</div>
            </div>
            <div className="mini-box">
              <div className="label">🔴 매수 합계 ({orderSummary.buyCnt}건)</div>
              <div className="val text-up">{fmtKrw(orderSummary.buySum)}</div>
            </div>
            <div className="mini-box">
              <div className="label">
                🔵 매도 합계 ({orderSummary.sellCnt}건)
              </div>
              <div className="val text-down">
                {fmtKrw(orderSummary.sellSum)}
              </div>
            </div>
            <div className="mini-box">
              <div className="label">순매수 금액 (매수 - 매도)</div>
              <div className={"val " + pnlClass(orderSummary.netBuy)}>
                {fmtKrw(orderSummary.netBuy, true)}
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>거래일자</th>
                  <th>계좌</th>
                  <th>종목명 (클릭 시 360° 상세)</th>
                  <th>구분</th>
                  <th className="num">체결수량</th>
                  <th className="num">체결단가</th>
                  <th className="num">적용환율</th>
                  <th className="num">체결금액(원)</th>
                  <th>주문유형</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        textAlign: "center",
                        padding: 36,
                        color: "var(--muted)",
                      }}
                    >
                      조건에 맞는 매매 체결 이력이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr
                      key={`${o.accountLabel}-${o.orderId}`}
                      className="clickable-row"
                      onClick={() => setSelectedStockSymbol(o.symbol)}
                    >
                      <td>{o.date}</td>
                      <td>
                        <span className="acc-tag">{o.accountLabel}</span>
                      </td>
                      <td>
                        🔍 <strong>{o.name}</strong>{" "}
                        <span style={{ color: "var(--muted)", fontSize: 11.5 }}>
                          ({o.symbol})
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            o.side === "BUY" ? "badge-up" : "badge-down"
                          }
                        >
                          {o.side === "BUY" ? "🔴 매수" : "🔵 매도"}
                        </span>
                      </td>
                      <td className="num">{fmtNum(o.filledQuantity, 4)}</td>
                      <td className="num">
                        {fmtPrice(o.averageFilledPrice, o.currency)}
                      </td>
                      <td className="num">
                        {o.currency === "USD" && o.fxRate > 1
                          ? `${fmtNum(o.fxRate, 1)}원`
                          : "—"}
                      </td>
                      <td
                        className={
                          "num " + (o.side === "BUY" ? "text-up" : "text-down")
                        }
                      >
                        <strong>{fmtKrw(o.filledAmountKrw)}</strong>
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>
                        {o.orderType || o.status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Dividends */}
      {activeTab === "dividends" && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">
                💵 배당금 내역 (SGOV 월배당 자동감지 포함)
              </h2>
              <div className="panel-sub">
                종목별·연도별 누적 세후배당금을 확인하고, 웹에서 바로 백업 시트에 배당 기록을 추가할 수 있습니다.
              </div>
            </div>
          </div>

          <div className="mini-summary-row">
            <div className="mini-box">
              <div className="label">총 누적 세후배당금</div>
              <div className="val text-up">
                {fmtKrw(totalDividendsKrw, true)}
              </div>
            </div>
            <div className="mini-box">
              <div className="label">{currentYear}년 세후배당금</div>
              <div className="val text-up">{fmtKrw(thisYearDivKrw, true)}</div>
            </div>
            <div className="mini-box">
              <div className="label">총 배당 수령 횟수</div>
              <div className="val">{fmtNum(dividends.length)}회</div>
            </div>
            <div className="mini-box">
              <div className="label">최다 배당 효자 종목</div>
              <div className="val">
                {divByStock[0]
                  ? `${divByStock[0].name} (${fmtCompactKrw(
                      divByStock[0].amount
                    )})`
                  : "—"}
              </div>
            </div>
          </div>

          {dividends.length > 0 && (
            <div className="grid-2">
              <div
                style={{
                  height: 240,
                  background: "rgba(15, 23, 42, 0.55)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <strong
                  style={{ display: "block", fontSize: 13.5, marginBottom: 8 }}
                >
                  📅 연도별 세후배당금 합계
                </strong>
                <ResponsiveContainer width="100%" height="88%">
                  <BarChart data={divByYear}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148,163,184,0.12)"
                    />
                    <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} />
                    <YAxis
                      tickFormatter={(v) => fmtCompactKrw(v)}
                      stroke="#94a3b8"
                      fontSize={11}
                    />
                    <Tooltip
                      formatter={(val: number) => [
                        fmtKrw(val, true),
                        "세후배당금",
                      ]}
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid rgba(148,163,184,0.3)",
                        borderRadius: 10,
                      }}
                    />
                    <Bar
                      dataKey="amount"
                      fill="#ff6b6b"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  height: 240,
                  background: "rgba(15, 23, 42, 0.55)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <strong
                  style={{ display: "block", fontSize: 13.5, marginBottom: 8 }}
                >
                  🏆 종목별 누적 세후배당금
                </strong>
                <ResponsiveContainer width="100%" height="88%">
                  <BarChart data={divByStock.slice(0, 8)} layout="vertical">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148,163,184,0.12)"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => fmtCompactKrw(v)}
                      stroke="#94a3b8"
                      fontSize={11}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={86}
                      stroke="#e2e8f0"
                      fontSize={11.5}
                    />
                    <Tooltip
                      formatter={(val: number) => [
                        fmtKrw(val, true),
                        "누적 배당금",
                      ]}
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid rgba(148,163,184,0.3)",
                        borderRadius: 10,
                      }}
                    />
                    <Bar
                      dataKey="amount"
                      fill="#f59e0b"
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Quick Add Dividend Form */}
          <form className="form-grid" onSubmit={handleAddDividend}>
            <div className="form-field">
              <label>계좌</label>
              <select
                className="select-input"
                value={divAcc}
                onChange={(e) => setDivAcc(e.target.value as "혜신" | "동헌")}
              >
                <option value="혜신">👩 혜신</option>
                <option value="동헌">👨 동헌</option>
              </select>
            </div>
            <div className="form-field">
              <label>지급일</label>
              <input
                type="date"
                className="text-input"
                value={divDate}
                onChange={(e) => setDivDate(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>티커/종목코드</label>
              <input
                className="text-input"
                style={{ width: 96 }}
                value={divSymbol}
                onChange={(e) => setDivSymbol(e.target.value)}
                placeholder="SGOV"
              />
            </div>
            <div className="form-field">
              <label>종목명</label>
              <input
                className="text-input"
                style={{ width: 130 }}
                value={divName}
                onChange={(e) => setDivName(e.target.value)}
                placeholder="SGOV"
              />
            </div>
            <div className="form-field">
              <label>통화</label>
              <select
                className="select-input"
                value={divCurrency}
                onChange={(e) =>
                  setDivCurrency(e.target.value as "USD" | "KRW")
                }
              >
                <option value="USD">USD ($)</option>
                <option value="KRW">KRW (원)</option>
              </select>
            </div>
            <div className="form-field">
              <label>세전배당({divCurrency})</label>
              <input
                type="number"
                step="any"
                className="text-input"
                style={{ width: 105 }}
                value={divGross}
                onChange={(e) => setDivGross(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="form-field">
              <label>세금({divCurrency})</label>
              <input
                type="number"
                step="any"
                className="text-input"
                style={{ width: 95 }}
                value={divTax}
                onChange={(e) => setDivTax(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="form-field">
              <label>세후배당금(원) *</label>
              <input
                type="number"
                className="text-input"
                style={{ width: 130 }}
                value={divNetKrw}
                onChange={(e) => setDivNetKrw(e.target.value)}
                placeholder="예: 15400"
                required
              />
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
              <label>메모</label>
              <input
                className="text-input"
                value={divMemo}
                onChange={(e) => setDivMemo(e.target.value)}
                placeholder="월배당 수동입력"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              ➕ 시트에 배당 추가
            </button>
          </form>

          <div className="table-wrap">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>지급일</th>
                  <th>계좌</th>
                  <th>종목명 (클릭 시 360° 상세)</th>
                  <th>통화</th>
                  <th className="num">세전배당금</th>
                  <th className="num">세금</th>
                  <th className="num">세후배당금(원)</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {dividends.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign: "center",
                        padding: 36,
                        color: "var(--muted)",
                      }}
                    >
                      기록된 배당금 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  dividends.map((d) => (
                    <tr
                      key={`${d.accountLabel}-${d.id}`}
                      className="clickable-row"
                      onClick={() => setSelectedStockSymbol(d.symbol)}
                    >
                      <td>{d.date}</td>
                      <td>
                        <span className="acc-tag">{d.accountLabel}</span>
                      </td>
                      <td>
                        🔍 <strong>{d.name}</strong>{" "}
                        <span style={{ color: "var(--muted)", fontSize: 11.5 }}>
                          ({d.symbol})
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            "market-tag " +
                            (d.currency === "USD" ? "usd" : "krw")
                          }
                        >
                          {d.currency}
                        </span>
                      </td>
                      <td className="num">
                        {fmtPrice(d.grossAmountNative, d.currency)}
                      </td>
                      <td className="num">
                        {fmtPrice(d.taxNative, d.currency)}
                      </td>
                      <td className="num text-up">
                        <strong>{fmtKrw(d.netAmountKrw, true)}</strong>
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>
                        {d.memo}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: CashFlows & Pure Investment Return */}
      {activeTab === "cashflow" && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">
                🏧 입출금 내역 & 순입금 대비 실질 수익
              </h2>
              <div className="panel-sub">
                계좌에 실제로 입금한 순원금 대비 현재 총자산의 실질 투자 성과를 계산합니다.
              </div>
            </div>
          </div>

          <div className="mini-summary-row">
            <div className="mini-box">
              <div className="label">🔴 누적 총 입금액</div>
              <div className="val text-up">{fmtKrw(cfSummary.totalIn)}</div>
            </div>
            <div className="mini-box">
              <div className="label">🔵 누적 총 출금액</div>
              <div className="val text-down">{fmtKrw(cfSummary.totalOut)}</div>
            </div>
            <div className="mini-box">
              <div className="label">누적 순입금액 (입금 - 출금)</div>
              <div className="val">{fmtKrw(cfSummary.netIn)}</div>
            </div>
            <div className="mini-box">
              <div className="label">순입금 대비 실질 수익금 (수익률)</div>
              <div className={"val " + pnlClass(cfSummary.pureProfit)}>
                {fmtKrw(cfSummary.pureProfit, true)} (
                {fmtPct(cfSummary.pureRate)})
              </div>
            </div>
          </div>

          {/* Quick Add CashFlow Form */}
          <form className="form-grid" onSubmit={handleAddCashFlow}>
            <div className="form-field">
              <label>계좌</label>
              <select
                className="select-input"
                value={cfAcc}
                onChange={(e) => setCfAcc(e.target.value as "혜신" | "동헌")}
              >
                <option value="혜신">👩 혜신</option>
                <option value="동헌">👨 동헌</option>
              </select>
            </div>
            <div className="form-field">
              <label>일자</label>
              <input
                type="date"
                className="text-input"
                value={cfDate}
                onChange={(e) => setCfDate(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>입출금 구분</label>
              <select
                className="select-input"
                value={cfType}
                onChange={(e) =>
                  setCfType(e.target.value as "DEPOSIT" | "WITHDRAW")
                }
              >
                <option value="DEPOSIT">🔴 입금 (DEPOSIT)</option>
                <option value="WITHDRAW">🔵 출금 (WITHDRAW)</option>
              </select>
            </div>
            <div className="form-field">
              <label>금액(원) *</label>
              <input
                type="number"
                className="text-input"
                style={{ width: 160 }}
                value={cfAmount}
                onChange={(e) => setCfAmount(e.target.value)}
                placeholder="예: 1000000"
                required
              />
            </div>
            <div className="form-field" style={{ flex: 1, minWidth: 180 }}>
              <label>메모</label>
              <input
                className="text-input"
                value={cfMemo}
                onChange={(e) => setCfMemo(e.target.value)}
                placeholder="예: 월급 투자 이체"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              ➕ 시트에 입출금 추가
            </button>
          </form>

          <div className="table-wrap">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>계좌</th>
                  <th>구분</th>
                  <th className="num">금액(원)</th>
                  <th>메모</th>
                  <th>기록시각</th>
                </tr>
              </thead>
              <tbody>
                {cashFlows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: "center",
                        padding: 36,
                        color: "var(--muted)",
                      }}
                    >
                      기록된 입출금 내역이 없습니다. 상단 입력창에서 입출금 내역을 추가해보세요.
                    </td>
                  </tr>
                ) : (
                  cashFlows.map((c) => (
                    <tr key={`${c.accountLabel}-${c.id}`}>
                      <td>{c.date}</td>
                      <td>
                        <span className="acc-tag">{c.accountLabel}</span>
                      </td>
                      <td>
                        <span
                          className={
                            c.type === "DEPOSIT" ? "badge-up" : "badge-down"
                          }
                        >
                          {c.type === "DEPOSIT" ? "🔴 입금" : "🔵 출금"}
                        </span>
                      </td>
                      <td
                        className={
                          "num " +
                          (c.type === "DEPOSIT" ? "text-up" : "text-down")
                        }
                      >
                        <strong>
                          {c.type === "DEPOSIT" ? "+" : "-"}
                          {fmtKrw(c.amount)}
                        </strong>
                      </td>
                      <td>{c.memo}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>
                        {c.recordedAt}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
