const API_PATH_KEY = "apiPath";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const ACCESS_TOKEN_EXPIRES_AT_KEY = "access_token_expires_at";
const REFRESH_TOKEN_EXPIRES_AT_KEY = "refresh_token_expires_at";

const DEFAULT_ACCESS_EXPIRES_IN = 15 * 60;
const DEFAULT_REFRESH_EXPIRES_IN = 30 * 24 * 60 * 60;
const EXPIRY_BUFFER_MS = 60_000;

export interface AuthTokens {
  token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
}

const getApiBase = async (): Promise<string> => {
  const apiPath = await window.electronStore.get(API_PATH_KEY);
  if (!apiPath || typeof apiPath !== "string") {
    throw new Error("ไม่พบ API path กรุณาตั้งค่าใหม่");
  }

  return apiPath.replace(/\/+$/, "");
};

const getJwtExpiry = (token: string): number | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const decoded = JSON.parse(window.atob(padded));
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
};

export const saveAuthTokens = async (
  tokens: AuthTokens,
  currentRefreshToken?: string,
): Promise<void> => {
  const accessToken = tokens.access_token || tokens.token;
  const refreshToken = tokens.refresh_token || currentRefreshToken;

  if (!accessToken || !refreshToken) {
    throw new Error("ข้อมูล Token จากเซิร์ฟเวอร์ไม่ครบถ้วน");
  }

  const now = Date.now();
  const accessExpiresAt =
    getJwtExpiry(accessToken) ??
    now + (tokens.expires_in ?? DEFAULT_ACCESS_EXPIRES_IN) * 1000;
  const refreshExpiresAt =
    getJwtExpiry(refreshToken) ??
    now + (tokens.refresh_expires_in ?? DEFAULT_REFRESH_EXPIRES_IN) * 1000;

  await Promise.all([
    window.electronStore.set(ACCESS_TOKEN_KEY, accessToken),
    window.electronStore.set(REFRESH_TOKEN_KEY, refreshToken),
    window.electronStore.set(ACCESS_TOKEN_EXPIRES_AT_KEY, accessExpiresAt),
    window.electronStore.set(REFRESH_TOKEN_EXPIRES_AT_KEY, refreshExpiresAt),
    window.electronStore.set("auth_token", accessToken),
  ]);
};

export const clearAuthSession = async (): Promise<void> => {
  await Promise.all([
    window.electronStore.set("user", null),
    window.electronStore.set("auth_token", ""),
    window.electronStore.set(ACCESS_TOKEN_KEY, ""),
    window.electronStore.set(REFRESH_TOKEN_KEY, ""),
    window.electronStore.set(ACCESS_TOKEN_EXPIRES_AT_KEY, null),
    window.electronStore.set(REFRESH_TOKEN_EXPIRES_AT_KEY, null),
  ]);
};

export const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = await window.electronStore.get(REFRESH_TOKEN_KEY);
  if (!refreshToken || typeof refreshToken !== "string") {
    throw new Error("ไม่พบ Refresh Token");
  }

  const base = await getApiBase();
  const response = await fetch(`${base}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data: AuthTokens & { message?: string } = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "ไม่สามารถต่ออายุ Token ได้");
  }

  await saveAuthTokens(data, refreshToken);
  return data.access_token || data.token || "";
};

export const ensureValidAccessToken = async (): Promise<boolean> => {
  const [accessToken, accessExpiresAt, refreshToken, refreshExpiresAt] =
    await Promise.all([
      window.electronStore.get(ACCESS_TOKEN_KEY),
      window.electronStore.get(ACCESS_TOKEN_EXPIRES_AT_KEY),
      window.electronStore.get(REFRESH_TOKEN_KEY),
      window.electronStore.get(REFRESH_TOKEN_EXPIRES_AT_KEY),
    ]);

  const accessExpiry =
    typeof accessExpiresAt === "number"
      ? accessExpiresAt
      : typeof accessToken === "string"
        ? getJwtExpiry(accessToken)
        : null;

  if (
    typeof accessToken === "string" &&
    accessToken.trim() &&
    accessExpiry &&
    accessExpiry > Date.now() + EXPIRY_BUFFER_MS
  ) {
    return true;
  }

  const refreshExpiry =
    typeof refreshExpiresAt === "number"
      ? refreshExpiresAt
      : typeof refreshToken === "string"
        ? getJwtExpiry(refreshToken)
        : null;

  if (
    typeof refreshToken !== "string" ||
    !refreshToken.trim() ||
    (refreshExpiry !== null && refreshExpiry <= Date.now())
  ) {
    await clearAuthSession();
    return false;
  }

  try {
    return Boolean(await refreshAccessToken());
  } catch (error) {
    console.error("Error refreshing access token:", error);
    await clearAuthSession();
    return false;
  }
};

export const logoutAndClearSession = async (): Promise<void> => {
  try {
    const refreshToken = await window.electronStore.get(REFRESH_TOKEN_KEY);
    if (refreshToken && typeof refreshToken === "string") {
      const base = await getApiBase();
      await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(10000),
      });
    }
  } finally {
    await clearAuthSession();
  }
};
