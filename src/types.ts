export type Privacy = "public" | "private";
export type LobbyStatus = "waiting" | "playing" | "finished" | "cancelled";
export type ConnectionState = "offline" | "connecting" | "online";
export type RoutePath = "/" | "/find-match" | "/matchmake" | "/lobby" | "/game" | "/settlement" | "/history";

export type LobbyPlayer = {
  player: string;
  joinedAt?: string;
  txSignature?: string | null;
  txVerified?: boolean;
  score?: number;
};

export type Lobby = {
  lobbyId: string;
  host?: string;
  entryFeeLamports: string;
  maxPlayers: number;
  questionCount: number;
  questionTimeMs: number;
  topic: string;
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
  ephemeralSigner: boolean;
};

export type MatchEnded = {
  type: "match_ended";
  matchId: string;
  lobbyId: string;
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
};
