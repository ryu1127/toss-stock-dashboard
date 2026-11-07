// Korean Stock Color & Currency Formatting Helpers
// 🔴 상승 / 수익 / 매수 / 입금 / 배당 = Red (#ff6b6b)
// 🔵 하락 / 손실 / 매도 / 출금 = Blue (#60a5fa)

export function fmtKrw(n: number | null | undefined, showPlus = false): string {
  const v = Math.round(Number(n) || 0);
  if (showPlus && v > 0) return `+${v.toLocaleString("ko-KR")}원`;
  return `${v.toLocaleString("ko-KR")}원`;
}

export function fmtNum(n: number | null | undefined, decimals = 0): string {
  const v = Number(n) || 0;
  return v.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtCompactKrw(n: number | null | undefined, showPlus = false): string {
  const v = Math.round(Number(n) || 0);
  const abs = Math.abs(v);
  const sign = v > 0 ? (showPlus ? "+" : "") : v < 0 ? "-" : "";
  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const man = Math.round((abs % 100_000_000) / 10_000);
    return man > 0
      ? `${sign}${eok}억 ${man.toLocaleString("ko-KR")}만원`
      : `${sign}${eok}억원`;
  }
  if (abs >= 100_000) {
    const man = Math.round(abs / 10_000);
    return `${sign}${man.toLocaleString("ko-KR")}만원`;
  }
  return fmtKrw(v, showPlus);
}

export function fmtPct(n: number | null | undefined, showPlus = true, digits = 2): string {
  const v = Number(n) || 0;
  const prefix = showPlus && v > 0 ? "+" : "";
  return `${prefix}${v.toFixed(digits)}%`;
}

export function fmtPrice(price: number | null | undefined, currency: string): string {
  const v = Number(price) || 0;
  if (String(currency).toUpperCase() === "USD") {
    return `$${v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  return `${Math.round(v).toLocaleString("ko-KR")}원`;
}

export function pnlClass(v: number | null | undefined): string {
  const n = Number(v) || 0;
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-flat";
}

export function pnlBadgeClass(v: number | null | undefined): string {
  const n = Number(v) || 0;
  if (n > 0) return "badge-up";
  if (n < 0) return "badge-down";
  return "badge-flat";
}

export function pnlArrow(v: number | null | undefined): string {
  const n = Number(v) || 0;
  if (n > 0) return "▲";
  if (n < 0) return "▼";
  return "—";
}
