// Google OAuth using Google Identity Services (browser-only OAuth, no client secret, no server).
// Shares exact same CLIENT_ID, SCOPE, and localStorage keys ("driveToken", "driveEverConnected")
// with ryu1127.github.io/asset-dashboard-private/ so signing in on either app works for both!

export const CLIENT_ID =
  "1030627223748-dtferlqfodgm5mo25im7jhs95kasu0p4.apps.googleusercontent.com";

export const SCOPE =
  "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets";

const TOKEN_KEY = "driveToken";
const EVER_CONNECTED_KEY = "driveEverConnected";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: {
              access_token?: string;
              expires_in?: number;
              error?: string;
            }) => void;
          }): { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

function loadStoredToken(): string | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as {
      accessToken: string;
      expiresAt: number;
      scope?: string;
    };
    if (t.scope && t.scope !== SCOPE) return null;
    if (t.expiresAt > Date.now()) return t.accessToken;
  } catch {
    // ignore corrupted storage
  }
  return null;
}

function storeToken(token: string, expiresInSec: number) {
  localStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({
      accessToken: token,
      expiresAt: Date.now() + expiresInSec * 1000 - 60_000,
      scope: SCOPE,
    })
  );
  localStorage.setItem(EVER_CONNECTED_KEY, "1");
}

let accessToken: string | null = loadStoredToken();

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("구글 로그인 스크립트를 불러오지 못했습니다."))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("구글 로그인 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

export function isSignedIn(): boolean {
  if (!accessToken) {
    accessToken = loadStoredToken();
  }
  return accessToken !== null;
}

export function hasEverConnected(): boolean {
  return localStorage.getItem(EVER_CONNECTED_KEY) === "1";
}

export function getAccessToken(): string | null {
  if (!accessToken) {
    accessToken = loadStoredToken();
  }
  return accessToken;
}

function requestToken(prompt: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? "구글 로그인에 실패했습니다."));
          return;
        }
        accessToken = resp.access_token;
        storeToken(resp.access_token, resp.expires_in ?? 3600);
        resolve();
      },
    });
    client.requestAccessToken({ prompt });
  });
}

export async function signIn(): Promise<void> {
  await loadGis();
  if (localStorage.getItem(EVER_CONNECTED_KEY) === "1") {
    try {
      await requestToken("");
      return;
    } catch {
      // silent token refresh failed -> fall back to consent prompt
    }
  }
  await requestToken("consent");
}

export function signOut() {
  accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
}
