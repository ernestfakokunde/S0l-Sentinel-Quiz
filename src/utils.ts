import type { RoutePath } from "./types";

export function lamportsToSol(lamports?: string | number | null) {
  if (lamports === undefined || lamports === null) return "0";
  const value = Number(lamports);
  if (!Number.isFinite(value)) return "0";
  return (value / 1_000_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function solToLamports(sol: string) {
  const parsed = Number.parseFloat(sol);
  if (!Number.isFinite(parsed) || parsed <= 0) return "0";
  return Math.round(parsed * 1_000_000_000).toString();
}

export function shortAddress(value?: string | null) {
  if (!value) return "Not connected";
  if (value.length <= 12) return value;
  return `${value.slice(0, 5)}...${value.slice(-4)}`;
}

export function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function safeJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function normalizePath(pathname: string): RoutePath {
  if (["/find-match", "/matchmake", "/lobby", "/game", "/settlement", "/history"].includes(pathname)) {
    return pathname as RoutePath;
  }
  return "/";
}
