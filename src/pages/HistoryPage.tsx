import type { HistoryMatch } from "../types";
import { formatDate, lamportsToSol, shortAddress } from "../utils";

type HistoryPageProps = {
  history: HistoryMatch[];
};

export function HistoryPage({ history }: HistoryPageProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-violet-900/50 bg-zinc-950">
      <div className="border-b border-violet-900/40 p-5">
        <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">History</p>
        <h2 className="text-2xl font-extrabold text-white">Recent winners</h2>
      </div>
      <div className="grid gap-3 p-4">
        {history.length === 0 ? <p className="rounded-lg border border-dashed border-violet-800 p-4 text-sm text-zinc-400">No completed matches yet.</p> : null}
        {history.map((match) => (
          <article key={match.matchId} className="rounded-lg border border-violet-900/50 bg-zinc-900 p-3">
            <div className="flex items-center justify-between gap-3">
              <strong className="truncate text-white">{shortAddress(match.winner)}</strong>
              <span className="shrink-0 text-xs text-zinc-400">{formatDate(match.finishedAt)}</span>
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              {lamportsToSol(match.prizeLamports)} SOL | {match.players} players | {match.claimStatus || "unclaimed"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
