import { useEffect, useState, type ReactNode } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { useArena } from "./context/ArenaContext";
import { FIXED_ENTRY_FEE_SOL, GAME_TOPICS } from "./gameConfig";
import { ArenaHistoryPage } from "./pages/ArenaHistoryPage";
import { ClaimPage } from "./pages/ClaimPage";
import type { AppRoute, GameMode, Lobby, NavItem, Profile, QuestionEvent, Score } from "./types";
import { lamportsToSol, shortAddress } from "./utils";

const avatars = ["👨‍🚀", "👸", "🧑", "🧑‍🦰", "🧔", "👩", "🧑‍🎤", "🧑‍💻"];

const navItems: NavItem[] = [
  { label: "Dashboard", route: "/dashboard", icon: "▦" },
  { label: "Matchmaking", route: "/matchmake", icon: "⚔" },
  { label: "Find Lobbies", route: "/lobby", icon: "⌕" },
  { label: "Player Docs", route: "/docs", icon: "◈" },
  { label: "Claim Prize", route: "/settlement", icon: "◎" },
  { label: "Match History", route: "/history", icon: "↺" },
  { label: "Profile", route: "/profile", icon: "♙" },
];

export default function App() {
  const { connectors, connect, disconnect, wallet, status } = useWalletConnection();
  const arena = useArena();

  const address = wallet?.account.address.toString();
  const isWalletConnected = status === "connected" && Boolean(address);

  const connectPrimaryWallet = () => {
    if (isWalletConnected) return arena.navigate("/dashboard");
    const connector = connectors[0];
    if (!connector) {
      arena.setNotice("No wallet connector detected. Install a Solana wallet and refresh.");
      return;
    }
    void connect(connector.id);
  };

  useEffect(() => {
    if (isWalletConnected && arena.route === "/") arena.navigate("/dashboard");
  }, [arena, isWalletConnected]);

  if (arena.route === "/") {
    return (
      <LandingPage
        connectPrimaryWallet={connectPrimaryWallet}
        isWalletConnected={isWalletConnected}
        navigate={arena.navigate}
      />
    );
  }

  return (
    <ArenaShell
      address={address}
      apiError={arena.api.error}
      backendOnline={arena.backendOnline}
      connectors={connectors}
      connect={connect}
      disconnect={disconnect}
      isWalletConnected={isWalletConnected}
      navigate={arena.navigate}
      notice={arena.notice}
      profile={arena.profile}
      route={arena.route}
      socketState={arena.socketState}
      status={status}
    >
      {arena.route === "/matchmake" ? (
        <MatchmakingPage
          createLobby={arena.createLobby}
          quickMatch={arena.quickMatch}
          selectedMode={arena.selectedMode}
          setSelectedMode={arena.setSelectedMode}
        />
      ) : arena.route === "/lobby" ? (
        <LobbiesPage address={address} cancelLobby={arena.cancelLobby} joinLobby={arena.joinLobby} lobbies={arena.lobbies} refreshLobbies={arena.refreshLobbies} />
      ) : arena.route === "/docs" ? (
        <DocsPage navigate={arena.navigate} />
      ) : arena.route === "/game" ? (
        <GamePage
          activeLobby={arena.activeLobby}
          activeQuestion={arena.activeQuestion}
          address={address}
          cancelLobby={arena.cancelLobby}
          lastAnswer={arena.lastAnswer}
          matchWinner={arena.matchWinner}
          onClaimPrize={() => arena.navigate("/settlement")}
          playerScore={arena.playerScore}
          remainingMs={arena.remainingMs}
          scores={arena.scores}
          submitAnswer={arena.submitAnswer}
          timerPct={arena.timerPct}
        />
      ) : arena.route === "/settlement" ? (
        <ClaimPage
          address={address}
          claimTxSignature={arena.claimTxSignature}
          claimSubmitting={arena.claimSubmitting}
          matchEnded={arena.matchEnded}
          onClaimPrize={arena.claimPrizeOnchain}
          onClaimTxSignatureChange={arena.setClaimTxSignature}
          onGoToMatchmake={() => arena.navigate("/matchmake")}
          onRecordClaim={arena.recordClaim}
        />
      ) : arena.route === "/history" ? (
        <ArenaHistoryPage
          address={address}
          history={arena.history}
          onOpenClaim={async (matchId) => {
            await arena.loadMatchForClaim(matchId);
            arena.navigate("/settlement");
          }}
          onRefresh={arena.refreshHistory}
        />
      ) : arena.route === "/profile" ? (
        <ProfilePage address={address} profile={arena.profile} saveProfile={arena.saveProfile} />
      ) : (
        <DashboardPage lobbies={arena.lobbies} navigate={arena.navigate} profile={arena.profile} />
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

function LandingPage({
  connectPrimaryWallet,
  isWalletConnected,
  navigate,
}: {
  connectPrimaryWallet: () => void;
  isWalletConnected: boolean;
  navigate: (route: AppRoute) => void;
}) {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Brand compact />
        <nav>
          <button type="button" onClick={() => navigate("/docs")}>Player Docs</button>
          <button type="button" onClick={() => navigate("/lobby")}>Live Lobbies</button>
        </nav>
        <button className="gradient-button" onClick={connectPrimaryWallet}>
          <span>ϟ</span>
          {isWalletConnected ? "Enter Arena" : "Connect Wallet"}
        </button>
      </header>
      <section className="hero-grid">
        <div className="target target-a" />
        <div className="target target-b" />
        <div className="target target-c" />
        <div className="target target-d" />
        <div className="hero-content">
          <div className="live-pill landing-pill"><span />2,848 PLAYERS COMPETING NOW</div>
          <h1>
            PLAY QUIZ.<strong>EARN SOL.</strong>
          </h1>
          <p>The first competitive play-to-earn quiz arena on Solana. Answer faster. Win bigger. Earn real SOL every match.</p>
          <div className="hero-actions">
            <button className="gradient-button big" onClick={() => navigate("/matchmake")}>
              <span>▷</span> START PLAYING <span>›</span>
            </button>
            <button className="outline-button big" onClick={() => navigate("/lobby")}>
              VIEW LIVE LOBBIES
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function ArenaShell({
  address,
  apiError,
  backendOnline,
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
  apiError: string | null;
  backendOnline: boolean | null;
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
  const backendLabel = backendOnline ? "SYNC READY" : "SYNCING";

  return (
    <main className="arena">
      <aside className="sidebar">
        <div className="sidebar-top">
          <Brand />
          <button className="wallet-card" onClick={() => navigate("/profile")}>
            <span>▣</span>
            <div>
              <small>{isWalletConnected ? "CONNECTED" : "PROFILE"}</small>
              <strong>{isWalletConnected ? shortAddress(address) : "No wallet"}</strong>
            </div>
            <b>{profile.avatar}</b>
          </button>
          <nav className="side-nav">
            {navItems.map((item) => (
              <button key={item.route} className={route === item.route ? "active" : ""} onClick={() => navigate(item.route)}>
                <span>{item.icon}</span>
                {item.label}
                {route === item.route ? <em>›</em> : null}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => navigate("/profile")}><span>⚙</span> Profile Setup</button>
          <button className="danger" onClick={() => void disconnect()} disabled={!isWalletConnected}>
            <span>↪</span> Disconnect
          </button>
        </div>
      </aside>
      <section className="arena-main">
        <header className="topbar">
          <div className="live-pill">
            <i>⌁</i> {socketState.toUpperCase()} • {backendLabel}
          </div>
          <div className="top-actions">
            <div className="wallet-select">
              <span className={isWalletConnected ? "connected" : ""} />
              <select
                disabled={status === "connecting" || isWalletConnected}
                onChange={(event) => event.target.value && void connect(event.target.value)}
                value=""
              >
                <option value="">
                  {isWalletConnected ? shortAddress(address) : status === "connecting" ? "Connecting..." : "Connect wallet"}
                </option>
                {connectors.map((connector) => (
                  <option key={connector.id} value={connector.id}>
                    {connector.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="pool-pill">◎ Entry {FIXED_ENTRY_FEE_SOL} SOL</div>
            <button className="avatar" onClick={() => navigate("/profile")}>
              {profile.avatar}
            </button>
          </div>
        </header>
        {children}
        <div className={`notice ${apiError ? "error" : ""}`}>{apiError || notice}</div>
      </section>
    </main>
  );
}

function DashboardPage({
  lobbies,
  navigate,
  profile,
}: {
  lobbies: Lobby[];
  navigate: (route: AppRoute) => void;
  profile: Profile;
}) {
  const openLobbies = lobbies.filter((lobby) => lobby.status === "waiting" || lobby.status === "playing").length;

  return (
    <div className="content dashboard">
      <section className="welcome">
        <div>
          <h2>
            Welcome back, <span>{profile.username}</span>
          </h2>
          <p>Realtime quiz arena • fixed ◎ {FIXED_ENTRY_FEE_SOL} SOL entry</p>
        </div>
        <div className="welcome-actions">
          <button className="gradient-button" onClick={() => navigate("/matchmake")}>▷ QUICK PLAY</button>
          <button className="outline-button" onClick={() => navigate("/lobby")}>FIND LOBBIES</button>
          <button className="outline-button" onClick={() => navigate("/settlement")}>CLAIM PRIZE</button>
        </div>
      </section>
      <section className="metric-grid">
        <article className="metric-card purple">
          <div className="metric-icon">♕</div>
          <div className="metric-value">{openLobbies}</div>
          <p>Live from backend</p>
          <span>Open Lobbies</span>
        </article>
        <article className="metric-card cyan">
          <div className="metric-icon">◎</div>
          <div className="metric-value">{FIXED_ENTRY_FEE_SOL}</div>
          <p>Fixed arena stake</p>
          <span>Entry Fee</span>
        </article>
        <article className="metric-card gold">
          <div className="metric-icon">↺</div>
          <div className="metric-value">9</div>
          <p>Quiz categories</p>
          <span>Topic Pool</span>
        </article>
        <article className="metric-card green">
          <div className="metric-icon">◈</div>
          <div className="metric-value">Docs</div>
          <p>Solana onboarding</p>
          <span>Learn</span>
        </article>
      </section>
    </div>
  );
}

function MatchmakingPage({
  createLobby,
  quickMatch,
  selectedMode,
  setSelectedMode,
}: {
  createLobby: () => Promise<void>;
  quickMatch: () => Promise<void>;
  selectedMode: GameMode;
  setSelectedMode: (value: GameMode) => void;
}) {
  const modes: { mode: GameMode; icon: string; copy: string }[] = [
    { mode: "Speed", icon: "ϟ", copy: "Fastest answer wins" },
    { mode: "Classic", icon: "♕", copy: "Most correct wins" },
    { mode: "Survival", icon: "☊", copy: "Eliminate on wrong" },
  ];

  return (
    <div className="content narrow">
      <section className="page-title">
        <h2>MATCHMAKING</h2>
        <p>Pick a mode — topic and entry fee are fixed by the arena</p>
      </section>
      <div className="segmented">
        <button className="active" onClick={() => void quickMatch()}>ϟ QUICK MATCH</button>
        <button onClick={() => void createLobby()}>＋ CREATE LOBBY</button>
      </div>
      <section className="config-panel">
        <label>GAME MODE</label>
        <div className="mode-grid">
          {modes.map((item) => (
            <button
              className={`mode ${selectedMode === item.mode ? "active" : ""} ${item.mode === "Survival" ? "danger-mode" : ""}`}
              key={item.mode}
              onClick={() => setSelectedMode(item.mode)}
            >
              <span>{item.icon}</span>
              <strong>{item.mode.toUpperCase()}</strong>
              <small>{item.copy}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="config-panel arena-rules">
        <label>ARENA RULES</label>
        <div className="rules-grid">
          <article className="rule-card">
            <small>ENTRY FEE</small>
            <strong>◎ {FIXED_ENTRY_FEE_SOL} SOL</strong>
            <p>Fixed for every match. On-chain escrow comes with the smart contract.</p>
          </article>
          <article className="rule-card">
            <small>QUIZ TOPIC</small>
            <strong>ASSIGNED AT START</strong>
            <p>The arena picks one category when your lobby opens.</p>
          </article>
        </div>
        <div className="chip-row read-only">
          {GAME_TOPICS.map((topic) => (
            <span className="topic-chip" key={topic}>
              {topic}
            </span>
          ))}
        </div>
      </section>
      <button className="gradient-button launch-match" onClick={() => void createLobby()}>
        CREATE LOBBY
      </button>
    </div>
  );
}

function LobbiesPage({
  address,
  cancelLobby,
  joinLobby,
  lobbies,
  refreshLobbies,
}: {
  address?: string;
  cancelLobby: (lobbyId?: string) => Promise<void>;
  joinLobby: (lobbyId: string) => Promise<void>;
  lobbies: Lobby[];
  refreshLobbies: () => void;
}) {
  const activeLobbies = lobbies.filter((lobby) => lobby.status === "waiting" || lobby.status === "playing");
  const waitingCount = activeLobbies.filter((lobby) => lobby.status === "waiting").length;

  return (
    <div className="content lobbies-page">
      <section className="lobby-head">
        <div>
          <h2>LIVE LOBBIES</h2>
          <p>
            <span />
            {activeLobbies.length} ACTIVE • {waitingCount} OPEN TO JOIN
          </p>
        </div>
        <button className="refresh" onClick={() => void refreshLobbies()}>
          ⟳ Refresh
        </button>
      </section>
      {activeLobbies.length ? (
        <section className="lobby-grid">
          {activeLobbies.map((lobby) => (
            <LobbyCard address={address} cancelLobby={cancelLobby} joinLobby={joinLobby} lobby={lobby} key={lobby.lobbyId} />
          ))}
        </section>
      ) : (
        <EmptyState title="No active lobbies yet" copy="Create one from Matchmaking and it will appear here instantly." />
      )}
    </div>
  );
}

function LobbyCard({
  address,
  cancelLobby,
  joinLobby,
  lobby,
}: {
  address?: string;
  cancelLobby: (lobbyId?: string) => Promise<void>;
  joinLobby: (lobbyId: string) => Promise<void>;
  lobby: Lobby;
}) {
  const filled = lobby.players.length;
  const dots = Array.from({ length: Math.max(lobby.maxPlayers, 4) }, (_, index) => index < filled);
  const isFull = filled >= lobby.maxPlayers || lobby.status !== "waiting";
  const isHost = Boolean(address && lobby.host === address);

  return (
    <article className={`lobby-card ${lobby.status === "playing" ? "starting" : lobby.status}`}>
      <div className="lobby-card-top">
        <div className="host-avatar">👨‍🚀</div>
        <div>
          <h3>
            {lobby.topic} Championship <span>◎</span>
          </h3>
          <p>
            Hosted by <b>{shortAddress(lobby.host)}</b>
          </p>
        </div>
        <em className={`status ${lobby.status === "playing" ? "starting" : lobby.status}`}>
          <i />
          {lobby.status.toUpperCase()}
        </em>
      </div>
      <div className="lobby-tags">
        <span>{lobby.topic}</span>
        <span className={(lobby.mode || "Speed").toLowerCase()}>{(lobby.mode || "Speed").toUpperCase()}</span>
      </div>
      <div className="lobby-meta">
        <span>
          ♙ {filled}/{lobby.maxPlayers}
        </span>
        <div className="dots">
          {dots.map((item, index) => (
            <i className={item ? "filled" : ""} key={index} />
          ))}
        </div>
        <span className="gold">♕ ◎{lamportsToSol(lobby.entryFeeLamports)}</span>
        <span className="cyan">◷ {Math.round(lobby.questionTimeMs / 1000)}s</span>
        <strong>◎{lamportsToSol(lobby.entryFeeLamports)}/entry</strong>
        <button className={isFull ? "full" : ""} onClick={() => !isFull && void joinLobby(lobby.lobbyId)}>
          {isFull ? lobby.status.toUpperCase() : "JOIN"}
        </button>
        {isHost && lobby.status === "waiting" ? (
          <button className="full" onClick={() => void cancelLobby(lobby.lobbyId)}>
            CANCEL
          </button>
        ) : null}
      </div>
    </article>
  );
}

function GamePage({
  activeLobby,
  activeQuestion,
  address,
  cancelLobby,
  lastAnswer,
  matchWinner,
  onClaimPrize,
  playerScore,
  remainingMs,
  scores,
  submitAnswer,
  timerPct,
}: {
  activeLobby: Lobby | null;
  activeQuestion: QuestionEvent | null;
  address?: string;
  cancelLobby: (lobbyId?: string) => Promise<void>;
  lastAnswer: { correct: boolean; points: number } | null;
  matchWinner: string;
  onClaimPrize: () => void;
  playerScore: number;
  remainingMs: number;
  scores: Score[];
  submitAnswer: (answerIdx: number) => void;
  timerPct: number;
}) {
  if (!activeLobby) {
    return (
      <div className="content">
        <EmptyState title="No active lobby" copy="Create or join a lobby to start playing." />
      </div>
    );
  }

  if (matchWinner) {
    const won = matchWinner === address;
    return (
      <div className="content narrow">
        <section className="result-panel">
          <h2>MATCH COMPLETE</h2>
          <p>
            Winner: <b>{won ? "You" : shortAddress(matchWinner)}</b>
          </p>
          {scores.map((score) => (
            <div className="score-row" key={score.player}>
              <span>{score.player === address ? "You" : shortAddress(score.player)}</span>
              <strong>{score.score}</strong>
            </div>
          ))}
          {won ? (
            <button className="gradient-button launch-match" onClick={onClaimPrize}>
              CLAIM PRIZE
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  if (!activeQuestion) {
    return (
      <div className="content narrow">
        <section className="game-room">
          <div>
            <h2>{activeLobby.topic} Lobby</h2>
            <p>{activeLobby.status === "waiting" ? "Waiting for enough players to start" : "Match starting..."}</p>
          </div>
          <div className="room-stats">
            <span>
              {activeLobby.players.length}/{activeLobby.maxPlayers} players
            </span>
            <span>{activeLobby.mode || "Speed"}</span>
            <span>◎{lamportsToSol(activeLobby.entryFeeLamports)} entry</span>
          </div>
          <div className="player-list">
            {activeLobby.players.map((player) => (
              <div key={player.player}>
                <span>{player.bot ? "🤖" : "👨‍🚀"}</span>
                <strong>{player.player === address ? "You" : shortAddress(player.player)}</strong>
              </div>
            ))}
          </div>
          {activeLobby.status === "waiting" && activeLobby.host === address ? (
            <button className="outline-button" onClick={() => void cancelLobby(activeLobby.lobbyId)}>
              CANCEL & REFUND
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="content narrow">
      <section className="quiz-panel">
        <div className="quiz-head">
          <div>
            <h2>{activeLobby.topic}</h2>
            <p>
              Question {activeQuestion.index + 1} of {activeLobby.questionCount}
            </p>
          </div>
          <strong>{Math.ceil(remainingMs / 1000)}s</strong>
        </div>
        <div className="timer-track">
          <span style={{ width: `${timerPct}%` }} />
        </div>
        <h3>{activeQuestion.text}</h3>
        <div className="answer-grid">
          {activeQuestion.choices.map((choice, index) => (
            <button key={choice} onClick={() => submitAnswer(index)} disabled={Boolean(lastAnswer)}>
              <span>{String.fromCharCode(65 + index)}</span>
              {choice}
            </button>
          ))}
        </div>
        <div className="game-footer">
          <span>Your score: {playerScore}</span>
          {lastAnswer ? (
            <b className={lastAnswer.correct ? "correct" : "wrong"}>
              {lastAnswer.correct ? `Correct +${lastAnswer.points}` : "Wrong answer"}
            </b>
          ) : (
            <b>Choose fast</b>
          )}
        </div>
      </section>
    </div>
  );
}

function ProfilePage({
  address,
  profile,
  saveProfile,
}: {
  address?: string;
  profile: Profile;
  saveProfile: (profile: Profile) => Promise<void>;
}) {
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);

  return (
    <div className="content narrow">
      <section className="profile-panel">
        <div className="page-title">
          <h2>PROFILE</h2>
          <p>{address ? shortAddress(address) : "Connect a wallet to save your profile"}</p>
        </div>
        <label>AVATAR</label>
        <div className="avatar-picker">
          {avatars.map((avatar) => (
            <button className={draft.avatar === avatar ? "active" : ""} key={avatar} onClick={() => setDraft({ ...draft, avatar })}>
              {avatar}
            </button>
          ))}
        </div>
        <label>USERNAME</label>
        <input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
        <label>BIO</label>
        <textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} />
        <label>ARENA TOPICS</label>
        <div className="chip-row read-only">
          {GAME_TOPICS.map((topic) => (
            <span className="topic-chip" key={topic}>
              {topic}
            </span>
          ))}
        </div>
        <p className="field-note">Quiz topics are assigned by the arena at match start — not chosen by players.</p>
        <button className="gradient-button launch-match" onClick={() => void saveProfile({ ...draft, favoriteTopic: profile.favoriteTopic })}>
          SAVE PROFILE
        </button>
      </section>
    </div>
  );
}

function DocsPage({ navigate }: { navigate: (route: AppRoute) => void }) {
  const sections = [
    { title: "New to Solana?", badge: "Optional but recommended", body: "You can play without being a Solana expert, but knowing wallets, SOL, and signatures will make every match smoother." },
    { title: "What is Solana?", body: "Solana is a fast blockchain where programs run on-chain and wallets sign transactions. SOL is the native currency. Our arena uses devnet for testing." },
    { title: "Your wallet", body: "Install Phantom, Solflare, or another Solana wallet. Connect it in the top bar. Your wallet address is your player identity." },
    { title: "How the arena works", body: "Create or join a lobby, answer timed quiz questions over WebSocket, and win the pot. The backend signs the result; the smart contract will release SOL to the winner." },
    { title: "Claim flow", body: "After you win, open Claim Prize. You'll submit the signed result on-chain (once the program ships), then record the claim tx so history shows claimed." },
    { title: "Fixed arena rules", body: `Every match costs ◎ ${FIXED_ENTRY_FEE_SOL} SOL entry. Topics are picked from the arena pool when your lobby opens.` },
  ];

  return (
    <div className="content docs-page">
      <section className="page-title docs-hero">
        <div>
          <h2>PLAYER DOCS</h2>
          <p>Learn Solana basics and how Sol Quiz Arena works</p>
        </div>
        <span className="docs-badge">Optional but recommended</span>
      </section>
      <section className="docs-grid">
        {sections.map((section) => (
          <article className="doc-card" key={section.title}>
            <div className="doc-card-head">
              <h3>{section.title}</h3>
              {section.badge ? <em>{section.badge}</em> : null}
            </div>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
      <div className="docs-actions">
        <button className="gradient-button" onClick={() => navigate("/matchmake")}>
          ▷ START PLAYING
        </button>
        <button className="outline-button" onClick={() => navigate("/lobby")}>
          VIEW LIVE LOBBIES
        </button>
      </div>
    </div>
  );
}

function EmptyState({ copy, title }: { copy: string; title: string }) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <p>{copy}</p>
    </section>
  );
}
