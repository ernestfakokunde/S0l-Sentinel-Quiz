import type { ConnectionState, HistoryMatch, Lobby } from "../types";
import { formatDate, lamportsToSol, shortAddress } from "../utils";

type HomePageProps = {
  history: HistoryMatch[];
  isWalletConnected: boolean;
  lobbies: Lobby[];
  socketState: ConnectionState;
  openFindMatch: () => void;
  openLobby: () => void;
  openMatchmake: () => void;
};

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: "cyan" | "emerald" | "amber" }) {
  const accentClass = accent === "emerald" ? "text-emerald-300" : accent === "amber" ? "text-amber-300" : "text-cyan-300";

  return (
    <article className="rounded-lg border border-violet-900/50 bg-zinc-950 p-4">
      <span className="mb-2 block text-[11px] font-extrabold uppercase text-zinc-400">{label}</span>
      <strong className={`block truncate text-2xl font-extrabold ${accentClass}`}>{value}</strong>
    </article>
  );
}

export function HomePage({
  history,
  isWalletConnected,
  lobbies,
  socketState,
  openFindMatch,
  openLobby,
  openMatchmake,
}: HomePageProps) {
  const waitingLobbies = lobbies.filter((lobby) => lobby.status === "waiting");
  const latestMatch = history[0];

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="overflow-hidden rounded-lg border border-violet-900/50 bg-zinc-950">
        <div className="grid gap-5 border-b border-violet-900/40 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">Sentinel Quiz</p>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-white sm:text-5xl">Wallet-first quiz battles for SOL pools</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Create lobbies, queue into public matches, answer live questions, and record prize claims from one realtime arena.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:w-[340px]">
            <button
              type="button"
              className="min-h-12 rounded-lg border border-violet-500 bg-violet-600 px-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-violet-700"
              onClick={openFindMatch}
            >
              Find Match
            </button>
            <button
              type="button"
              className="min-h-12 rounded-lg border border-violet-900/70 bg-zinc-900 px-4 text-sm font-extrabold text-zinc-100 transition hover:-translate-y-0.5 hover:border-cyan-500 hover:bg-zinc-800"
              onClick={openMatchmake}
            >
              Create Lobby
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-3">
          <Metric label="Open lobbies" value={waitingLobbies.length} />
          <Metric label="Realtime" value={socketState} accent={socketState === "online" ? "emerald" : "amber"} />
          <Metric label="Wallet" value={isWalletConnected ? "ready" : "required"} accent={isWalletConnected ? "emerald" : "amber"} />
        </div>

        <div className="grid gap-4 p-4 pt-0 lg:grid-cols-2">
          <section className="overflow-hidden rounded-lg border border-violet-900/50 bg-zinc-900">
            <div className="flex items-center justify-between gap-3 border-b border-violet-900/40 p-4">
              <div>
                <p className="mb-1 text-[11px] font-extrabold uppercase text-violet-300">Queue</p>
                <h2 className="text-xl font-extrabold text-white">Waiting rooms</h2>
              </div>
              <button
                type="button"
                className="min-h-10 rounded-lg border border-violet-900/70 bg-zinc-950 px-3 text-sm font-bold text-zinc-100 transition hover:border-violet-500 hover:bg-zinc-800"
                onClick={openLobby}
              >
                View All
              </button>
            </div>
            <div className="grid gap-3 p-3">
              {waitingLobbies.length === 0 ? <p className="rounded-lg border border-dashed border-violet-800 p-4 text-sm text-zinc-400">No lobbies are waiting yet.</p> : null}
              {waitingLobbies.slice(0, 3).map((lobby) => (
                <article key={lobby.lobbyId} className="grid gap-2 rounded-lg border border-violet-900/50 bg-zinc-950 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate text-white">{lobby.topic}</strong>
                    <span className="shrink-0 text-xs font-bold text-cyan-300">{lobby.players.length}/{lobby.maxPlayers}</span>
                  </div>
                  <span className="text-xs text-zinc-400">{lamportsToSol(lobby.entryFeeLamports)} SOL entry | {shortAddress(lobby.lobbyId)}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-violet-900/50 bg-zinc-900">
            <div className="border-b border-violet-900/40 p-4">
              <p className="mb-1 text-[11px] font-extrabold uppercase text-violet-300">Settlement</p>
              <h2 className="text-xl font-extrabold text-white">Latest result</h2>
            </div>
            <div className="p-3">
              {latestMatch ? (
                <article className="rounded-lg border border-violet-900/50 bg-zinc-950 p-4">
                  <span className="text-[11px] font-extrabold uppercase text-zinc-400">Winner</span>
                  <strong className="mt-2 block truncate text-2xl font-extrabold text-white">{shortAddress(latestMatch.winner)}</strong>
                  <p className="mt-3 text-sm text-zinc-400">
                    {lamportsToSol(latestMatch.prizeLamports)} SOL | {latestMatch.players} players | {formatDate(latestMatch.finishedAt)}
                  </p>
                </article>
              ) : (
                <p className="rounded-lg border border-dashed border-violet-800 p-4 text-sm text-zinc-400">Completed matches will appear here.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <aside className="grid content-start gap-4 rounded-lg border border-violet-900/50 bg-zinc-950 p-5">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">Flow</p>
          <h2 className="text-2xl font-extrabold text-white">Arena pipeline</h2>
        </div>
        {["Connect wallet", "Queue or create", "Answer live", "Record claim"].map((label, index) => (
          <article key={label} className={`rounded-lg border p-4 ${index === 1 ? "border-cyan-500/70 bg-cyan-950/30" : "border-violet-900/50 bg-zinc-900"}`}>
            <span className="text-[11px] font-extrabold uppercase text-zinc-400">Step {index + 1}</span>
            <strong className="mt-2 block text-white">{label}</strong>
          </article>
        ))}
      </aside>
    </section>
  );
}
