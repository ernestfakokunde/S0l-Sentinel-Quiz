import type { Privacy } from "../types";
import { lamportsToSol } from "../utils";

type MatchmakePageProps = {
  entryFeeLamports: string;
  entryFeeSol: string;
  isWalletConnected: boolean;
  maxPlayers: number;
  privacy: Privacy;
  questionCount: number;
  questionTimeMs: number;
  topic: string;
  txSignature: string;
  createLobby: () => void | Promise<void>;
  refreshDashboard: () => void | Promise<void>;
  setEntryFeeSol: (value: string) => void;
  setMaxPlayers: (value: number) => void;
  setPrivacy: (value: Privacy) => void;
  setQuestionCount: (value: number) => void;
  setQuestionTimeMs: (value: number) => void;
  setTopic: (value: string) => void;
  setTxSignature: (value: string) => void;
};

const inputClass = "h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100 outline-none transition focus:border-violet-500";
const labelClass = "grid gap-2 text-[11px] font-extrabold uppercase text-zinc-400";
const buttonClass = "min-h-11 rounded-lg border border-violet-900/70 bg-zinc-900 px-4 font-bold text-zinc-100 transition hover:scale-[1.02] hover:-translate-y-0.5 hover:border-violet-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";

export function MatchmakePage({
  entryFeeLamports,
  entryFeeSol,
  isWalletConnected,
  maxPlayers,
  privacy,
  questionCount,
  questionTimeMs,
  topic,
  txSignature,
  createLobby,
  refreshDashboard,
  setEntryFeeSol,
  setMaxPlayers,
  setPrivacy,
  setQuestionCount,
  setQuestionTimeMs,
  setTopic,
  setTxSignature,
}: MatchmakePageProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-lg border border-violet-900/50 bg-zinc-950">
        <div className="flex items-start justify-between gap-3 border-b border-violet-900/40 bg-zinc-950 p-5">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">Create</p>
            <h2 className="text-2xl font-extrabold text-white">Build a lobby</h2>
          </div>
          <button type="button" className={buttonClass} onClick={() => void refreshDashboard()}>
            Refresh
          </button>
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
            Privacy
            <select className={inputClass} value={privacy} onChange={(event) => setPrivacy(event.target.value as Privacy)}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Join/deposit tx signature
            <input className={inputClass} value={txSignature} onChange={(event) => setTxSignature(event.target.value)} placeholder="Optional while verification is off" />
          </label>
        </div>
      </div>

      <aside className="grid content-between gap-5 rounded-lg border border-violet-900/50 bg-zinc-950 p-5">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">Lobby Preview</p>
          <h2 className="text-2xl font-extrabold text-white">{topic || "Untitled match"}</h2>
        </div>
        <div className="grid gap-3">
          <div className="rounded-lg border border-violet-700/70 bg-violet-950/60 p-4">
            <span className="mb-2 block text-[11px] font-extrabold uppercase text-violet-200">Projected pot</span>
            <strong className="block text-3xl font-extrabold text-white">{lamportsToSol(Number(entryFeeLamports) * maxPlayers)} SOL</strong>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-violet-900/50 bg-zinc-900 p-3">
              <span className="mb-1 block text-[11px] font-extrabold uppercase text-zinc-400">Players</span>
              <strong>{maxPlayers}</strong>
            </div>
            <div className="rounded-lg border border-violet-900/50 bg-zinc-900 p-3">
              <span className="mb-1 block text-[11px] font-extrabold uppercase text-zinc-400">Privacy</span>
              <strong>{privacy}</strong>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="min-h-14 rounded-lg border border-violet-500 bg-violet-600 px-5 text-base font-extrabold text-white transition hover:scale-[1.02] hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void createLobby()}
          disabled={!isWalletConnected}
        >
          Create Lobby
        </button>
      </aside>
    </section>
  );
}
