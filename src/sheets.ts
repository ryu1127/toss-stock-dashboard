// Google Sheets v4 reader & writer for TossStock backup spreadsheet
// Default Spreadsheet ID: 14G8JY2nvRpXHlvuT4-EfZeaTEZLsHaqcgzAFIQcO19A
// Reads all 10 tabs in a single values:batchGet API call:
//   [혜신] 일별자산, [혜신] 보유종목, [혜신] 매매이력, [혜신] 입출금, [혜신] 배당
//   [동헌] 일별자산, [동헌] 보유종목, [동헌] 매매이력, [동헌] 입출금, [동헌] 배당

import { getAccessToken } from "./auth";

export const DEFAULT_SPREADSHEET_ID =
  "14G8JY2nvRpXHlvuT4-EfZeaTEZLsHaqcgzAFIQcO19A";
const SPREADSHEET_ID_KEY = "tossStockSpreadsheetId";
const CACHE_KEY = "tossStockSheetCache_v1";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export type AccountKey = "ALL" | "혜신" | "동헌";

export interface AccountMeta {
  accountNumber: string;
  label: "혜신" | "동헌";
  fullAlias: string;
  emoji: string;
}

export const ACCOUNTS: Record<"혜신" | "동헌", AccountMeta> = {
  혜신: {
    accountNumber: "15901012025",
    label: "혜신",
    fullAlias: "혜신 계좌 (혜신)",
    emoji: "👩",
  },
  동헌: {
    accountNumber: "18101015438",
    label: "동헌",
    fullAlias: "동헌 계좌 (동헌)",
    emoji: "👨",
  },
};

export interface AssetSnapshotRow {
  date: string; // YYYY-MM-DD
  accountNumber: string;
  accountLabel: "혜신" | "동헌";
  accountAlias: string;
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
  source: string;
  recordedAt: string;
}

export interface HoldingSnapshotRow {
  date: string;
  accountNumber: string;
  accountLabel: "혜신" | "동헌";
  symbol: string;
  name: string;
  currency: "KRW" | "USD" | string;
  quantity: number;
  avgPrice: number;
  lastPrice: number;
  evalKrw: number;
  purchaseKrw: number;
  profitKrw: number;
  fxPnlKrw: number;
  profitRate: number;
  weightPct: number;
  recordedAt: string;
}

export interface OrderHistoryRow {
  date: string;
  orderedAt: string;
  filledAt: string;
  accountNumber: string;
  accountLabel: "혜신" | "동헌";
  accountAlias: string;
  symbol: string;
  name: string;
  currency: "KRW" | "USD" | string;
  side: "BUY" | "SELL" | string;
  status: string;
  orderType: string;
  filledQuantity: number;
  averageFilledPrice: number;
  filledAmount: number;
  fxRate: number;
  filledAmountKrw: number;
  commission: number;
  tax: number;
  orderQuantity: number;
  orderPrice: number;
  orderId: string;
  recordedAt: string;
}

export interface CashFlowRow {
  date: string;
  accountNumber: string;
  accountLabel: "혜신" | "동헌";
  type: "DEPOSIT" | "WITHDRAW";
  amount: number;
  memo: string;
  recordedAt: string;
  id: string;
}

export interface DividendRow {
  date: string;
  accountNumber: string;
  accountLabel: "혜신" | "동헌";
  symbol: string;
  name: string;
  currency: "KRW" | "USD" | string;
  grossAmountNative: number;
  taxNative: number;
  netAmountKrw: number;
  memo: string;
  recordedAt: string;
  id: string;
}

export interface TossSheetData {
  spreadsheetId: string;
  assetSnapshots: AssetSnapshotRow[];
  holdingsSnapshots: HoldingSnapshotRow[];
  ordersHistory: OrderHistoryRow[];
  cashFlows: CashFlowRow[];
  dividends: DividendRow[];
  fetchedAt: string;
}

export function getSavedSpreadsheetId(): string {
  return localStorage.getItem(SPREADSHEET_ID_KEY) || DEFAULT_SPREADSHEET_ID;
}

export function saveSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const id = m ? m[1] : trimmed || DEFAULT_SPREADSHEET_ID;
  localStorage.setItem(SPREADSHEET_ID_KEY, id);
  return id;
}

export function getSpreadsheetUrl(spreadsheetId?: string): string {
  const id = spreadsheetId || getSavedSpreadsheetId();
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

export function loadCachedSheetData(): TossSheetData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TossSheetData;
  } catch {
    return null;
  }
}

export function saveCachedSheetData(data: TossSheetData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

const ACCOUNT_LABELS: ("혜신" | "동헌")[] = ["혜신", "동헌"];
const CATEGORIES = ["일별자산", "보유종목", "매매이력", "입출금", "배당"] as const;

function resolveAccountLabel(
  rawAccountNo: string,
  rawAlias: string,
  fallbackLabel: "혜신" | "동헌"
): "혜신" | "동헌" {
  const acc = String(rawAccountNo || "").trim();
  if (acc === "15901012025" || acc.includes("1590")) return "혜신";
  if (acc === "18101015438" || acc.includes("1810")) return "동헌";
  const alias = String(rawAlias || "").trim();
  if (alias.includes("혜신")) return "혜신";
  if (alias.includes("동헌")) return "동헌";
  return fallbackLabel;
}

function cleanNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "number") return Number.isFinite(val) ? val : fallback;
  const s = String(val)
    .replace(/[,₩$%\s]/g, "")
    .replace(/원/g, "")
    .trim();
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDate(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = String(Number(m[2])).padStart(2, "0");
    const d = String(Number(m[3])).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  return s.slice(0, 10);
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h ?? "").trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.some((c) => String(c ?? "").trim() !== "")) continue;
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j];
      if (!h) continue;
      obj[h] = r[j] !== undefined && r[j] !== null ? String(r[j]).trim() : "";
    }
    out.push(obj);
  }
  return out;
}

async function sheetErrorMessage(res: Response): Promise<string> {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error?.message ?? "";
  } catch {
    // ignore
  }
  const prefix =
    res.status === 401
      ? "구글 로그인 세션이 만료되었습니다. [구글 계정 연결] 버튼을 다시 눌러주세요."
      : res.status === 403 || res.status === 404
      ? "백업 시트에 접근할 수 없습니다. 공유 권한을 확인하세요."
      : "구글 시트를 불러오지 못했습니다.";
  return detail ? `${prefix} (${res.status}: ${detail})` : `${prefix} (${res.status})`;
}

async function batchGetTabs(
  spreadsheetId: string,
  tabNames: string[],
  token: string
): Promise<Record<string, string[][]>> {
  const params = new URLSearchParams();
  for (const name of tabNames) {
    params.append("ranges", `'${name}'!A1:Z50000`);
  }
  // FORMATTED_VALUE preserves leading zeros in stock symbols ("005930") and string IDs
  params.set("valueRenderOption", "FORMATTED_VALUE");
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values:batchGet?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error(await sheetErrorMessage(res));
  }
  const data = await res.json();
  const out: Record<string, string[][]> = {};
  const valueRanges = data.valueRanges ?? [];
  for (let i = 0; i < tabNames.length; i++) {
    const vr = valueRanges[i];
    out[tabNames[i]] = (vr?.values ?? []) as string[][];
  }
  return out;
}

export async function fetchTossSheetData(
  spreadsheetId = getSavedSpreadsheetId()
): Promise<TossSheetData> {
  const token = getAccessToken();
  if (!token) {
    throw new Error(
      "구글 계정이 아직 연결되지 않았습니다. 상단의 [구글 시트 연결] 버튼을 눌러주세요."
    );
  }

  // First check available sheet tab names so we never fail if a tab doesn't exist yet
  const metaRes = await fetch(
    `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaRes.ok) {
    throw new Error(await sheetErrorMessage(metaRes));
  }
  const metaJson = await metaRes.json();
  const existingTitles = new Set<string>(
    (metaJson.sheets ?? []).map(
      (s: { properties?: { title?: string } }) => s.properties?.title ?? ""
    )
  );

  const desiredTabs: {
    tabTitle: string;
    label: "혜신" | "동헌";
    category: (typeof CATEGORIES)[number];
  }[] = [];

  for (const label of ACCOUNT_LABELS) {
    for (const category of CATEGORIES) {
      const tabTitle = `[${label}] ${category}`;
      if (existingTitles.has(tabTitle)) {
        desiredTabs.push({ tabTitle, label, category });
      }
    }
  }

  const rawTabs =
    desiredTabs.length > 0
      ? await batchGetTabs(
          spreadsheetId,
          desiredTabs.map((d) => d.tabTitle),
          token
        )
      : {};

  const assetSnapshotsMap = new Map<string, AssetSnapshotRow>();
  const holdingsSnapshotsMap = new Map<string, HoldingSnapshotRow>();
  const ordersHistoryMap = new Map<string, OrderHistoryRow>();
  const cashFlowsMap = new Map<string, CashFlowRow>();
  const dividendsMap = new Map<string, DividendRow>();

  for (const { tabTitle, label, category } of desiredTabs) {
    const rows = rowsToObjects(rawTabs[tabTitle] ?? []);
    const defaultAccNo = ACCOUNTS[label].accountNumber;
    const defaultAlias = ACCOUNTS[label].fullAlias;

    if (category === "일별자산") {
      for (const r of rows) {
        const date = normalizeDate(r["날짜"] || r["date"]);
        if (!date) continue;
        const accountNumber =
          r["계좌번호"] || r["account_number"] || defaultAccNo;
        const accountAlias =
          r["계좌명"] || r["account_alias"] || defaultAlias;
        const accountLabel = resolveAccountLabel(
          accountNumber,
          accountAlias,
          label
        );
        const totalAssets = cleanNum(r["총자산(원)"] ?? r["total_assets"]);
        const holdingsEval = cleanNum(r["주식평가액(원)"] ?? r["holdings_eval"]);
        const holdingsCost = cleanNum(r["매수원금(원)"] ?? r["holdings_cost"]);
        const profitAmount = cleanNum(
          r["평가손익(원)"] ?? r["profit_amount"],
          holdingsEval - holdingsCost
        );
        const profitRate = cleanNum(
          r["수익률(%)"] ?? r["profit_rate"],
          holdingsCost > 0 ? (profitAmount / holdingsCost) * 100 : 0
        );
        const cash = cleanNum(
          r["총예수금(원)"] ?? r["cash"],
          Math.max(0, totalAssets - holdingsEval)
        );
        const cashKrw = cleanNum(r["원화예수금(원)"] ?? r["cash_krw"], cash);
        const cashUsd = cleanNum(r["달러예수금($)"] ?? r["cash_usd"], 0);
        const fxPnlKrw = cleanNum(r["환차손익(원)"] ?? r["fx_pnl_krw"], 0);
        const usdKrwRate = cleanNum(
          r["적용환율(원/$)"] ?? r["usd_krw_rate"],
          0
        );
        const source = r["데이터구분"] || r["source"] || "REAL";
        const recordedAt = r["기록시각"] || r["recorded_at"] || "";

        const key = `${date}__${accountLabel}`;
        assetSnapshotsMap.set(key, {
          date,
          accountNumber,
          accountLabel,
          accountAlias,
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
          source,
          recordedAt,
        });
      }
    } else if (category === "보유종목") {
      for (const r of rows) {
        const date = normalizeDate(r["날짜"] || r["date"]);
        const symbol = (r["종목코드"] || r["symbol"] || "").replace(/^'/, "");
        if (!date || !symbol) continue;
        const accountNumber =
          r["계좌번호"] || r["account_number"] || defaultAccNo;
        const accountLabel = resolveAccountLabel(accountNumber, "", label);
        const name = r["종목명"] || r["name"] || symbol;
        const currency = (r["통화"] || r["currency"] || "KRW").toUpperCase();
        const quantity = cleanNum(r["보유수량"] ?? r["quantity"]);
        const avgPrice = cleanNum(r["평단가"] ?? r["avg_price"]);
        const lastPrice = cleanNum(r["현재가"] ?? r["last_price"]);
        const evalKrw = cleanNum(r["평가금액(원)"] ?? r["eval_krw"]);
        const purchaseKrw = cleanNum(r["매수원금(원)"] ?? r["purchase_krw"]);
        const profitKrw = cleanNum(
          r["총평가손익(원)"] ?? r["profit_krw"],
          evalKrw - purchaseKrw
        );
        const fxPnlKrw = cleanNum(r["환차손익(원)"] ?? r["fx_pnl_krw"], 0);
        const profitRate = cleanNum(
          r["수익률(%)"] ?? r["profit_rate"],
          purchaseKrw > 0 ? (profitKrw / purchaseKrw) * 100 : 0
        );
        const weightPct = cleanNum(r["비중(%)"] ?? r["weight_pct"], 0);
        const recordedAt = r["기록시각"] || r["recorded_at"] || "";

        const key = `${date}__${accountLabel}__${symbol}`;
        holdingsSnapshotsMap.set(key, {
          date,
          accountNumber,
          accountLabel,
          symbol,
          name,
          currency,
          quantity,
          avgPrice,
          lastPrice,
          evalKrw,
          purchaseKrw,
          profitKrw,
          fxPnlKrw,
          profitRate,
          weightPct,
          recordedAt,
        });
      }
    } else if (category === "매매이력") {
      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        const date = normalizeDate(r["거래일자"] || r["date"]);
        if (!date) continue;
        const accountNumber =
          r["계좌번호"] || r["account_number"] || defaultAccNo;
        const accountAlias =
          r["계좌명"] || r["account_alias"] || defaultAlias;
        const accountLabel = resolveAccountLabel(
          accountNumber,
          accountAlias,
          label
        );
        const symbol = (r["종목코드"] || r["symbol"] || "").replace(/^'/, "");
        const name = r["종목명"] || r["name"] || symbol;
        const currency = (r["통화"] || r["currency"] || "KRW").toUpperCase();
        const rawSide = (r["매매구분"] || r["side"] || "").toUpperCase();
        const side =
          rawSide.includes("SELL") || rawSide.includes("매도") ? "SELL" : "BUY";
        const status = r["주문상태"] || r["status"] || "체결";
        const orderType = r["주문유형"] || r["order_type"] || "";
        const filledQuantity = cleanNum(r["체결수량"] ?? r["filled_quantity"]);
        const averageFilledPrice = cleanNum(
          r["체결단가"] ?? r["average_filled_price"]
        );
        const filledAmount = cleanNum(r["체결금액(통화)"] ?? r["filled_amount"]);
        const fxRate = cleanNum(r["체결환율(원/$)"] ?? r["fx_rate"], 1);
        const filledAmountKrw = cleanNum(
          r["체결금액(원)"] ?? r["filled_amount_krw"]
        );
        const commission = cleanNum(r["수수료"] ?? r["commission"], 0);
        const tax = cleanNum(r["거래세"] ?? r["tax"], 0);
        const orderQuantity = cleanNum(
          r["주문수량"] ?? r["order_quantity"],
          filledQuantity
        );
        const orderPrice = cleanNum(
          r["주문단가"] ?? r["order_price"],
          averageFilledPrice
        );
        const orderId =
          (r["주문ID"] || r["order_id"] || "").replace(/^'/, "") ||
          `${date}-${symbol}-${side}-${idx}`;
        const orderedAt = r["주문일시"] || r["ordered_at"] || date;
        const filledAt = r["체결일시"] || r["filled_at"] || orderedAt;
        const recordedAt = r["기록시각"] || r["recorded_at"] || "";

        const key = `${accountLabel}__${orderId}`;
        ordersHistoryMap.set(key, {
          date,
          orderedAt,
          filledAt,
          accountNumber,
          accountLabel,
          accountAlias,
          symbol,
          name,
          currency,
          side,
          status,
          orderType,
          filledQuantity,
          averageFilledPrice,
          filledAmount,
          fxRate,
          filledAmountKrw,
          commission,
          tax,
          orderQuantity,
          orderPrice,
          orderId,
          recordedAt,
        });
      }
    } else if (category === "입출금") {
      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        const date = normalizeDate(r["날짜"] || r["date"]);
        if (!date) continue;
        const accountNumber =
          r["계좌번호"] || r["account_number"] || defaultAccNo;
        const accountLabel = resolveAccountLabel(accountNumber, "", label);
        const rawType = (r["입출금구분"] || r["type"] || "").trim();
        const type: "DEPOSIT" | "WITHDRAW" =
          rawType.toUpperCase().includes("WITHDRAW") ||
          rawType.includes("출금") ||
          rawType === "-"
            ? "WITHDRAW"
            : "DEPOSIT";
        const amount = Math.abs(cleanNum(r["금액(원)"] ?? r["amount"]));
        if (amount <= 0) continue;
        const memo = r["메모"] || r["memo"] || "";
        const recordedAt = r["기록시각"] || r["recorded_at"] || "";
        const id =
          (r["기록ID"] || r["id"] || "").replace(/^'/, "") ||
          `cf-${accountLabel}-${date}-${idx}`;

        cashFlowsMap.set(`${accountLabel}__${id}`, {
          date,
          accountNumber,
          accountLabel,
          type,
          amount,
          memo,
          recordedAt,
          id,
        });
      }
    } else if (category === "배당") {
      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        const date = normalizeDate(r["지급일"] || r["date"]);
        if (!date) continue;
        const accountNumber =
          r["계좌번호"] || r["account_number"] || defaultAccNo;
        const accountLabel = resolveAccountLabel(accountNumber, "", label);
        const symbol = (r["종목코드"] || r["symbol"] || "").replace(/^'/, "");
        const name = r["종목명"] || r["name"] || symbol;
        const currency = (r["통화"] || r["currency"] || "USD").toUpperCase();
        const grossAmountNative = cleanNum(
          r["세전배당금(통화)"] ?? r["gross_amount_native"]
        );
        const taxNative = cleanNum(r["세금(통화)"] ?? r["tax_native"]);
        const netAmountKrw = cleanNum(
          r["세후배당금(원)"] ?? r["net_amount_krw"]
        );
        const memo = r["메모"] || r["memo"] || "";
        const recordedAt = r["기록시각"] || r["recorded_at"] || "";
        const id =
          (r["기록ID"] || r["id"] || "").replace(/^'/, "") ||
          `div-${accountLabel}-${date}-${symbol}-${idx}`;

        dividendsMap.set(`${accountLabel}__${id}`, {
          date,
          accountNumber,
          accountLabel,
          symbol,
          name,
          currency,
          grossAmountNative,
          taxNative,
          netAmountKrw,
          memo,
          recordedAt,
          id,
        });
      }
    }
  }

  const assetSnapshots = Array.from(assetSnapshotsMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const holdingsSnapshots = Array.from(holdingsSnapshotsMap.values()).sort(
    (a, b) => a.date.localeCompare(b.date) || b.evalKrw - a.evalKrw
  );
  const ordersHistory = Array.from(ordersHistoryMap.values()).sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.filledAt.localeCompare(a.filledAt)
  );
  const cashFlows = Array.from(cashFlowsMap.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const dividends = Array.from(dividendsMap.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const result: TossSheetData = {
    spreadsheetId,
    assetSnapshots,
    holdingsSnapshots,
    ordersHistory,
    cashFlows,
    dividends,
    fetchedAt: new Date().toISOString(),
  };

  saveCachedSheetData(result);
  return result;
}

// Append a new CashFlow row directly to `[혜신] 입출금` or `[동헌] 입출금`
export async function appendCashFlowToSheet(input: {
  accountLabel: "혜신" | "동헌";
  date: string;
  type: "DEPOSIT" | "WITHDRAW";
  amount: number;
  memo: string;
}): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error("구글 계정에 먼저 로그인하세요.");
  const spreadsheetId = getSavedSpreadsheetId();
  const tabName = `[${input.accountLabel}] 입출금`;
  const accNo = ACCOUNTS[input.accountLabel].accountNumber;
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
  const id = Math.random().toString(36).slice(2, 10);

  // Columns: 날짜 | 계좌번호 | 입출금구분 | 금액(원) | 메모 | 기록시각 | 기록ID
  const row = [
    input.date,
    `'${accNo}`,
    input.type,
    Math.round(Math.abs(input.amount)),
    input.memo.trim(),
    nowStr,
    `'${id}`,
  ];

  const range = encodeURIComponent(`'${tabName}'!A:G`);
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    }
  );
  if (!res.ok) throw new Error(await sheetErrorMessage(res));
}

// Append a new Dividend row directly to `[혜신] 배당` or `[동헌] 배당`
export async function appendDividendToSheet(input: {
  accountLabel: "혜신" | "동헌";
  date: string;
  symbol: string;
  name: string;
  currency: "KRW" | "USD";
  grossAmountNative: number;
  taxNative: number;
  netAmountKrw: number;
  memo: string;
}): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error("구글 계정에 먼저 로그인하세요.");
  const spreadsheetId = getSavedSpreadsheetId();
  const tabName = `[${input.accountLabel}] 배당`;
  const accNo = ACCOUNTS[input.accountLabel].accountNumber;
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
  const id = Math.random().toString(36).slice(2, 10);

  // Columns: 지급일 | 계좌번호 | 종목코드 | 종목명 | 통화 | 세전배당금(통화) | 세금(통화) | 세후배당금(원) | 메모 | 기록시각 | 기록ID
  const row = [
    input.date,
    `'${accNo}`,
    `'${input.symbol.trim().toUpperCase()}`,
    input.name.trim() || input.symbol.trim().toUpperCase(),
    input.currency,
    Number(input.grossAmountNative) || 0,
    Number(input.taxNative) || 0,
    Math.round(Number(input.netAmountKrw) || 0),
    input.memo.trim(),
    nowStr,
    `'${id}`,
  ];

  const range = encodeURIComponent(`'${tabName}'!A:K`);
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    }
  );
  if (!res.ok) throw new Error(await sheetErrorMessage(res));
}
