import { create } from "zustand";
import { hasEverConnected, isSignedIn, signIn, signOut } from "./auth";
import {
  type AccountKey,
  appendCashFlowToSheet,
  appendDividendToSheet,
  fetchTossSheetData,
  getSavedSpreadsheetId,
  loadCachedSheetData,
  saveSpreadsheetId,
  type TossSheetData,
} from "./sheets";

interface DashboardState {
  account: AccountKey;
  setAccount: (acc: AccountKey) => void;
  spreadsheetId: string;
  data: TossSheetData | null;
  loading: boolean;
  error: string | null;
  signedIn: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  connectAndSync: () => Promise<void>;
  disconnect: () => void;
  changeSpreadsheetId: (input: string) => Promise<void>;
  addCashFlow: (input: {
    accountLabel: "혜신" | "동헌";
    date: string;
    type: "DEPOSIT" | "WITHDRAW";
    amount: number;
    memo: string;
  }) => Promise<void>;
  addDividend: (input: {
    accountLabel: "혜신" | "동헌";
    date: string;
    symbol: string;
    name: string;
    currency: "KRW" | "USD";
    grossAmountNative: number;
    taxNative: number;
    netAmountKrw: number;
    memo: string;
  }) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  account:
    (localStorage.getItem("tossSelectedAccount") as AccountKey) || "ALL",
  setAccount: (account) => {
    localStorage.setItem("tossSelectedAccount", account);
    set({ account });
  },
  spreadsheetId: getSavedSpreadsheetId(),
  data: loadCachedSheetData(),
  loading: false,
  error: null,
  signedIn: isSignedIn(),
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    set({ initialized: true });

    const cached = loadCachedSheetData();
    if (cached) {
      set({ data: cached });
    }

    if (isSignedIn()) {
      await get().refresh();
    } else if (hasEverConnected()) {
      // Attempt silent OAuth reconnect if user previously connected on ryu1127.github.io
      try {
        await signIn();
        set({ signedIn: isSignedIn() });
        await get().refresh();
      } catch {
        // Silent sign-in blocked by browser popup policy; user can click button
      }
    }
  },

  refresh: async () => {
    const { spreadsheetId } = get();
    set({ loading: true, error: null, signedIn: isSignedIn() });
    try {
      const fresh = await fetchTossSheetData(spreadsheetId);
      set({ data: fresh, signedIn: isSignedIn(), loading: false });
    } catch (err) {
      set({
        error:
          err instanceof Error
            ? err.message
            : "구글 시트 동기화 중 오류가 발생했습니다.",
        loading: false,
        signedIn: isSignedIn(),
      });
    }
  },

  connectAndSync: async () => {
    set({ loading: true, error: null });
    try {
      await signIn();
      set({ signedIn: isSignedIn() });
      const fresh = await fetchTossSheetData(get().spreadsheetId);
      set({ data: fresh, loading: false });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "구글 계정 연결에 실패했습니다.",
        loading: false,
        signedIn: isSignedIn(),
      });
    }
  },

  disconnect: () => {
    signOut();
    set({ signedIn: false });
  },

  changeSpreadsheetId: async (input: string) => {
    const id = saveSpreadsheetId(input);
    set({ spreadsheetId: id });
    if (isSignedIn()) {
      await get().refresh();
    }
  },

  addCashFlow: async (input) => {
    set({ loading: true, error: null });
    try {
      if (!isSignedIn()) {
        await signIn();
        set({ signedIn: isSignedIn() });
      }
      await appendCashFlowToSheet(input);
      const fresh = await fetchTossSheetData(get().spreadsheetId);
      set({ data: fresh, loading: false });
    } catch (err) {
      set({
        error:
          err instanceof Error
            ? err.message
            : "입출금 기록 추가에 실패했습니다.",
        loading: false,
      });
      throw err;
    }
  },

  addDividend: async (input) => {
    set({ loading: true, error: null });
    try {
      if (!isSignedIn()) {
        await signIn();
        set({ signedIn: isSignedIn() });
      }
      await appendDividendToSheet(input);
      const fresh = await fetchTossSheetData(get().spreadsheetId);
      set({ data: fresh, loading: false });
    } catch (err) {
      set({
        error:
          err instanceof Error
            ? err.message
            : "배당금 기록 추가에 실패했습니다.",
        loading: false,
      });
      throw err;
    }
  },
}));

// Initialize once on module load
useDashboardStore.getState().init();

// Auto-refresh when returning to tab
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    const state = useDashboardStore.getState();
    if (document.visibilityState === "visible" && state.signedIn) {
      state.refresh();
    }
  });
}
