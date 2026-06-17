import type { ConnectionState } from "../types";
import { lamportsToSol } from "../utils";

type FindMatchPageProps = {
  entryFeeLamports: string;
  entryFeeSol: string;
  isWalletConnected: boolean;
  maxPlayers: number;
  questionCount: number;
  questionTimeMs: number;
  socketState: ConnectionState;
  topic: string;
  txSignature: string;
  findMatch: () => void;
  setEntryFeeSol: (value: string) => void;
  setMaxPlayers: (value: number) => void;
  setQuestionCount: (value: number) => void;
  setQuestionTimeMs: (value: number) => void;
  setTopic: (value: string) => void;
  setTxSignature: (value: string) => void;
};

const inputClass = "h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100 outline-none transition focus:border-violet-500";
const labelClass = "grid gap-2 text-[11px] font-extrabold uppercase text-zinc-400";

export function FindMatchPage({
  entryFeeLamports,
  entryFeeSol,
  isWalletConnected,
  maxPlayers,
  questionCount,
  questionTimeMs,
  socketState,
  topic,
  txSignature,
  findMatch,
  setEntryFeeSol,
  setMaxPlayers,
  setQuestionCount,
  setQuestionTimeMs,
  setTopic,
  setTxSignature,
}: FindMatchPageProps) {
  const canFind = isWalletConnected && socketState === "online";

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.55fr)]">
      <div className="overflow-hidden rounded-lg border border-violet-900/50 bg-zinc-950">
        <div className="border-b border-violet-900/40 p-5">
          <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">Find Match</p>
          <h2 className="text-2xl font-extrabold text-white">Queue for a public battle</h2>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <label className={labelClass}>
            Topic
            <input className={inputClass} value={topic} onChange={(event) => setTopic(event.target.value)} />
          </label>
          <label className={labelClass}>
            Entry fee SOL
            <input className={inputClass} value={entryFeeSol} onChange={(event) => setEntryFeeSol(event.target.value)} inputMode="decimal" />
          </label>
          <label className={labelClass}>
            Players
            <input className={inputClass} type="number" min={2} max={8} value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))} />
          </label>
          <label className={labelClass}>
            Questions
            <input className={inputClass} type="number" min={1} max={12} value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} />
          </label>
          <label className={labelClass}>
            Round seconds
            <input className={inputClass} type="number" min={3} max={45} value={Math.round(questionTimeMs / 1000)} onChange={(event) => setQuestionTimeMs(Number(event.target.value) * 1000)} />
          </label>
          <label className={labelClass}>
            Join/deposit tx signature
            <input className={inputClass} value={txSignature} onChange={(event) => setTxSignature(event.target.value)} placeholder="Optional while verification is off" />
          </label>
        </div>
      </div>

      <aside className="grid gap-4 rounded-lg border border-violet-900/50 bg-zinc-950 p-5">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">Queue Card</p>
          <h2 className="text-2xl font-extrabold text-white">Ready check</h2>
        </div>

        <div className="grid gap-3">
          <div className="rounded-lg border border-violet-900/50 bg-zinc-900 p-4">
            <span className="mb-1 block text-[11px] font-extrabold uppercase text-zinc-400">Projected pot</span>
            <strong className="text-3xl font-extrabold text-white">{lamportsToSol(Number(entryFeeLamports) * maxPlayers)} SOL</strong>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-violet-900/50 bg-zinc-900 p-3">
              <span className="mb-1 block text-[11px] font-extrabold uppercase text-zinc-400">Socket</span>
              <strong className={socketState === "online" ? "text-emerald-400" : "text-amber-300"}>{socketState}</strong>
            </div>
            <div className="rounded-lg border border-violet-900/50 bg-zinc-900 p-3">
              <span className="mb-1 block text-[11px] font-extrabold uppercase text-zinc-400">Wallet</span>
              <strong className={isWalletConnected ? "text-emerald-400" : "text-amber-300"}>{isWalletConnected ? "ready" : "required"}</strong>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="min-h-14 rounded-lg border border-violet-500 bg-violet-600 px-5 text-base font-extrabold text-white transition hover:scale-[1.02] hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={findMatch}
          disabled={!canFind}
        >
          Find Match
        </button>
      </aside>
    </section>
  );
}
