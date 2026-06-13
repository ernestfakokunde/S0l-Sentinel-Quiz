import { useEffect, useMemo, useRef, useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";

type Privacy = "public" | "private";
type LobbyStatus = "waiting" | "playing" | "finished" | "cancelled";
type ConnectionState = "offline" | "connecting" | "online";
type RoutePath = "/" | "/matchmake" | "/lobby" | "/game" | "/settlement" | "/history";

type LobbyPlayer = {
  player: string;
  joinedAt?: string;
  txSignature?: string | null;
  txVerified?: boolean;
  score?: number;
};

type Lobby = {
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

type QuestionEvent = {
  matchId: string;
  index: number;
  text: string;
  choices: string[];
  timeLimitMs: number;
  startedAt: number;
};

type Score = {
  player: string;
  score: number;
};

type SignedResult = {
  algorithm: string;
  canonical: string;
  messageBase64: string;
  signatureBase64: string;
  publicKeyBase64: string;
  resultHash: string;
  ephemeralSigner: boolean;
};

type MatchEnded = {
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

type HistoryMatch = {
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

type RpcInfo = {
  cluster: string;
  rpcUrl: string;
  commitment: string;
  joinTxVerificationRequired: boolean;
};

type ServerMessage = {
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

const API_URL = import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:4000";
const WS_URL = import.meta.env.VITE_BACKEND_WS_URL || "ws://localhost:4000";
const SOLANA_CLUSTER = import.meta.env.VITE_SOLANA_CLUSTER || "devnet";

function lamportsToSol(lamports?: string | number | null) {
  if (lamports === undefined || lamports === null) return "0";
  const value = Number(lamports);
  if (!Number.isFinite(value)) return "0";
  return (value / 1_000_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function solToLamports(sol: string) {
  const parsed = Number.parseFloat(sol);
  if (!Number.isFinite(parsed) || parsed <= 0) return "0";
  return Math.round(parsed * 1_000_000_000).toString();
}

function shortAddress(value?: string | null) {
  if (!value) return "Not connected";
  if (value.length <= 12) return value;
  return `${value.slice(0, 5)}...${value.slice(-4)}`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function safeJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizePath(pathname: string): RoutePath {
  if (["/matchmake", "/lobby", "/game", "/settlement", "/history"].includes(pathname)) {
    return pathname as RoutePath;
  }
  return "/";
}

export default function App() {
  const { connectors, connect, disconnect, wallet, status } = useWalletConnection();
  const socketRef = useRef<WebSocket | null>(null);

  const [socketState, setSocketState] = useState<ConnectionState>("offline");
  const [notice, setNotice] = useState("Ready to connect the arena.");
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [history, setHistory] = useState<HistoryMatch[]>([]);
  const [rpcInfo, setRpcInfo] = useState<RpcInfo | null>(null);

  const [entryFeeSol, setEntryFeeSol] = useState("0.1");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [questionCount, setQuestionCount] = useState(5);
  const [questionTimeMs, setQuestionTimeMs] = useState(15000);
  const [topic, setTopic] = useState("Solana Basics");
  const [privacy, setPrivacy] = useState<Privacy>("public");
  const [txSignature, setTxSignature] = useState("");
  const [claimTxSignature, setClaimTxSignature] = useState("");

  const [route, setRoute] = useState<RoutePath>(() => normalizePath(window.location.pathname));
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<QuestionEvent | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [lastAnswer, setLastAnswer] = useState<{ correct: boolean; points: number } | null>(null);
  const [matchEnded, setMatchEnded] = useState<MatchEnded | null>(null);
  const [now, setNow] = useState(Date.now());

  const address = wallet?.account.address.toString();
  const isWalletConnected = status === "connected" && Boolean(address);
  const entryFeeLamports = useMemo(() => solToLamports(entryFeeSol), [entryFeeSol]);

  const remainingMs = useMemo(() => {
    if (!activeQuestion) return 0;
    return Math.max(0, activeQuestion.startedAt + activeQuestion.timeLimitMs - now);
  }, [activeQuestion, now]);

  const timerPct = activeQuestion
    ? Math.max(0, Math.min(100, (remainingMs / activeQuestion.timeLimitMs) * 100))
    : 0;

  async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) throw new Error(payload.error || `Request failed: ${path}`);
    return payload;
  }

  async function refreshDashboard() {
    const [lobbyPayload, historyPayload, solanaPayload] = await Promise.allSettled([
      apiFetch<{ lobbies: Lobby[] }>("/lobbies"),
      apiFetch<{ matches: HistoryMatch[] }>("/history"),
      apiFetch<{ solana: RpcInfo }>("/solana/rpc"),
    ]);

    if (lobbyPayload.status === "fulfilled") setLobbies(lobbyPayload.value.lobbies);
    if (historyPayload.status === "fulfilled") setHistory(historyPayload.value.matches);
    if (solanaPayload.status === "fulfilled") setRpcInfo(solanaPayload.value.solana);
  }

  function navigate(nextRoute: RoutePath) {
    if (window.location.pathname !== nextRoute) {
      window.history.pushState({}, "", nextRoute);
    }
    setRoute(nextRoute);
  }

  function sendSocket(payload: Record<string, unknown>) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setNotice("Realtime socket is not connected yet.");
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }

  function handleServerMessage(data: ServerMessage) {
    if (data.type === "welcome") {
      setNotice("Realtime arena connected.");
      return;
    }

    if (data.type === "error") {
      setNotice(data.message || "Server returned an error.");
      return;
    }

    if (["lobby_created", "joined", "matchmaking_joined", "lobby_update", "start_ack"].includes(data.type)) {
      if (data.lobby) {
        setActiveLobby(data.lobby);
        setLobbies((prev) => {
          const next = prev.filter((lobby) => lobby.lobbyId !== data.lobby?.lobbyId);
          return [data.lobby, ...next].filter(Boolean) as Lobby[];
        });
      }
      setNotice(data.type === "matchmaking_joined" ? "Joined matchmaking lobby." : "Lobby updated.");
      return;
    }

    if (data.type === "match_started") {
      if (data.lobby) setActiveLobby(data.lobby);
      setScores((data.players || []).map((player) => ({ player, score: 0 })));
      setMatchEnded(null);
      setLastAnswer(null);
      navigate("/game");
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
      navigate("/game");
      setNotice("New question live.");
      return;
    }

    if (data.type === "answer_ack") {
      setLastAnswer({ correct: Boolean(data.correct), points: Number(data.points || 0) });
      return;
    }

    if (data.type === "score_update") {
      setScores(data.scores || []);
      return;
    }

    if (data.type === "match_ended" && data.signedResult) {
      const ended: MatchEnded = {
        type: "match_ended",
        matchId: data.matchId || "",
        lobbyId: data.lobbyId || activeLobby?.lobbyId || "",
        winner: data.winner || "",
        payoutLamports: data.payoutLamports || "0",
        treasuryFeeLamports: data.treasuryFeeLamports || "0",
        totalPotLamports: data.totalPotLamports || "0",
        scores: data.scores || [],
        signedResult: data.signedResult,
      };
      setMatchEnded(ended);
      setActiveQuestion(null);
      setScores(ended.scores);
      navigate("/settlement");
      setNotice("Match ended. Winner can claim with the signed result.");
      void refreshDashboard();
    }
  }

  useEffect(() => {
    setSocketState("connecting");
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.addEventListener("open", () => setSocketState("online"));
    socket.addEventListener("close", () => setSocketState("offline"));
    socket.addEventListener("error", () => {
      setSocketState("offline");
      setNotice("Realtime socket error. Check that the backend is running.");
    });
    socket.addEventListener("message", (event) => {
      const payload = safeJson<ServerMessage>(event.data);
      if (payload) handleServerMessage(payload);
    });

    return () => socket.close();
  }, []);

  useEffect(() => {
    const handlePopState = () => setRoute(normalizePath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    void refreshDashboard().catch((err: Error) => setNotice(err.message));
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  async function createLobby() {
    if (!address) return setNotice("Connect a wallet first.");

    try {
      const payload = await apiFetch<{ lobby: Lobby }>("/lobbies", {
        method: "POST",
        body: JSON.stringify({
          host: address,
          entryFeeLamports,
          maxPlayers,
          questionCount,
          questionTimeMs,
          topic,
          privacy,
        }),
      });

      setActiveLobby(payload.lobby);
      navigate("/lobby");
      setLobbies((prev) => [payload.lobby, ...prev.filter((lobby) => lobby.lobbyId !== payload.lobby.lobbyId)]);
      sendSocket({ type: "join_lobby", lobbyId: payload.lobby.lobbyId, player: address, txSignature: txSignature || undefined });
      setNotice("Lobby created. Waiting for players.");
    } catch (err) {
      setNotice((err as Error).message);
    }
  }

  function findMatch() {
    if (!address) return setNotice("Connect a wallet first.");
    navigate("/game");
    sendSocket({
      type: "find_match",
      player: address,
      entryFeeLamports,
      maxPlayers,
      questionCount,
      questionTimeMs,
      topic,
      privacy: "public",
      txSignature: txSignature || undefined,
    });
  }

  function joinLobby(lobbyId: string) {
    if (!address) return setNotice("Connect a wallet first.");
    navigate("/game");
    sendSocket({ type: "join_lobby", lobbyId, player: address, txSignature: txSignature || undefined });
  }

  function submitAnswer(answerIdx: number) {
    if (!address || !activeLobby || !activeQuestion) return;
    sendSocket({
      type: "submit_answer",
      lobbyId: activeLobby.lobbyId,
      player: address,
      questionIndex: activeQuestion.index,
      answerIdx,
    });
  }

  async function recordClaim() {
    if (!matchEnded) return;
    if (!claimTxSignature.trim()) return setNotice("Paste the claim transaction signature first.");

    try {
      await apiFetch(`/matches/${matchEnded.matchId}/claim`, {
        method: "POST",
        body: JSON.stringify({ claimTxSignature: claimTxSignature.trim() }),
      });
      setNotice("Claim transaction verified and recorded.");
      setClaimTxSignature("");
      await refreshDashboard();
    } catch (err) {
      setNotice((err as Error).message);
    }
  }

  const playerRank = scores.findIndex((score) => score.player === address) + 1;

  const walletControls = (
    <div className="wallet-panel">
      <div>
        <span className={`status-dot ${isWalletConnected ? "good" : "idle"}`} />
        <span>{isWalletConnected ? shortAddress(address) : "Wallet required"}</span>
      </div>
      <select
        disabled={status === "connecting" || isWalletConnected}
        onChange={(event) => event.target.value && connect(event.target.value)}
        value=""
      >
        <option value="">{status === "connecting" ? "Connecting..." : "Connect wallet"}</option>
        {connectors.map((connector) => (
          <option key={connector.id} value={connector.id}>{connector.name}</option>
        ))}
      </select>
      <button type="button" onClick={() => disconnect()} disabled={!isWalletConnected}>Disconnect</button>
    </div>
  );

  const appNav = (
    <nav className="app-nav" aria-label="Sentinel Quiz pages">
      <button type="button" className={route === "/" ? "active" : ""} onClick={() => navigate("/")}>Home</button>
      <button type="button" className={route === "/matchmake" ? "active" : ""} onClick={() => navigate("/matchmake")}>Matchmake</button>
      <button type="button" className={route === "/lobby" ? "active" : ""} onClick={() => navigate("/lobby")}>Lobby</button>
      <button type="button" className={route === "/game" ? "active" : ""} onClick={() => navigate("/game")}>Game</button>
      <button type="button" className={route === "/settlement" ? "active" : ""} onClick={() => navigate("/settlement")}>Claim</button>
      <button type="button" className={route === "/history" ? "active" : ""} onClick={() => navigate("/history")}>History</button>
    </nav>
  );

  if (route === "/") {
    return (
      <main className="home-page">
        <section className="home-stage" aria-label="Sentinel Quiz home">
          <div className="home-copy">
            <p className="brand-mark">Sentinel Quiz</p>
            <h1>Sentinel Quiz</h1>
            <p className="home-subtitle">Wallet-first quiz battles with live matchmaking, SOL entry pools, and claim tracking.</p>
            <div className="home-actions">
              {walletControls}
              <button type="button" className="primary home-find" onClick={findMatch} disabled={!isWalletConnected || socketState !== "online"}>Find Match</button>
            </div>
          </div>

          <div className="desktop-preview" aria-hidden="true">
            <div className="preview-nav"><span>Wallet</span><span>Match</span><span>Claim</span></div>
            <div className="preview-hero">
              <p>Entry Pool</p>
              <strong>0.10 SOL</strong>
              <button type="button" tabIndex={-1}>Join</button>
            </div>
            <div className="preview-cards">
              <article><span>01</span><strong>Connect Wallet</strong></article>
              <article className="active"><span>02</span><strong>Find Match</strong></article>
              <article><span>03</span><strong>Claim Pot</strong></article>
            </div>
          </div>

          <div className="mobile-preview" aria-hidden="true">
            <div className="phone-bar"><span /> <strong>Match</strong><button type="button" tabIndex={-1}>Live</button></div>
            <div className="phone-topic">
              <p>Sentinel Quiz</p>
              <strong>Pot 0.20 SOL</strong>
              <span />
            </div>
            <div className="phone-question">Wallet connected. Waiting for opponent...</div>
            <div className="phone-options">
              <span>Player A locked</span>
              <span>Player B joining</span>
              <span>Escrow ready</span>
              <span>Claim enabled</span>
            </div>
          </div>
        </section>
        <section className="notice-bar">{notice}</section>
      </main>
    );
  }

  return (
    <main className="arena-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sentinel Quiz</p>
          <h2>{route === "/matchmake" ? "Matchmake" : route === "/lobby" ? "Lobby" : route === "/game" ? "Game Room" : route === "/settlement" ? "Claim Prize" : "Match History"}</h2>
        </div>
        {walletControls}
      </header>

      {appNav}

      <section className="system-strip">
        <div><span>Backend</span><strong>{API_URL}</strong></div>
        <div><span>Realtime</span><strong className={socketState === "online" ? "ok" : "warn"}>{socketState}</strong></div>
        <div><span>Cluster</span><strong>{rpcInfo?.cluster || SOLANA_CLUSTER}</strong></div>
        <div><span>Join tx required</span><strong>{rpcInfo?.joinTxVerificationRequired ? "yes" : "no"}</strong></div>
      </section>

      {route === "/matchmake" ? (
        <section className="page-card narrow-page">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Matchmake</p>
              <h2>Create match settings</h2>
            </div>
            <button type="button" onClick={() => void refreshDashboard()}>Refresh</button>
          </div>

          <div className="form-grid">
            <label>Entry fee SOL<input value={entryFeeSol} onChange={(event) => setEntryFeeSol(event.target.value)} inputMode="decimal" /></label>
            <label>Players<input type="number" min={2} max={8} value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))} /></label>
            <label>Questions<input type="number" min={1} max={12} value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} /></label>
            <label>Round seconds<input type="number" min={3} max={45} value={Math.round(questionTimeMs / 1000)} onChange={(event) => setQuestionTimeMs(Number(event.target.value) * 1000)} /></label>
            <label>Topic<input value={topic} onChange={(event) => setTopic(event.target.value)} /></label>
            <label>Privacy<select value={privacy} onChange={(event) => setPrivacy(event.target.value as Privacy)}><option value="public">Public</option><option value="private">Private</option></select></label>
          </div>

          <label className="wide-label">Join/deposit tx signature<input value={txSignature} onChange={(event) => setTxSignature(event.target.value)} placeholder="Optional while REQUIRE_JOIN_TX_VERIFICATION=false" /></label>

          <div className="action-row">
            <button type="button" className="primary" onClick={() => void createLobby()} disabled={!isWalletConnected}>Create Lobby</button>
            <button type="button" onClick={findMatch} disabled={!isWalletConnected || socketState !== "online"}>Find Match</button>
          </div>
        </section>
      ) : null}

      {route === "/lobby" ? (
        <section className="page-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Lobby</p>
              <h2>Open lobbies</h2>
            </div>
            <span className="count-pill">{lobbies.length}</span>
          </div>
          <div className="lobby-list">
            {lobbies.length === 0 ? <p className="empty">No lobbies yet. Create one from Matchmake.</p> : null}
            {lobbies.map((lobby) => (
              <article key={lobby.lobbyId} className="lobby-item">
                <div>
                  <strong>{lobby.topic}</strong>
                  <span>{shortAddress(lobby.lobbyId)} | {lamportsToSol(lobby.entryFeeLamports)} SOL</span>
                </div>
                <div className="lobby-meta">
                  <span>{lobby.players.length}/{lobby.maxPlayers}</span>
                  <span>{lobby.status}</span>
                </div>
                <button type="button" onClick={() => joinLobby(lobby.lobbyId)} disabled={!isWalletConnected || lobby.status !== "waiting"}>Join</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {route === "/game" ? (
        <section className="page-grid game-page">
          <section className="page-card match-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Game</p>
                <h2>{activeLobby ? activeLobby.topic : "Waiting for match"}</h2>
              </div>
              <span className="count-pill">{activeLobby?.status || "idle"}</span>
            </div>

            {activeLobby ? (
              <div className="match-summary">
                <div><span>Lobby</span><strong>{shortAddress(activeLobby.lobbyId)}</strong></div>
                <div><span>Entry</span><strong>{lamportsToSol(activeLobby.entryFeeLamports)} SOL</strong></div>
                <div><span>Players</span><strong>{activeLobby.players.length}/{activeLobby.maxPlayers}</strong></div>
                <div><span>Your rank</span><strong>{playerRank || "-"}</strong></div>
              </div>
            ) : <p className="empty large">Find or join a match to start playing.</p>}

            {activeQuestion ? (
              <div className="question-card">
                <div className="timer-track"><span style={{ width: `${timerPct}%` }} /></div>
                <p className="question-index">Question {activeQuestion.index + 1}</p>
                <h3>{activeQuestion.text}</h3>
                <div className="choices-grid">
                  {activeQuestion.choices.map((choice, index) => (
                    <button key={choice} type="button" onClick={() => submitAnswer(index)} disabled={!isWalletConnected || remainingMs <= 0}>{choice}</button>
                  ))}
                </div>
                <p className="answer-note">{lastAnswer ? `${lastAnswer.correct ? "Correct" : "Missed"} | +${lastAnswer.points} points` : `${Math.ceil(remainingMs / 1000)}s remaining`}</p>
              </div>
            ) : null}
          </section>

          <aside className="page-card scoreboard">
            <div className="panel-head compact-head"><p className="eyebrow">Scoreboard</p><h2>Players</h2></div>
            {scores.length === 0 ? <p className="empty">Scores appear once the match starts.</p> : null}
            {scores.map((score, index) => (
              <div key={score.player} className={score.player === address ? "score-row me" : "score-row"}>
                <span>#{index + 1}</span>
                <strong>{shortAddress(score.player)}</strong>
                <em>{score.score}</em>
              </div>
            ))}
          </aside>
        </section>
      ) : null}

      {route === "/settlement" ? (
        <section className="page-card narrow-page">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Claim</p>
              <h2>Prize settlement</h2>
            </div>
          </div>
          {matchEnded ? (
            <div className="claim-box">
              <div className="winner-line"><span>Winner</span><strong>{shortAddress(matchEnded.winner)}</strong></div>
              <div className="winner-line"><span>Payout</span><strong>{lamportsToSol(matchEnded.payoutLamports)} SOL</strong></div>
              <textarea readOnly value={matchEnded.signedResult.canonical} />
              <input value={claimTxSignature} onChange={(event) => setClaimTxSignature(event.target.value)} placeholder="Claim tx signature after on-chain claim" />
              <button type="button" className="primary" onClick={() => void recordClaim()}>Record Claim</button>
            </div>
          ) : <p className="empty">The server-signed result appears here when a match ends.</p>}
        </section>
      ) : null}

      {route === "/history" ? (
        <section className="page-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">History</p>
              <h2>Recent winners</h2>
            </div>
          </div>
          <div className="history-list">
            {history.length === 0 ? <p className="empty">No completed matches yet.</p> : null}
            {history.map((match) => (
              <article key={match.matchId}>
                <div><strong>{shortAddress(match.winner)}</strong><span>{formatDate(match.finishedAt)}</span></div>
                <p>{lamportsToSol(match.prizeLamports)} SOL | {match.players} players | {match.claimStatus || "unclaimed"}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="notice-bar">{notice}</section>
    </main>
  );
}
