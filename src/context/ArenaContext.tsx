import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSendTransaction } from "@solana/react-hooks";
import type { Address } from "@solana/kit";
import {
  fetchHealth,
  fetchHistory,
  fetchLobby,
  fetchMatch,
  fetchLobbies,
  fetchProfile,
  fetchRpcInfo,
  recordMatchClaim,
  saveProfile as saveProfileRequest,
} from "../api/endpoints";
import { WS_URL } from "../api/config";
import { FIXED_ENTRY_FEE_LAMPORTS, pickArenaTopic } from "../gameConfig";
import type {
  ApiRequestState,
  ArenaContextValue,
  ArenaProviderProps,
  AppRoute,
  GameMode,
  HistoryMatch,
  Lobby,
  MatchEnded,
  Profile,
  QuestionEvent,
  RpcInfo,
  Score,
  ServerMessage,
} from "../types";
import { buildClaimPrizeInstructions } from "../claimTransaction";
import {
  defaultProfile,
  normalizeRoute,
  questionTimeMsForMode,
  readWalletSession,
  writeWalletSession,
} from "./session";

const ArenaContext = createContext<ArenaContextValue | null>(null);

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function toMatchEnded(data: ServerMessage): MatchEnded | null {
  if (!data.matchId || !data.lobbyId || !data.winner || !data.signedResult) return null;
  return {
    type: "match_ended",
    matchId: data.matchId,
    lobbyId: data.lobbyId,
    lobbyIdHash: data.lobbyIdHash,
    winner: data.winner,
    payoutLamports: data.payoutLamports || "0",
    treasuryFeeLamports: data.treasuryFeeLamports || "0",
    totalPotLamports: data.totalPotLamports || "0",
    scores: data.scores || [],
    signedResult: data.signedResult,
  };
}

export function ArenaProvider({ children, walletAddress }: ArenaProviderProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const navigateRef = useRef<(route: AppRoute) => void>(() => {});
  const { send, isSending: claimSubmitting } = useSendTransaction();

  const [route, setRoute] = useState<AppRoute>(() => normalizeRoute(window.location.pathname));
  const [socketState, setSocketState] = useState<ArenaContextValue["socketState"]>("offline");
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [rpcInfo, setRpcInfo] = useState<RpcInfo | null>(null);
  const [api, setApi] = useState<ApiRequestState>({ loading: false, error: null, lastPath: null });
  const [notice, setNotice] = useState("Connect your wallet to enter the arena.");
  const [profile, setProfile] = useState<Profile>(() => defaultProfile());
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [history, setHistory] = useState<HistoryMatch[]>([]);
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<QuestionEvent | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [lastAnswer, setLastAnswer] = useState<{ correct: boolean; points: number } | null>(null);
  const [matchWinner, setMatchWinner] = useState("");
  const [matchEnded, setMatchEnded] = useState<MatchEnded | null>(null);
  const [claimTxSignature, setClaimTxSignature] = useState("");
  const [selectedMode, setSelectedMode] = useState<GameMode>("Speed");
  const [now, setNow] = useState(Date.now());

  const runApi = useCallback(async <T,>(path: string, task: () => Promise<T>): Promise<T | null> => {
    setApi({ loading: true, error: null, lastPath: path });
    try {
      const result = await task();
      setApi({ loading: false, error: null, lastPath: path });
      return result;
    } catch (err) {
      const message = (err as Error).message;
      setApi({ loading: false, error: message, lastPath: path });
      setNotice(message);
      return null;
    }
  }, []);

  const navigate = useCallback((nextRoute: AppRoute) => {
    setRoute(nextRoute);
    window.history.pushState({}, "", nextRoute);
    if (nextRoute !== "/") writeWalletSession(walletAddress, { route: nextRoute });
  }, [walletAddress]);

  navigateRef.current = navigate;

  const syncLobby = useCallback((lobby: Lobby) => {
    setActiveLobby(lobby);
    setLobbies((current) => [lobby, ...current.filter((item) => item.lobbyId !== lobby.lobbyId)]);
    writeWalletSession(walletAddress, { activeLobbyId: lobby.lobbyId, route: "/game" });
  }, [walletAddress]);

  const refreshLobbies = useCallback(async () => {
    const next = await runApi("/lobbies", fetchLobbies);
    if (next) setLobbies(next);
  }, [runApi]);

  const refreshHistory = useCallback(async () => {
    const next = await runApi("/history", fetchHistory);
    if (next) setHistory(next);
  }, [runApi]);

  const loadMatchForClaim = useCallback(async (matchId: string) => {
    const match = await runApi(`/matches/${matchId}`, () => fetchMatch(matchId));
    if (!match?.resultPayload || typeof match.resultPayload !== "object") return;

    const payload = match.resultPayload as Record<string, unknown>;
    setMatchEnded({
      type: "match_ended",
      matchId: match.matchId,
      lobbyId: String(match.lobbyId || payload.lobbyId || ""),
      lobbyIdHash: match.lobbyIdHash ? String(match.lobbyIdHash) : String(payload.lobbyIdHash || "") || undefined,
      winner: match.winner,
      payoutLamports: String(payload.payoutLamports || match.prizeLamports || "0"),
      treasuryFeeLamports: String(payload.treasuryFeeLamports || match.treasuryFeeLamports || "0"),
      totalPotLamports: String(payload.totalPotLamports || match.totalPotLamports || "0"),
      scores: Array.isArray(payload.scores) ? (payload.scores as Score[]) : [],
      signedResult: {
        algorithm: "Ed25519",
        canonical: stableStringify(match.resultPayload),
        messageBase64: "",
        signatureBase64: match.resultSignature || "",
        publicKeyBase64: match.signerPublicKey || "",
        resultHash: match.resultHash || "",
      },
    });
    if (match.claimTxSignature) setClaimTxSignature(match.claimTxSignature);
  }, [runApi]);

  const sendSocket = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setNotice("Realtime server is not connected yet.");
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const arenaMatchPayload = useCallback(() => ({
    entryFeeLamports: FIXED_ENTRY_FEE_LAMPORTS,
    maxPlayers: 2,
    questionCount: 5,
    questionTimeMs: questionTimeMsForMode(selectedMode),
    topic: pickArenaTopic(),
    mode: selectedMode,
    privacy: "public" as const,
  }), [selectedMode]);

  const createLobby = useCallback(() => {
    if (!walletAddress) return setNotice("Connect a wallet before creating a lobby.");
    sendSocket({
      type: "create_lobby",
      host: walletAddress,
      player: walletAddress,
      ...arenaMatchPayload(),
    });
  }, [arenaMatchPayload, sendSocket, walletAddress]);

  const quickMatch = useCallback(() => {
    if (!walletAddress) return setNotice("Connect a wallet before matchmaking.");
    sendSocket({
      type: "find_match",
      player: walletAddress,
      ...arenaMatchPayload(),
    });
  }, [arenaMatchPayload, sendSocket, walletAddress]);

  const joinLobby = useCallback((lobbyId: string) => {
    if (!walletAddress) return setNotice("Connect a wallet before joining a lobby.");
    sendSocket({ type: "join_lobby", lobbyId, player: walletAddress });
  }, [sendSocket, walletAddress]);

  const addDemoRival = useCallback(() => {
    if (!activeLobby) return;
    sendSocket({ type: "add_bot", lobbyId: activeLobby.lobbyId, name: "QuizBot" });
  }, [activeLobby, sendSocket]);

  const submitAnswer = useCallback((answerIdx: number) => {
    if (!walletAddress || !activeLobby || !activeQuestion) return;
    sendSocket({
      type: "submit_answer",
      lobbyId: activeLobby.lobbyId,
      player: walletAddress,
      questionIndex: activeQuestion.index,
      answerIdx,
    });
  }, [activeLobby, activeQuestion, sendSocket, walletAddress]);

  const saveProfile = useCallback(async (nextProfile: Profile) => {
    if (!walletAddress) return setNotice("Connect a wallet before saving a profile.");
    const saved = await runApi(`/profiles/${walletAddress}`, () => saveProfileRequest(walletAddress, nextProfile));
    if (saved) {
      setProfile(saved);
      setNotice("Profile saved and synced.");
    }
  }, [runApi, walletAddress]);

  const recordClaim = useCallback(async () => {
    if (!matchEnded) return setNotice("No signed match result to claim.");
    if (!claimTxSignature.trim()) return setNotice("Paste the on-chain claim transaction signature.");
    const result = await runApi(`/matches/${matchEnded.matchId}/claim`, () =>
      recordMatchClaim(matchEnded.matchId, claimTxSignature.trim()),
    );
    if (result) {
      setNotice("Claim recorded. Prize payout verified on-chain.");
      writeWalletSession(walletAddress, { pendingClaimMatchId: undefined });
      void refreshHistory();
    }
  }, [claimTxSignature, matchEnded, refreshHistory, runApi, walletAddress]);

  const claimPrizeOnchain = useCallback(async () => {
    if (!walletAddress) return setNotice("Connect your wallet before claiming.");
    if (!matchEnded) return setNotice("No signed match result to claim.");
    if (matchEnded.winner !== walletAddress) return setNotice("Only the winner wallet can claim this prize.");

    const treasury = rpcInfo?.treasuryAddress || import.meta.env.VITE_TREASURY_ADDRESS;
    if (!treasury) {
      return setNotice("Treasury address is not configured. Set TREASURY_ADDRESS on the backend or VITE_TREASURY_ADDRESS in the frontend env.");
    }

    const signature = await runApi("claim_prize", async () => {
      const instructions = await buildClaimPrizeInstructions({
        matchEnded,
        winner: walletAddress as Address,
        treasury: treasury as Address,
      });
      const txSignature = await send({ instructions });
      if (!txSignature) throw new Error("Wallet did not return a claim transaction signature.");
      return txSignature;
    });

    if (!signature) return;

    setClaimTxSignature(signature);
    const result = await runApi(`/matches/${matchEnded.matchId}/claim`, () =>
      recordMatchClaim(matchEnded.matchId, signature),
    );
    if (result) {
      setNotice("Claim submitted on-chain and recorded.");
      writeWalletSession(walletAddress, { pendingClaimMatchId: undefined });
      void refreshHistory();
    }
  }, [matchEnded, refreshHistory, rpcInfo?.treasuryAddress, runApi, send, walletAddress]);

  const handleServerMessage = useCallback((data: ServerMessage) => {
    if (data.type === "welcome") {
      setSocketState("online");
      return;
    }
    if (data.type === "error") {
      setNotice(data.message || "Realtime error.");
      return;
    }
    if (["lobby_created", "joined", "matchmaking_joined", "lobby_update", "bot_added", "start_ack"].includes(data.type)) {
      if (data.lobby) syncLobby(data.lobby);
      if (["lobby_created", "joined", "matchmaking_joined"].includes(data.type)) navigateRef.current("/game");
      setNotice(data.type === "bot_added" ? "Demo rival joined. Match is starting." : "Lobby synced.");
      return;
    }
    if (data.type === "match_started") {
      if (data.lobby) syncLobby(data.lobby);
      setScores((data.players || []).map((player) => ({ player, score: 0 })));
      setActiveQuestion(null);
      setMatchWinner("");
      setMatchEnded(null);
      navigateRef.current("/game");
      setNotice(`Match started with ${data.questionCount || 0} questions.`);
      return;
    }
    if (data.type === "question") {
      setActiveQuestion({
        matchId: data.matchId || "",
        index: Number(data.index || 0),
        text: data.text || "",
        choices: data.choices || [],
        timeLimitMs: Number(data.timeLimitMs || 15000),
        startedAt: Number(data.startedAt || Date.now()),
      });
      setLastAnswer(null);
      navigateRef.current("/game");
      return;
    }
    if (data.type === "answer_ack") {
      setLastAnswer({ correct: Boolean(data.correct), points: Number(data.points || 0) });
      if (data.scores) setScores(data.scores);
      return;
    }
    if (data.type === "score_update") {
      setScores(data.scores || []);
      return;
    }
    if (data.type === "match_ended") {
      const ended = toMatchEnded(data);
      setMatchWinner(data.winner || "");
      setActiveQuestion(null);
      if (data.scores) setScores(data.scores);
      if (ended) {
        setMatchEnded(ended);
        writeWalletSession(walletAddress, { pendingClaimMatchId: ended.matchId });
        if (walletAddress && ended.winner === walletAddress) {
          navigateRef.current("/settlement");
          setNotice("You won! Review your signed result and claim your prize.");
        } else {
          setNotice("Match complete. Results are synced.");
        }
      } else {
        setNotice("Match complete. Results are synced.");
      }
      void refreshLobbies();
      void refreshHistory();
    }
  }, [refreshHistory, refreshLobbies, syncLobby, walletAddress]);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;
    setSocketState("connecting");
    socket.addEventListener("open", () => setSocketState("online"));
    socket.addEventListener("close", () => setSocketState("offline"));
    socket.addEventListener("error", () => {
      setSocketState("offline");
      setNotice("Realtime socket error. Make sure the backend is running on port 4000.");
    });
    socket.addEventListener("message", (event) => handleServerMessage(JSON.parse(event.data) as ServerMessage));
    return () => socket.close();
  }, [handleServerMessage]);

  useEffect(() => {
    const onPopState = () => setRoute(normalizeRoute(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    void refreshLobbies();
    void fetchHealth()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
    void fetchRpcInfo()
      .then(setRpcInfo)
      .catch(() => setRpcInfo(null));
    return () => window.clearInterval(timer);
  }, [refreshLobbies]);

  useEffect(() => {
    if (route !== "/lobby") return;
    void refreshLobbies();
    const poll = window.setInterval(() => void refreshLobbies(), 5000);
    return () => window.clearInterval(poll);
  }, [refreshLobbies, route]);

  useEffect(() => {
    if (route === "/history") void refreshHistory();
  }, [refreshHistory, route]);

  useEffect(() => {
    writeWalletSession(walletAddress, { selectedMode });
  }, [selectedMode, walletAddress]);

  useEffect(() => {
    if (!walletAddress) {
      setProfile(defaultProfile());
      setMatchEnded(null);
      setClaimTxSignature("");
      return;
    }

    const session = readWalletSession(walletAddress);
    if (session.selectedMode) setSelectedMode(session.selectedMode);

    void fetchProfile(walletAddress)
      .then(setProfile)
      .catch(() => setProfile(defaultProfile(walletAddress)));

    const resumeRoute = session.route && session.route !== "/" ? session.route : "/dashboard";
    setRoute(resumeRoute);
    window.history.replaceState({}, "", resumeRoute);

    if (session.pendingClaimMatchId) {
      void loadMatchForClaim(session.pendingClaimMatchId);
    }

    if (session.activeLobbyId) {
      void fetchLobby(session.activeLobbyId)
        .then((lobby) => {
          const isPlayer = lobby.players.some((player) => player.player === walletAddress);
          if (isPlayer && lobby.status !== "finished") {
            setActiveLobby(lobby);
            if (resumeRoute === "/game") setNotice("Resumed your last lobby from this wallet.");
          }
        })
        .catch(() => writeWalletSession(walletAddress, { activeLobbyId: undefined }));
    }
  }, [loadMatchForClaim, walletAddress]);

  const remainingMs = activeQuestion ? Math.max(0, activeQuestion.startedAt + activeQuestion.timeLimitMs - now) : 0;
  const timerPct = activeQuestion ? Math.max(0, Math.min(100, (remainingMs / activeQuestion.timeLimitMs) * 100)) : 0;
  const playerScore = scores.find((score) => score.player === walletAddress)?.score || 0;

  const value = useMemo<ArenaContextValue>(
    () => ({
      api,
      backendOnline,
      rpcInfo,
      socketState,
      route,
      notice,
      setNotice,
      navigate,
      profile,
      lobbies,
      history,
      activeLobby,
      activeQuestion,
      scores,
      lastAnswer,
      matchWinner,
      matchEnded,
      claimTxSignature,
      claimSubmitting,
      setClaimTxSignature,
      selectedMode,
      setSelectedMode,
      remainingMs,
      timerPct,
      playerScore,
      refreshLobbies,
      refreshHistory,
      saveProfile,
      createLobby,
      quickMatch,
      joinLobby,
      addDemoRival,
      submitAnswer,
      recordClaim,
      claimPrizeOnchain,
      loadMatchForClaim,
    }),
    [
      activeLobby,
      activeQuestion,
      addDemoRival,
      api,
      backendOnline,
      claimTxSignature,
      claimSubmitting,
      claimPrizeOnchain,
      createLobby,
      history,
      joinLobby,
      lastAnswer,
      loadMatchForClaim,
      lobbies,
      matchEnded,
      matchWinner,
      navigate,
      notice,
      playerScore,
      profile,
      quickMatch,
      recordClaim,
      refreshHistory,
      refreshLobbies,
      remainingMs,
      route,
      rpcInfo,
      saveProfile,
      scores,
      selectedMode,
      socketState,
      submitAnswer,
      timerPct,
    ],
  );

  return <ArenaContext.Provider value={value}>{children}</ArenaContext.Provider>;
}

export function useArena() {
  const context = useContext(ArenaContext);
  if (!context) throw new Error("useArena must be used within ArenaProvider");
  return context;
}

export function ArenaGate({ children }: { children: ReactNode }) {
  return children;
}
