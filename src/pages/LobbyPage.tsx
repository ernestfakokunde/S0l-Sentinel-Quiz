import type { Lobby } from "../types";
import { lamportsToSol, shortAddress } from "../utils";

type LobbyPageProps = {
  isWalletConnected: boolean;
  lobbies: Lobby[];
  joinLobby: (lobbyId: string) => void;
};

export function LobbyPage({ isWalletConnected, lobbies, joinLobby }: LobbyPageProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-violet-900/50 bg-zinc-950">
      <div className="flex items-start justify-between gap-3 border-b border-violet-900/40 bg-zinc-950 p-5">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">Lobby</p>
          <h2 className="text-2xl font-extrabold text-white">Open lobbies</h2>
        </div>
        <span className="min-w-12 rounded-full border border-violet-700/70 bg-violet-950/60 px-3 py-1 text-center text-sm font-extrabold text-violet-200">
          {lobbies.length}
        </span>
      </div>
      <div className="grid gap-3 p-4">
        {lobbies.length === 0 ? <p className="rounded-lg border border-dashed border-violet-800 p-4 text-sm text-zinc-400">No lobbies yet. Create one from Matchmake.</p> : null}
        {lobbies.map((lobby) => (
          <article key={lobby.lobbyId} className="grid items-center gap-3 rounded-lg border border-violet-900/50 bg-zinc-900 p-3 sm:grid-cols-[minmax(0,1fr)_auto_76px]">
            <div className="min-w-0">
              <strong className="block truncate text-white">{lobby.topic}</strong>
              <span className="mt-1 block truncate text-xs text-zinc-400">
                {shortAddress(lobby.lobbyId)} | {lamportsToSol(lobby.entryFeeLamports)} SOL
              </span>
            </div>
            <div className="text-left text-xs text-zinc-400 sm:min-w-20 sm:text-right">
              <span className="block">{lobby.players.length}/{lobby.maxPlayers}</span>
              <span className="block">{lobby.status}</span>
            </div>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-violet-900/70 bg-zinc-950 px-3 text-sm font-bold text-zinc-100 transition hover:-translate-y-0.5 hover:border-violet-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => joinLobby(lobby.lobbyId)}
              disabled={!isWalletConnected || lobby.status !== "waiting"}
            >
              Join
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
