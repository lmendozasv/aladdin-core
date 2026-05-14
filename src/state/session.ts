const ACCESS_KEY = "str.access_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function setAccessToken(token: string) {
  localStorage.setItem(ACCESS_KEY, token);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
}

type JwtClaims = {
  exp?: number;
  roles?: string[];
  business_id?: string;
  typ?: string;
};

export function getClaimsFromAccessToken(): JwtClaims | null {
  const token = getAccessToken();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

export function isAccessTokenValid(nowSec: number = Math.floor(Date.now() / 1000)): boolean {
  const claims = getClaimsFromAccessToken();
  if (!claims?.exp) return false;
  return nowSec < claims.exp;
}

