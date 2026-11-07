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
  filterCashFlows,
  filterDividends,
  filterOrders,
  getAvailableHoldingDates,
  getHoldingsAtDate,
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

type MainTab = "portfolio" | "trend" | "orders" | "dividends" | "cashflow";

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

  // Sync default form account with top switcher
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

  const orders = useMemo(() => filterOrders(data, account), [data, account]);
  const dividends = useMemo(
    () => filterDividends(data, account),
    [data, account]
  );
  const cashFlows = useMemo(
    () => filterCashFlows(data, account),
    [data, account]
  );

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

  const buyOrderCount = useMemo(
    () => orders.filter((o) => o.side === "BUY").length,
    [orders]
  );

  // Portfolio Holdings for selected date
  const effectiveHoldingDate = selectedHoldingDate || holdingDates[0] || "";
  const holdingsAtDate = useMemo(
    () =>
      getHoldingsAtDate(data, account, effectiveHoldingDate, mergeHoldings),
    [data, account, effectiveHoldingDate, mergeHoldings]
  );

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
    const map = new Map<string, { name: string; amount: number; count: number }>();
    for (const d of dividends) {
      const key = d.symbol || d.name;
      const cur = map.get(key) ?? { name: d.name || d.symbol, amount: 0, count: 0 };
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
    const pureProfit = netIn > 0 ? currentAssets - netIn : latestSnap?.profitAmount ?? 0;
    const pureRate = netIn > 0 ? (pureProfit / netIn) * 100 : latestSnap?.profitRate ?? 0;
    return { totalIn, totalOut, netIn, currentAssets, pureProfit, pureRate };
  }, [cashFlows, latestSnap]);

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
              구글 시트 실시간 연동 · 👩 혜신 & 👨 동헌 통합 포트폴리오
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
            <strong> [혜신] · [동헌] 10개 시트 탭</strong>을 즉시 불러옵니다.
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

      {/* Top 5 KPI Cards */}
      <section className="kpi-grid">
        <div
          className="kpi-card"
          style={{ "--kpi-accent": "#3b82f6" } as React.CSSProperties}
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
            <span>직전 기록 대비</span>
            <strong className={pnlClass(latestSnap?.deltaAssets)}>
              {fmtKrw(latestSnap?.deltaAssets ?? 0, true)}
            </strong>
          </div>
        </div>

        <div
          className="kpi-card"
          style={{ "--kpi-accent": "#8b5cf6" } as React.CSSProperties}
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
        </div>

        <div
          className="kpi-card"
          style={
            {
              "--kpi-accent":
                (latestSnap?.profitAmount ?? 0) >= 0 ? "#ff6b6b" : "#60a5fa",
            } as React.CSSProperties
          }
        >
          <div className="kpi-label">
            <span>🎯 총 평가손익 (수익률)</span>
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
            <span>환차손익 포함</span>
            <span className={pnlClass(latestSnap?.fxPnlKrw)}>
              ({fmtKrw(latestSnap?.fxPnlKrw ?? 0, true)})
            </span>
          </div>
        </div>

        <div
          className="kpi-card"
          style={{ "--kpi-accent": "#10b981" } as React.CSSProperties}
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
        </div>

        <div
          className="kpi-card"
          style={{ "--kpi-accent": "#f59e0b" } as React.CSSProperties}
        >
          <div className="kpi-label">
            <span>💵 누적 세후배당금</span>
            <span className="badge-up">배당 {dividends.length}건</span>
          </div>
          <div className="kpi-value text-up">
            {fmtKrw(totalDividendsKrw, true)}
          </div>
          <div className="kpi-sub">
            <span>매수 체결 {buyOrderCount}건</span>
            {netDepositsKrw !== 0 && (
              <>
                <span>·</span>
                <span>순입금 {fmtCompactKrw(netDepositsKrw)}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Main 5 Navigation Tabs */}
      <nav className="nav-tabs">
        {(
          [
            { id: "portfolio", label: "📊 포트폴리오 & 보유종목" },
            { id: "trend", label: "📅 일별·월별 자산 추이" },
            { id: "orders", label: "🧾 매매 체결 이력" },
            { id: "dividends", label: "💵 배당금 내역 (SGOV 등)" },
            { id: "cashflow", label: "🏧 입출금 내역 & 실질 수익" },
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

      {/* TAB 1: Portfolio & Holdings */}
      {activeTab === "portfolio" && (
        <>
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">
                  📊 보유종목 타임머신 & 비중 분석
                </h2>
                <div className="panel-sub">
                  날짜를 선택하면 해당 일자의 종목별 스냅샷을 조회합니다. (상승 🔴 빨강 / 하락 🔵 파랑)
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
                      className={
                        "seg-btn" + (mergeHoldings ? " active" : "")
                      }
                      onClick={() => setMergeHoldings(true)}
                    >
                      🔗 동일종목 합산
                    </button>
                    <button
                      className={
                        "seg-btn" + (!mergeHoldings ? " active" : "")
                      }
                      onClick={() => setMergeHoldings(false)}
                    >
                      👥 계좌별 분리
                    </button>
                  </div>
                )}
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
                    📊 종목별 평가손익 (🔴 수익 / 🔵 손실)
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
                          profitRate: h.profitRate,
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
                          "평가손익",
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
                  {fmtKrw(
                    filteredHoldings.reduce((s, h) => s + h.evalKrw, 0)
                  )}
                </strong>
              </div>
            </div>

            <div className="table-wrap">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>시장</th>
                    <th>계좌</th>
                    <th>종목명 (코드)</th>
                    <th className="num">보유수량</th>
                    <th className="num">평단가</th>
                    <th className="num">현재가</th>
                    <th className="num">평가금액(원)</th>
                    <th className="num">매수원금(원)</th>
                    <th className="num">총평가손익(원)</th>
                    <th className="num">환차손익(원)</th>
                    <th className="num">수익률(%)</th>
                    <th className="num">비중(%)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHoldings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={12}
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
                      <tr key={h.key}>
                        <td>
                          <span
                            className={
                              "market-tag " +
                              (h.currency.toUpperCase() === "USD"
                                ? "usd"
                                : "krw")
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
                          <strong>{h.name}</strong>{" "}
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
                        <td className="num">
                          <strong>{fmtKrw(h.evalKrw)}</strong>
                        </td>
                        <td className="num">{fmtKrw(h.purchaseKrw)}</td>
                        <td className={"num " + pnlClass(h.profitKrw)}>
                          <strong>{fmtKrw(h.profitKrw, true)}</strong>
                        </td>
                        <td className={"num " + pnlClass(h.fxPnlKrw)}>
                          {h.fxPnlKrw ? fmtKrw(h.fxPnlKrw, true) : "—"}
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
        </>
      )}

      {/* TAB 2: Daily / Monthly Asset Trend */}
      {activeTab === "trend" && (
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
                    "seg-btn" + (trendGranularity === "daily" ? " active" : "")
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

          {/* Main Area Chart: Total Assets vs Cost */}
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
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradStock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
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

          {/* Two Color Bar Charts: Profit Trend & Delta Trend */}
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

          {/* Trend Table */}
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
      )}

      {/* TAB 3: Orders History */}
      {activeTab === "orders" && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">🧾 매매 체결 이력</h2>
              <div className="panel-sub">
                연도·매수/매도·통화·종목별로 체결 내역을 필터링합니다. (🔴 매수 / 🔵 매도)
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
                  <th>종목명 (코드)</th>
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
                    <tr key={`${o.accountLabel}-${o.orderId}`}>
                      <td>{o.date}</td>
                      <td>
                        <span className="acc-tag">{o.accountLabel}</span>
                      </td>
                      <td>
                        <strong>{o.name}</strong>{" "}
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

      {/* TAB 4: Dividends */}
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
                  <th>종목명 (코드)</th>
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
                    <tr key={`${d.accountLabel}-${d.id}`}>
                      <td>{d.date}</td>
                      <td>
                        <span className="acc-tag">{d.accountLabel}</span>
                      </td>
                      <td>
                        <strong>{d.name}</strong>{" "}
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

      {/* TAB 5: CashFlows & Pure Investment Return */}
      {activeTab === "cashflow" && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">🏧 입출금 내역 & 순입금 대비 실질 수익</h2>
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
