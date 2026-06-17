import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { shortAddress, solToLamports } from "./utils";

type AppRoute = "/" | "/dashboard" | "/matchmake" | "/lobby" | "/game" | "/leaderboard" | "/history" | "/profile" | "/admin";
type LobbyStatus = "waiting" | "playing" | "finished" | "cancelled";
type GameMode = "Speed" | "Classic" | "Survival";

type Profile = {
  wallet: string;
  username: string;
  avatar: string;
  bio: string;
  favoriteTopic: string;
};

type LobbyPlayer = {
  player: string;
  joinedAt?: string;
  score?: number;
  bot?: boolean;
};

type Lobby = {
  lobbyId: string;
  host?: string;
  entryFeeLamports: string;
  maxPlayers: number;
  questionCount: number;
  questionTimeMs: number;
  topic: string;
  mode?: GameMode;
  privacy: "public" | "private";
  status: LobbyStatus;
  players: LobbyPlayer[];
  createdAt: string;
  matchId?: string | null;
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
};

type NavItem = {
  label: string;
  route: AppRoute;
  icon: string;
};

type WalletSession = {
  route?: AppRoute;
  selectedTopic?: string;
  selectedMode?: GameMode;
  entryFee?: string;
  activeLobbyId?: string;
  updatedAt?: string;
};

const API_URL = import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:4000";
const WS_URL = import.meta.env.VITE_BACKEND_WS_URL || "ws://localhost:4000";

const topics = ["Solana Ecosystem", "Crypto History", "DeFi Fundamentals", "NFT Markets", "Web3 Development", "Blockchain Tech", "Trading & Markets", "Bitcoin", "Ethereum"];
const avatars = ["👨‍🚀", "👸", "🧑", "🧑‍🦰", "🧔", "👩", "🧑‍🎤", "🧑‍💻"];

const navItems: NavItem[] = [
  { label: "Dashboard", route: "/dashboard", icon: "▦" },
  { label: "Matchmaking", route: "/matchmake", icon: "⚔" },
  { label: "Find Lobbies", route: "/lobby", icon: "⌕" },
  { label: "Leaderboard", route: "/leaderboard", icon: "♕" },
  { label: "Match History", route: "/history", icon: "↺" },
  { label: "Profile", route: "/profile", icon: "♙" },
  { label: "Admin Panel", route: "/admin", icon: "♢" },
];

const normalizeRoute = (pathname: string): AppRoute => {
  if (pathname === "/") return "/";
  if (pathname === "/find-match") return "/lobby";
  if (["/dashboard", "/matchmake", "/lobby", "/game", "/leaderboard", "/history", "/profile", "/admin"].includes(pathname)) {
    return pathname as AppRoute;
  }
  return "/dashboard";
};

const lamportsToSol = (lamports?: string) => {
  const value = Number(lamports || "0") / 1_000_000_000;
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const defaultProfile = (wallet?: string): Profile => ({
  wallet: wallet || "",
  username: wallet ? shortAddress(wallet) : "QuizChamp",
  avatar: "👨‍🚀",
  bio: "Sol Quiz Arena competitor",
  favoriteTopic: "Solana Ecosystem",
});

const walletSessionKey = (walletAddress: string) => `sol-quiz-arena:${walletAddress}:session`;

const readWalletSession = (walletAddress?: string): WalletSession => {
  if (!walletAddress) return {};
  try {
    return JSON.parse(window.localStorage.getItem(walletSessionKey(walletAddress)) || "{}") as WalletSession;
  } catch {
    return {};
  }
};

const writeWalletSession = (walletAddress: string | undefined, patch: WalletSession) => {
  if (!walletAddress) return;
  const current = readWalletSession(walletAddress);
  window.localStorage.setItem(walletSessionKey(walletAddress), JSON.stringify({ ...current, ...patch, updatedAt: new Date().toISOString() }));
};

export default function App() {
  const { connectors, connect, disconnect, wallet, status } = useWalletConnection();
  const socketRef = useRef<WebSocket | null>(null);
  const [route, setRoute] = useState<AppRoute>(() => normalizeRoute(window.location.pathname));
  const [socketState, setSocketState] = useState<"offline" | "connecting" | "online">("offline");
  const [notice, setNotice] = useState("Connect your wallet to enter the arena.");
  const [profile, setProfile] = useState<Profile>(() => defaultProfile());
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<QuestionEvent | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [lastAnswer, setLastAnswer] = useState<{ correct: boolean; points: number } | null>(null);
  const [matchWinner, setMatchWinner] = useState("");
  const [entryFee, setEntryFee] = useState("0.5");
  const [selectedTopic, setSelectedTopic] = useState("Solana Ecosystem");
  const [selectedMode, setSelectedMode] = useState<GameMode>("Speed");
  const [now, setNow] = useState(Date.now());

  const address = wallet?.account.address.toString();
  const isWalletConnected = status === "connected" && Boolean(address);
  const remainingMs = activeQuestion ? Math.max(0, activeQuestion.startedAt + activeQuestion.timeLimitMs - now) : 0;
  const timerPct = activeQuestion ? Math.max(0, Math.min(100, (remainingMs / activeQuestion.timeLimitMs) * 100)) : 0;
  const playerScore = scores.find((score) => score.player === address)?.score || 0;

  async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) throw new Error(payload.error || `Request failed: ${path}`);
    return payload;
  }

  const navigate = (nextRoute: AppRoute) => {
    setRoute(nextRoute);
    window.history.pushState({}, "", nextRoute);
    if (nextRoute !== "/") writeWalletSession(address, { route: nextRoute });
  };

  const connectPrimaryWallet = () => {
    if (isWalletConnected) return navigate("/dashboard");
    const connector = connectors[0];
    if (!connector) {
      setNotice("No wallet connector detected. Install a Solana wallet and refresh.");
      return;
    }
    void connect(connector.id);
  };

  const refreshLobbies = async () => {
    try {
      const payload = await apiFetch<{ lobbies: Lobby[] }>("/lobbies");
      setLobbies(payload.lobbies);
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  const sendSocket = (payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setNotice("Realtime server is not connected yet.");
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  };

  const syncLobby = (lobby: Lobby) => {
    setActiveLobby(lobby);
    setLobbies((current) => [lobby, ...current.filter((item) => item.lobbyId !== lobby.lobbyId)]);
    writeWalletSession(address, { activeLobbyId: lobby.lobbyId, route: "/game" });
  };

  const handleServerMessage = (data: ServerMessage) => {
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
      if (["lobby_created", "joined", "matchmaking_joined"].includes(data.type)) navigate("/game");
      setNotice(data.type === "bot_added" ? "Demo rival joined. Match is starting." : "Lobby synced.");
      return;
    }
    if (data.type === "match_started") {
      if (data.lobby) syncLobby(data.lobby);
      setScores((data.players || []).map((player) => ({ player, score: 0 })));
      setActiveQuestion(null);
      setMatchWinner("");
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
      setMatchWinner(data.winner || "");
      setActiveQuestion(null);
      if (data.scores) setScores(data.scores);
      setNotice("Match complete. Results are synced.");
      void refreshLobbies();
    }
  };

  const createLobby = () => {
    if (!address) return setNotice("Connect a wallet before creating a lobby.");
    sendSocket({
      type: "create_lobby",
      host: address,
      player: address,
      entryFeeLamports: solToLamports(entryFee),
      maxPlayers: 2,
      questionCount: 5,
      questionTimeMs: selectedMode === "Speed" ? 12000 : 18000,
      topic: selectedTopic,
      mode: selectedMode,
      privacy: "public",
    });
  };

  const quickMatch = () => {
    if (!address) return setNotice("Connect a wallet before matchmaking.");
    sendSocket({
      type: "find_match",
      player: address,
      entryFeeLamports: solToLamports(entryFee),
      maxPlayers: 2,
      questionCount: 5,
      questionTimeMs: selectedMode === "Speed" ? 12000 : 18000,
      topic: selectedTopic,
      mode: selectedMode,
      privacy: "public",
    });
  };

  const joinLobby = (lobbyId: string) => {
    if (!address) return setNotice("Connect a wallet before joining a lobby.");
    sendSocket({ type: "join_lobby", lobbyId, player: address });
  };

  const addDemoRival = () => {
    if (!activeLobby) return;
    sendSocket({ type: "add_bot", lobbyId: activeLobby.lobbyId, name: "QuizBot" });
  };

  const submitAnswer = (answerIdx: number) => {
    if (!address || !activeLobby || !activeQuestion) return;
    sendSocket({
      type: "submit_answer",
      lobbyId: activeLobby.lobbyId,
      player: address,
      questionIndex: activeQuestion.index,
      answerIdx,
    });
  };

  const saveProfile = async (nextProfile: Profile) => {
    if (!address) return setNotice("Connect a wallet before saving a profile.");
    const payload = await apiFetch<{ profile: Profile }>(`/profiles/${address}`, {
      method: "PUT",
      body: JSON.stringify(nextProfile),
    });
    setProfile(payload.profile);
    writeWalletSession(address, { selectedTopic: payload.profile.favoriteTopic });
    setNotice("Profile saved and synced.");
  };

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;
    setSocketState("connecting");
    socket.addEventListener("open", () => setSocketState("online"));
    socket.addEventListener("close", () => setSocketState("offline"));
    socket.addEventListener("error", () => {
      setSocketState("offline");
      setNotice("Realtime socket error. Make sure the backend is running.");
    });
    socket.addEventListener("message", (event) => handleServerMessage(JSON.parse(event.data)));
    return () => socket.close();
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(normalizeRoute(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    void refreshLobbies();
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    writeWalletSession(address, { entryFee, selectedMode, selectedTopic });
  }, [address, entryFee, selectedMode, selectedTopic]);

  useEffect(() => {
    if (!address) {
      setProfile(defaultProfile());
      return;
    }
    const session = readWalletSession(address);
    if (session.entryFee) setEntryFee(session.entryFee);
    if (session.selectedMode) setSelectedMode(session.selectedMode);
    if (session.selectedTopic) setSelectedTopic(session.selectedTopic);

    void apiFetch<{ profile: Profile }>(`/profiles/${address}`)
      .then((payload) => {
        setProfile(payload.profile);
        setSelectedTopic(session.selectedTopic || payload.profile.favoriteTopic || "Solana Ecosystem");
      })
      .catch(() => setProfile(defaultProfile(address)));

    const resumeRoute = session.route && session.route !== "/" ? session.route : "/dashboard";
    setRoute(resumeRoute);
    window.history.replaceState({}, "", resumeRoute);

    if (session.activeLobbyId) {
      void apiFetch<{ lobby: Lobby }>(`/lobbies/${session.activeLobbyId}`)
        .then((payload) => {
          const isPlayer = payload.lobby.players.some((player) => player.player === address);
          if (isPlayer && payload.lobby.status !== "finished") {
            setActiveLobby(payload.lobby);
            if (resumeRoute === "/game") setNotice("Resumed your last lobby from this wallet.");
          }
        })
        .catch(() => writeWalletSession(address, { activeLobbyId: undefined }));
    }
  }, [address]);

  if (route === "/") {
    return <LandingPage connectPrimaryWallet={connectPrimaryWallet} isWalletConnected={isWalletConnected} navigate={navigate} />;
  }

  return (
    <ArenaShell
      address={address}
      connectors={connectors}
      connect={connect}
      disconnect={disconnect}
      isWalletConnected={isWalletConnected}
      navigate={navigate}
      notice={notice}
      profile={profile}
      route={route}
      socketState={socketState}
      status={status}
    >
      {route === "/matchmake" ? (
        <MatchmakingPage
          createLobby={createLobby}
          entryFee={entryFee}
          quickMatch={quickMatch}
          selectedMode={selectedMode}
          selectedTopic={selectedTopic}
          setEntryFee={setEntryFee}
          setSelectedMode={setSelectedMode}
          setSelectedTopic={setSelectedTopic}
        />
      ) : route === "/lobby" ? (
        <LobbiesPage joinLobby={joinLobby} lobbies={lobbies} refreshLobbies={refreshLobbies} />
      ) : route === "/game" ? (
        <GamePage
          activeLobby={activeLobby}
          activeQuestion={activeQuestion}
          addDemoRival={addDemoRival}
          address={address}
          lastAnswer={lastAnswer}
          matchWinner={matchWinner}
          playerScore={playerScore}
          remainingMs={remainingMs}
          scores={scores}
          submitAnswer={submitAnswer}
          timerPct={timerPct}
        />
      ) : route === "/profile" ? (
        <ProfilePage address={address} profile={profile} saveProfile={saveProfile} />
      ) : (
        <DashboardPage lobbies={lobbies} navigate={navigate} profile={profile} />
      )}
    </ArenaShell>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark">ϟ</div>
      <div>
        <div className="brand-title">SOL QUIZ</div>
        <div className={compact ? "brand-sub compact" : "brand-sub"}>ARENA</div>
      </div>
    </div>
  );
}

function LandingPage({ connectPrimaryWallet, isWalletConnected, navigate }: { connectPrimaryWallet: () => void; isWalletConnected: boolean; navigate: (route: AppRoute) => void }) {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Brand compact />
        <nav><a>How It Works</a><a>Leaderboard</a><a>Tournaments</a><a>Docs</a></nav>
        <button className="gradient-button" onClick={connectPrimaryWallet}><span>ϟ</span>{isWalletConnected ? "Enter Arena" : "Connect Wallet"}</button>
      </header>
      <section className="hero-grid">
        <div className="target target-a" /><div className="target target-b" /><div className="target target-c" /><div className="target target-d" />
        <div className="hero-content">
          <div className="live-pill landing-pill"><span />2,848 PLAYERS COMPETING NOW</div>
          <h1>PLAY QUIZ.<strong>EARN SOL.</strong></h1>
          <p>The first competitive play-to-earn quiz arena on Solana. Answer faster. Win bigger. Earn real SOL every match.</p>
          <div className="prize-panel">
            <div className="prize-block"><span className="trophy">♕</span><div><small>TOTAL PRIZE POOL</small><strong>142847.43 SOL</strong></div></div>
            <div className="divider" />
            <div><small>TODAY'S MATCHES</small><strong>9,284</strong></div>
          </div>
          <div className="hero-actions">
            <button className="gradient-button big" onClick={() => navigate("/matchmake")}><span>▷</span> START PLAYING <span>›</span></button>
            <button className="outline-button big" onClick={() => navigate("/lobby")}>VIEW LIVE LOBBIES</button>
          </div>
        </div>
      </section>
    </main>
  );
}

function ArenaShell({
  address,
  children,
  connectors,
  connect,
  disconnect,
  isWalletConnected,
  navigate,
  notice,
  profile,
  route,
  socketState,
  status,
}: {
  address?: string;
  children: ReactNode;
  connectors: readonly { id: string; name: string }[];
  connect: (connectorId: string) => unknown;
  disconnect: () => unknown;
  isWalletConnected: boolean;
  navigate: (route: AppRoute) => void;
  notice: string;
  profile: Profile;
  route: AppRoute;
  socketState: string;
  status: string;
}) {
  return (
    <main className="arena">
      <aside className="sidebar">
        <div className="sidebar-top">
          <Brand />
          <button className="wallet-card" onClick={() => navigate("/profile")}>
            <span>▣</span><div><small>{isWalletConnected ? "CONNECTED" : "PROFILE"}</small><strong>{isWalletConnected ? shortAddress(address) : "No wallet"}</strong></div><b>{profile.avatar}</b>
          </button>
          <nav className="side-nav">
            {navItems.map((item) => (
              <button key={item.route} className={route === item.route ? "active" : ""} onClick={() => navigate(item.route)}>
                <span>{item.icon}</span>{item.label}{route === item.route ? <em>›</em> : null}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => navigate("/profile")}><span>⚙</span> Profile Setup</button>
          <button className="danger" onClick={() => void disconnect()} disabled={!isWalletConnected}><span>↪</span> Disconnect</button>
        </div>
      </aside>
      <section className="arena-main">
        <header className="topbar">
          <div className="live-pill"><i>⌁</i> {socketState.toUpperCase()} • 2,847 PLAYERS</div>
          <div className="top-actions">
            <div className="wallet-select">
              <span className={isWalletConnected ? "connected" : ""} />
              <select disabled={status === "connecting" || isWalletConnected} onChange={(event) => event.target.value && void connect(event.target.value)} value="">
                <option value="">{isWalletConnected ? shortAddress(address) : status === "connecting" ? "Connecting..." : "Connect wallet"}</option>
                {connectors.map((connector) => <option key={connector.id} value={connector.id}>{connector.name}</option>)}
              </select>
            </div>
            <div className="pool-pill">♕ Pool: 486 SOL</div>
            <button className="avatar" onClick={() => navigate("/profile")}>{profile.avatar}</button>
          </div>
        </header>
        {children}
        <div className="notice">{notice}</div>
      </section>
    </main>
  );
}

function DashboardPage({ lobbies, navigate, profile }: { lobbies: Lobby[]; navigate: (route: AppRoute) => void; profile: Profile }) {
  const openLobbies = lobbies.filter((lobby) => lobby.status === "waiting").length;
  const metrics = [
    { icon: "⌁", label: "SOL Balance", value: "12.48", detail: "+6.3 today", tone: "green" },
    { icon: "♕", label: "Open Lobbies", value: String(openLobbies), detail: "Backend synced", tone: "purple" },
    { icon: "↗", label: "Favorite Topic", value: profile.favoriteTopic.split(" ")[0], detail: profile.favoriteTopic, tone: "cyan" },
    { icon: "ϟ", label: "Win Streak", value: "14", detail: "Personal best: 22", tone: "gold" },
  ];
  const leaders = [
    { rank: "🥇", avatar: "👸", name: "CryptoKing_Sol", score: "847.2", delta: "+12.4" },
    { rank: "🥈", avatar: "🧑", name: "SolMaster99", score: "623.8", delta: "+8.1" },
    { rank: "🥉", avatar: "🧑‍🦰", name: "QuizWhale", score: "518.4", delta: "+5.7" },
  ];

  return (
    <div className="content dashboard">
      <section className="welcome">
        <div><h2>Welcome back, <span>{profile.username}</span></h2><p>Rank #47 globally • profile synced to wallet</p></div>
        <div className="welcome-actions"><button className="gradient-button" onClick={() => navigate("/matchmake")}>▷ QUICK PLAY</button><button className="outline-button" onClick={() => navigate("/lobby")}>FIND LOBBIES</button></div>
      </section>
      <section className="metric-grid">
        {metrics.map((metric) => <article className={`metric-card ${metric.tone}`} key={metric.label}><div className="metric-icon">{metric.icon}</div><div className="metric-value">{metric.value}</div><p>{metric.detail}</p><span>{metric.label}</span></article>)}
      </section>
      <section className="dashboard-panels">
        <article className="chart-panel">
          <div><h3>WEEKLY EARNINGS</h3><p>+31.4 SOL this week</p></div><span className="chart-badge">↗ +42%</span>
          <svg viewBox="0 0 760 280" role="img" aria-label="Weekly earnings line chart"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#963cff" stopOpacity="0.35" /><stop offset="100%" stopColor="#963cff" stopOpacity="0" /></linearGradient></defs><path d="M6 224 C92 174 122 164 198 188 C288 216 278 218 360 164 C428 120 514 182 584 126 C650 72 672 88 754 104 L754 270 L6 270 Z" fill="url(#chartFill)" /><path d="M6 224 C92 174 122 164 198 188 C288 216 278 218 360 164 C428 120 514 182 584 126 C650 72 672 88 754 104" fill="none" stroke="#973dff" strokeWidth="4" /></svg>
        </article>
        <article className="leader-panel">
          <div className="panel-head"><h3>LEADERBOARD</h3><a>View all</a></div>
          {leaders.map((leader) => <div className="leader-row" key={leader.name}><span>{leader.rank}</span><b>{leader.avatar}</b><strong>{leader.name}</strong><em>{leader.score}<small>{leader.delta}</small></em></div>)}
          <div className="leader-row self"><span>#47</span><b>{profile.avatar}</b><strong>You</strong><em>84.7<small>+6.3</small></em></div>
        </article>
      </section>
      <section className="bottom-tabs"><b>Recent Matches</b><span>Daily Quests</span></section>
    </div>
  );
}

function MatchmakingPage({
  createLobby,
  entryFee,
  quickMatch,
  selectedMode,
  selectedTopic,
  setEntryFee,
  setSelectedMode,
  setSelectedTopic,
}: {
  createLobby: () => void;
  entryFee: string;
  quickMatch: () => void;
  selectedMode: GameMode;
  selectedTopic: string;
  setEntryFee: (value: string) => void;
  setSelectedMode: (value: GameMode) => void;
  setSelectedTopic: (value: string) => void;
}) {
  const fees = ["0.1", "0.25", "0.5", "1", "2.5", "5"];
  const modes: { mode: GameMode; icon: string; copy: string }[] = [
    { mode: "Speed", icon: "ϟ", copy: "Fastest answer wins" },
    { mode: "Classic", icon: "♕", copy: "Most correct wins" },
    { mode: "Survival", icon: "☊", copy: "Eliminate on wrong" },
  ];

  return (
    <div className="content narrow">
      <section className="page-title"><h2>MATCHMAKING</h2><p>Find or create a competitive quiz match</p></section>
      <div className="segmented"><button className="active" onClick={quickMatch}>ϟ QUICK MATCH</button><button onClick={createLobby}>＋ CREATE LOBBY</button></div>
      <section className="config-panel"><label>GAME MODE</label><div className="mode-grid">{modes.map((item) => <button className={`mode ${selectedMode === item.mode ? "active" : ""} ${item.mode === "Survival" ? "danger-mode" : ""}`} key={item.mode} onClick={() => setSelectedMode(item.mode)}><span>{item.icon}</span><strong>{item.mode.toUpperCase()}</strong><small>{item.copy}</small></button>)}</div></section>
      <section className="config-panel"><label>TOPIC</label><div className="chip-row">{topics.map((topic) => <button key={topic} className={selectedTopic === topic ? "active" : ""} onClick={() => setSelectedTopic(topic)}>{topic}</button>)}</div></section>
      <section className="config-panel"><label>ENTRY FEE</label><div className="fee-grid">{fees.map((fee) => <button key={fee} className={entryFee === fee ? "active" : ""} onClick={() => setEntryFee(fee)}>◎{fee}</button>)}</div></section>
      <button className="gradient-button launch-match" onClick={createLobby}>CREATE {selectedTopic.toUpperCase()} LOBBY</button>
    </div>
  );
}

function LobbiesPage({ joinLobby, lobbies, refreshLobbies }: { joinLobby: (lobbyId: string) => void; lobbies: Lobby[]; refreshLobbies: () => void }) {
  const filters = ["All", "Waiting", "Starting", "Speed", "Classic"];
  const activeCount = lobbies.filter((lobby) => lobby.status !== "finished").length;
  return (
    <div className="content lobbies-page">
      <section className="lobby-head"><div><h2>LIVE LOBBIES</h2><p><span />{activeCount} ACTIVE LOBBIES</p></div><button className="refresh" onClick={() => void refreshLobbies()}>⟳ Refresh</button></section>
      <section className="search-row"><div className="search-box">⌕ <span>Search lobbies, topics, hosts...</span></div><button className="filter-icon">▽</button>{filters.map((filter, index) => <button className={index === 0 ? "active" : ""} key={filter}>{filter}</button>)}</section>
      {lobbies.length ? <section className="lobby-grid">{lobbies.map((lobby) => <LobbyCard joinLobby={joinLobby} lobby={lobby} key={lobby.lobbyId} />)}</section> : <EmptyState title="No live lobbies yet" copy="Create one from Matchmaking and it will appear here instantly." />}
    </div>
  );
}

function LobbyCard({ joinLobby, lobby }: { joinLobby: (lobbyId: string) => void; lobby: Lobby }) {
  const filled = lobby.players.length;
  const dots = Array.from({ length: Math.max(lobby.maxPlayers, 4) }, (_, index) => index < filled);
  const isFull = filled >= lobby.maxPlayers || lobby.status !== "waiting";
  return (
    <article className={`lobby-card ${lobby.status === "playing" ? "starting" : lobby.status}`}>
      <div className="lobby-card-top"><div className="host-avatar">👨‍🚀</div><div><h3>{lobby.topic} Championship <span>◎</span></h3><p>Hosted by <b>{shortAddress(lobby.host)}</b></p></div><em className={`status ${lobby.status === "playing" ? "starting" : lobby.status}`}><i />{lobby.status.toUpperCase()}</em></div>
      <div className="lobby-tags"><span>{lobby.topic}</span><span className={(lobby.mode || "Speed").toLowerCase()}>{(lobby.mode || "Speed").toUpperCase()}</span></div>
      <div className="lobby-meta"><span>♙ {filled}/{lobby.maxPlayers}</span><div className="dots">{dots.map((item, index) => <i className={item ? "filled" : ""} key={index} />)}</div><span className="gold">♕ ◎{lamportsToSol(lobby.entryFeeLamports)}</span><span className="cyan">◷ {Math.round(lobby.questionTimeMs / 1000)}s</span><strong>◎{lamportsToSol(lobby.entryFeeLamports)}/entry</strong><button className={isFull ? "full" : ""} onClick={() => !isFull && joinLobby(lobby.lobbyId)}>{isFull ? lobby.status.toUpperCase() : "JOIN"}</button></div>
    </article>
  );
}

function GamePage({
  activeLobby,
  activeQuestion,
  addDemoRival,
  address,
  lastAnswer,
  matchWinner,
  playerScore,
  remainingMs,
  scores,
  submitAnswer,
  timerPct,
}: {
  activeLobby: Lobby | null;
  activeQuestion: QuestionEvent | null;
  addDemoRival: () => void;
  address?: string;
  lastAnswer: { correct: boolean; points: number } | null;
  matchWinner: string;
  playerScore: number;
  remainingMs: number;
  scores: Score[];
  submitAnswer: (answerIdx: number) => void;
  timerPct: number;
}) {
  if (!activeLobby) return <div className="content"><EmptyState title="No active lobby" copy="Create or join a lobby to start playing." /></div>;

  if (matchWinner) {
    return (
      <div className="content narrow">
        <section className="result-panel"><h2>MATCH COMPLETE</h2><p>Winner: <b>{matchWinner === address ? "You" : shortAddress(matchWinner)}</b></p>{scores.map((score) => <div className="score-row" key={score.player}><span>{score.player === address ? "You" : shortAddress(score.player)}</span><strong>{score.score}</strong></div>)}</section>
      </div>
    );
  }

  if (!activeQuestion) {
    return (
      <div className="content narrow">
        <section className="game-room">
          <div><h2>{activeLobby.topic} Lobby</h2><p>{activeLobby.status === "waiting" ? "Waiting for enough players to start" : "Match starting..."}</p></div>
          <div className="room-stats"><span>{activeLobby.players.length}/{activeLobby.maxPlayers} players</span><span>{activeLobby.mode || "Speed"}</span><span>◎{lamportsToSol(activeLobby.entryFeeLamports)} entry</span></div>
          <div className="player-list">{activeLobby.players.map((player) => <div key={player.player}><span>{player.bot ? "🤖" : "👨‍🚀"}</span><strong>{player.player === address ? "You" : shortAddress(player.player)}</strong></div>)}</div>
          {activeLobby.status === "waiting" ? <button className="gradient-button launch-match" onClick={addDemoRival}>ADD DEMO RIVAL & START</button> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="content narrow">
      <section className="quiz-panel">
        <div className="quiz-head"><div><h2>{activeLobby.topic}</h2><p>Question {activeQuestion.index + 1} of {activeLobby.questionCount}</p></div><strong>{Math.ceil(remainingMs / 1000)}s</strong></div>
        <div className="timer-track"><span style={{ width: `${timerPct}%` }} /></div>
        <h3>{activeQuestion.text}</h3>
        <div className="answer-grid">{activeQuestion.choices.map((choice, index) => <button key={choice} onClick={() => submitAnswer(index)} disabled={Boolean(lastAnswer)}><span>{String.fromCharCode(65 + index)}</span>{choice}</button>)}</div>
        <div className="game-footer"><span>Your score: {playerScore}</span>{lastAnswer ? <b className={lastAnswer.correct ? "correct" : "wrong"}>{lastAnswer.correct ? `Correct +${lastAnswer.points}` : "Wrong answer"}</b> : <b>Choose fast</b>}</div>
      </section>
    </div>
  );
}

function ProfilePage({ address, profile, saveProfile }: { address?: string; profile: Profile; saveProfile: (profile: Profile) => Promise<void> }) {
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);
  return (
    <div className="content narrow">
      <section className="profile-panel">
        <div className="page-title"><h2>PROFILE</h2><p>{address ? shortAddress(address) : "Connect a wallet to save your profile"}</p></div>
        <label>AVATAR</label><div className="avatar-picker">{avatars.map((avatar) => <button className={draft.avatar === avatar ? "active" : ""} key={avatar} onClick={() => setDraft({ ...draft, avatar })}>{avatar}</button>)}</div>
        <label>USERNAME</label><input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
        <label>BIO</label><textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} />
        <label>FAVORITE TOPIC</label><select value={draft.favoriteTopic} onChange={(event) => setDraft({ ...draft, favoriteTopic: event.target.value })}>{topics.map((topic) => <option key={topic}>{topic}</option>)}</select>
        <button className="gradient-button launch-match" onClick={() => void saveProfile(draft)}>SAVE PROFILE</button>
      </section>
    </div>
  );
}

function EmptyState({ copy, title }: { copy: string; title: string }) {
  return <section className="empty-state"><h2>{title}</h2><p>{copy}</p></section>;
}
