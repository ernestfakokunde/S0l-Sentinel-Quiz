import type { AppRoute, GameMode, Profile, WalletSession } from "../types";

const walletSessionKey = (walletAddress: string) => `sol-quiz-arena:${walletAddress}:session`;

export function readWalletSession(walletAddress?: string): WalletSession {
  if (!walletAddress) return {};
  try {
    return JSON.parse(window.localStorage.getItem(walletSessionKey(walletAddress)) || "{}") as WalletSession;
  } catch {
    return {};
  }
}

export function writeWalletSession(walletAddress: string | undefined, patch: WalletSession) {
  if (!walletAddress) return;
  const current = readWalletSession(walletAddress);
  window.localStorage.setItem(
    walletSessionKey(walletAddress),
    JSON.stringify({ ...current, ...patch, updatedAt: new Date().toISOString() }),
  );
}

export function normalizeRoute(pathname: string): AppRoute {
  if (pathname === "/") return "/";
  if (pathname === "/find-match") return "/lobby";
  if (
    [
      "/dashboard",
      "/matchmake",
      "/lobby",
      "/game",
      "/settlement",
      "/leaderboard",
      "/history",
      "/profile",
      "/admin",
      "/docs",
    ].includes(pathname)
  ) {
    return pathname as AppRoute;
  }
  return "/dashboard";
}

export function defaultProfile(wallet?: string): Profile {
  const short = wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : "QuizChamp";
  return {
    wallet: wallet || "",
    username: short,
    avatar: "👨‍🚀",
    bio: "Sol Quiz Arena competitor",
    favoriteTopic: "Solana Ecosystem",
  };
}

export function questionTimeMsForMode(mode: GameMode) {
  return mode === "Speed" ? 12000 : 18000;
}
