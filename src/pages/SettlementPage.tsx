import type { MatchEnded } from "../types";
import { lamportsToSol, shortAddress } from "../utils";

type SettlementPageProps = {
  claimTxSignature: string;
  matchEnded: MatchEnded | null;
  recordClaim: () => void | Promise<void>;
  setClaimTxSignature: (value: string) => void;
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-violet-900/50 bg-zinc-900 p-3">
      <span className="mb-1 block text-[11px] font-extrabold uppercase text-zinc-400">{label}</span>
      <strong className="block truncate font-mono text-xs text-zinc-100">{value}</strong>
    </div>
  );
}

export function SettlementPage({ claimTxSignature, matchEnded, recordClaim, setClaimTxSignature }: SettlementPageProps) {
  return (
    <section className="mx-auto w-full max-w-3xl overflow-hidden rounded-lg border border-violet-900/50 bg-zinc-950">
      <div className="border-b border-violet-900/40 p-5">
        <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">Claim</p>
        <h2 className="text-2xl font-extrabold text-white">Prize settlement</h2>
      </div>
      {matchEnded ? (
        <div className="grid gap-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Winner" value={shortAddress(matchEnded.winner)} />
            <Detail label="Payout" value={`${lamportsToSol(matchEnded.payoutLamports)} SOL`} />
            <Detail label="Total pot" value={`${lamportsToSol(matchEnded.totalPotLamports)} SOL`} />
            <Detail label="Treasury fee" value={`${lamportsToSol(matchEnded.treasuryFeeLamports)} SOL`} />
          </div>
          <article className="rounded-lg border border-violet-900/50 bg-zinc-900 p-4">
            <p className="mb-3 text-xs font-extrabold uppercase text-violet-300">Signed result</p>
            <textarea
              className="min-h-36 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-6 text-zinc-100 outline-none focus:border-violet-500"
              readOnly
              value={matchEnded.signedResult.canonical}
            />
          </article>
          <article className="grid gap-3 rounded-lg border border-violet-900/50 bg-zinc-900 p-4">
            <p className="text-xs font-extrabold uppercase text-violet-300">Claim record</p>
            <input
              className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100 outline-none transition focus:border-violet-500"
              value={claimTxSignature}
              onChange={(event) => setClaimTxSignature(event.target.value)}
              placeholder="Claim tx signature after on-chain claim"
            />
            <button
              type="button"
              className="min-h-11 rounded-lg border border-violet-500 bg-violet-600 px-4 font-bold text-white transition hover:-translate-y-0.5 hover:bg-violet-700"
              onClick={() => void recordClaim()}
            >
              Record Claim
            </button>
          </article>
        </div>
      ) : (
        <p className="m-4 rounded-lg border border-dashed border-violet-800 p-4 text-sm text-zinc-400">The server-signed result appears here when a match ends.</p>
      )}
    </section>
  );
}
