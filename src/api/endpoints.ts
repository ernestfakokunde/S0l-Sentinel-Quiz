import { apiFetch } from "./client";
import type { HistoryMatch, Lobby, Profile, RpcInfo } from "../types";

export type MatchRecord = {
  matchId: string;
  lobbyId?: string | null;
  lobbyIdHash?: string | null;
  winner: string;
  prizeLamports: string;
  treasuryFeeLamports?: string;
  totalPotLamports?: string;
  players: number;
  scores?: unknown;
  resultPayload?: unknown;
  resultHash?: string | null;
  resultSignature?: string | null;
  signerPublicKey?: string | null;
  claimStatus?: string;
  claimTxSignature?: string | null;
  finishedAt: string;
  createdAt?: string;
};

export async function fetchHealth() {
  return apiFetch<{ ok: boolean; service: string }>("/health");
}

export async function fetchRpcInfo() {
  const payload = await apiFetch<{ solana: RpcInfo }>("/solana/rpc");
  return payload.solana;
}

export async function fetchLobbies() {
  const payload = await apiFetch<{ lobbies: Lobby[] }>("/lobbies");
  return payload.lobbies;
}

export async function fetchLobby(lobbyId: string) {
  const payload = await apiFetch<{ lobby: Lobby }>(`/lobbies/${lobbyId}`);
  return payload.lobby;
}

export async function fetchProfile(wallet: string) {
  const payload = await apiFetch<{ profile: Profile }>(`/profiles/${wallet}`);
  return payload.profile;
}

export async function saveProfile(wallet: string, profile: Profile) {
  const payload = await apiFetch<{ profile: Profile }>(`/profiles/${wallet}`, {
    method: "PUT",
    body: JSON.stringify(profile),
  });
  return payload.profile;
}

export async function fetchHistory(wallet?: string) {
  const query = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
  const payload = await apiFetch<{ matches: MatchRecord[] }>(`/history${query}`);
  return payload.matches.map(
    (match): HistoryMatch => ({
      matchId: match.matchId,
      lobbyId: match.lobbyId || undefined,
      winner: match.winner,
      result: wallet ? (match.winner === wallet ? "win" : "loss") : undefined,
      prizeLamports: String(match.prizeLamports),
      totalPotLamports: match.totalPotLamports ? String(match.totalPotLamports) : undefined,
      treasuryFeeLamports: match.treasuryFeeLamports ? String(match.treasuryFeeLamports) : undefined,
      players: match.players,
      claimStatus: match.claimStatus,
      finishedAt: match.finishedAt,
    }),
  );
}

export async function fetchMatch(matchId: string) {
  const payload = await apiFetch<{ match: MatchRecord }>(`/matches/${matchId}`);
  return payload.match;
}

export async function recordMatchClaim(matchId: string, claimTxSignature: string) {
  return apiFetch<{ match: MatchRecord; verification: unknown }>(`/matches/${matchId}/claim`, {
    method: "POST",
    body: JSON.stringify({ claimTxSignature }),
  });
}
