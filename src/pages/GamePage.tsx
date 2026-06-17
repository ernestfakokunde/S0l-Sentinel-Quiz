import type { ConnectionState, Lobby, QuestionEvent, Score } from "../types";
import { lamportsToSol, shortAddress } from "../utils";

type GamePageProps = {
  activeLobby: Lobby | null;
  activeQuestion: QuestionEvent | null;
  address?: string;
  isWalletConnected: boolean;
  lastAnswer: { correct: boolean; points: number } | null;
  playerRank: number;
  remainingMs: number;
  scores: Score[];
  socketState: ConnectionState;
  timerPct: number;
  submitAnswer: (answerIdx: number) => void;
};

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" }) {
  return (
    <article className="min-w-0 rounded-lg border border-violet-900/50 bg-zinc-950 p-3">
      <span className="mb-1 block text-[11px] font-extrabold uppercase text-zinc-400">{label}</span>
      <strong className={`block truncate font-mono text-xs ${tone === "ok" ? "text-emerald-400" : tone === "warn" ? "text-amber-300" : "text-zinc-100"}`}>{value}</strong>
    </article>
  );
}

export function GamePage({
  activeLobby,
  activeQuestion,
  address,
  isWalletConnected,
  lastAnswer,
  playerRank,
  remainingMs,
  scores,
  socketState,
  timerPct,
  submitAnswer,
}: GamePageProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
      <section className="min-h-[540px] overflow-hidden rounded-lg border border-violet-900/50 bg-zinc-950">
        <div className="flex items-start justify-between gap-3 border-b border-violet-900/40 bg-zinc-950 p-5">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">Game</p>
            <h2 className="text-2xl font-extrabold text-white">{activeLobby ? activeLobby.topic : "Waiting for match"}</h2>
          </div>
          <span className="rounded-full border border-violet-700/70 bg-violet-950/60 px-3 py-1 text-sm font-extrabold text-violet-200">{activeLobby?.status || "idle"}</span>
        </div>

        {activeLobby ? (
          <div className="m-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Lobby" value={shortAddress(activeLobby.lobbyId)} />
            <Stat label="Entry" value={`${lamportsToSol(activeLobby.entryFeeLamports)} SOL`} />
            <Stat label="Players" value={`${activeLobby.players.length}/${activeLobby.maxPlayers}`} />
            <Stat label="Your rank" value={playerRank || "-"} />
          </div>
        ) : (
          <p className="m-4 rounded-lg border border-dashed border-violet-800 p-8 text-center text-sm text-zinc-400">Find or join a match to start playing.</p>
        )}

        {activeQuestion ? (
          <div className="m-4 rounded-lg border border-violet-900/50 bg-zinc-900 p-5">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-950">
              <span className="block h-full rounded-full bg-violet-600 transition-[width] duration-200" style={{ width: `${timerPct}%` }} />
            </div>
            <p className="mt-4 text-xs font-extrabold uppercase text-violet-300">Question {activeQuestion.index + 1}</p>
            <h3 className="mt-2 text-xl font-extrabold text-white">{activeQuestion.text}</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {activeQuestion.choices.map((choice, index) => (
                <button
                  key={choice}
                  type="button"
                  className="min-h-18 rounded-lg border border-violet-900/70 bg-zinc-950 p-3 text-left font-bold text-zinc-100 transition hover:-translate-y-0.5 hover:border-violet-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => submitAnswer(index)}
                  disabled={!isWalletConnected || remainingMs <= 0}
                >
                  {choice}
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm text-zinc-400">
              {lastAnswer ? `${lastAnswer.correct ? "Correct" : "Missed"} | +${lastAnswer.points} points` : `${Math.ceil(remainingMs / 1000)}s remaining`}
            </p>
          </div>
        ) : null}
      </section>

      <aside className="grid gap-4">
        <section className="overflow-hidden rounded-lg border border-violet-900/50 bg-zinc-950">
          <div className="border-b border-violet-900/40 p-5">
            <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">Scoreboard</p>
            <h2 className="text-2xl font-extrabold text-white">Players</h2>
          </div>
          <div className="grid gap-3 p-4">
            {scores.length === 0 ? <p className="rounded-lg border border-dashed border-violet-800 p-4 text-sm text-zinc-400">Scores appear once the match starts.</p> : null}
            {scores.map((score, index) => (
              <div key={score.player} className={`grid grid-cols-[42px_minmax(0,1fr)_62px] items-center gap-3 rounded-lg border p-3 ${score.player === address ? "border-violet-500 bg-violet-950/60" : "border-violet-900/50 bg-zinc-900"}`}>
                <span className="font-extrabold">#{index + 1}</span>
                <strong className="truncate">{shortAddress(score.player)}</strong>
                <em className="text-right font-extrabold not-italic text-violet-200">{score.score}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-violet-900/50 bg-zinc-950">
          <div className="border-b border-violet-900/40 p-5">
            <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">Wallet</p>
            <h2 className="text-2xl font-extrabold text-white">Player state</h2>
          </div>
          <div className="grid gap-3 p-4">
            <Stat label="Address" value={shortAddress(address)} />
            <Stat label="Status" value={isWalletConnected ? "connected" : "required"} />
            <Stat label="Socket" value={socketState} tone={socketState === "online" ? "ok" : "warn"} />
          </div>
        </section>
      </aside>
    </section>
  );
}
