import type { PropsWithChildren } from "react";

export type Privacy = "public" | "private";
export type LobbyStatus = "waiting" | "playing" | "finished" | "cancelled";
export type ConnectionState = "offline" | "connecting" | "online";
export type GameMode = "Speed" | "Classic" | "Survival";

export type AppRoute =
  | "/"
  | "/dashboard"
  | "/matchmake"
  | "/lobby"
  | "/game"
  | "/settlement"
  | "/leaderboard"
  | "/history"
  | "/profile"
  | "/admin"
  | "/docs";

/** @deprecated Use AppRoute in new code */
export type RoutePath = "/" | "/find-match" | "/matchmake" | "/lobby" | "/game" | "/settlement" | "/history";

export type Profile = {
  wallet: string;
  username: string;
  avatar: string;
  bio: string;
  favoriteTopic: string;
};

export type WalletSession = {
  route?: AppRoute;
  selectedMode?: GameMode;
  activeLobbyId?: string;
  pendingClaimMatchId?: string;
  updatedAt?: string;
};

export type LobbyPlayer = {
  player: string;
  joinedAt?: string;
  txSignature?: string | null;
  txVerified?: boolean;
  score?: number;
  bot?: boolean;
};

export type Lobby = {
  lobbyId: string;
  lobbyIdHash?: string;
  host?: string;
  entryFeeLamports: string;
  maxPlayers: number;
  questionCount: number;
  questionTimeMs: number;
  topic: string;
  mode?: GameMode;
  privacy: Privacy;
  status: LobbyStatus;
  players: LobbyPlayer[];
  createdAt: string;
  matchId?: string | null;
  onchainLobbyPda?: string | null;
  escrowPda?: string | null;
};

export type QuestionEvent = {
  matchId: string;
  index: number;
  text: string;
  choices: string[];
  timeLimitMs: number;
  startedAt: number;
};

export type Score = {
  player: string;
  score: number;
};

export type SignedResult = {
  algorithm: string;
  canonical: string;
  messageBase64: string;
  signatureBase64: string;
  publicKeyBase64: string;
  resultHash: string;
  ephemeralSigner?: boolean;
};

export type MatchEnded = {
  type: "match_ended";
  matchId: string;
  lobbyId: string;
  lobbyIdHash?: string;
  winner: string;
  payoutLamports: string;
  treasuryFeeLamports: string;
  totalPotLamports: string;
  scores: Score[];
  signedResult: SignedResult;
};

export type HistoryMatch = {
  matchId: string;
  lobbyId?: string;
  winner: string;
  result?: "win" | "loss";
  prizeLamports: string;
  totalPotLamports?: string;
  treasuryFeeLamports?: string;
  players: number;
  claimStatus?: string;
  finishedAt: string;
};

export type RpcInfo = {
  cluster: string;
  rpcUrl: string;
  commitment: string;
  joinTxVerificationRequired: boolean;
  vaultProgramAddress?: string;
  treasuryAddress?: string | null;
};

export type ServerMessage = {
  type: string;
  lobby?: Lobby;
  matchId?: string;
  players?: string[];
  questionCount?: number;
  index?: number;
  text?: string;
  choices?: string[];
  timeLimitMs?: number;
  startedAt?: number;
  scores?: Score[];
  correct?: boolean;
  points?: number;
  message?: string;
  winner?: string;
  payoutLamports?: string;
  treasuryFeeLamports?: string;
  totalPotLamports?: string;
  signedResult?: SignedResult;
  lobbyId?: string;
  lobbyIdHash?: string;
};

export type ApiRequestState = {
  loading: boolean;
  error: string | null;
  lastPath: string | null;
};

export type NavItem = {
  label: string;
  route: AppRoute;
  icon: string;
};

export type ArenaContextValue = {
  api: ApiRequestState;
  backendOnline: boolean | null;
  rpcInfo: RpcInfo | null;
  socketState: ConnectionState;
  route: AppRoute;
  notice: string;
  setNotice: (message: string) => void;
  navigate: (route: AppRoute) => void;
  profile: Profile;
  lobbies: Lobby[];
  history: HistoryMatch[];
  activeLobby: Lobby | null;
  activeQuestion: QuestionEvent | null;
  scores: Score[];
  lastAnswer: { correct: boolean; points: number } | null;
  matchWinner: string;
  matchEnded: MatchEnded | null;
  claimTxSignature: string;
  claimSubmitting: boolean;
  setClaimTxSignature: (value: string) => void;
  selectedMode: GameMode;
  setSelectedMode: (mode: GameMode) => void;
  remainingMs: number;
  timerPct: number;
  playerScore: number;
  refreshLobbies: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  createLobby: () => Promise<void>;
  quickMatch: () => Promise<void>;
  joinLobby: (lobbyId: string) => Promise<void>;
  addDemoRival: () => void;
  cancelLobby: (lobbyId?: string) => Promise<void>;
  submitAnswer: (answerIdx: number) => void;
  recordClaim: () => Promise<void>;
  claimPrizeOnchain: () => Promise<void>;
  loadMatchForClaim: (matchId: string) => Promise<void>;
};

export type ArenaProviderProps = PropsWithChildren<{
  walletAddress?: string;
}>;
