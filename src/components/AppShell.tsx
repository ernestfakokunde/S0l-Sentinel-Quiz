import type { ReactNode } from "react";
import type { ConnectionState, RoutePath, RpcInfo } from "../types";
import { AppNav } from "./AppNav";

type AppShellProps = {
  apiUrl: string;
  children: ReactNode;
  notice: string;
  route: RoutePath;
  rpcInfo: RpcInfo | null;
  socketState: ConnectionState;
  solanaCluster: string;
  walletControls: ReactNode;
  navigate: (route: RoutePath) => void;
};

const pageTitles: Record<RoutePath, string> = {
  "/": "Home",
  "/find-match": "Find Match",
  "/matchmake": "Matchmake",
  "/lobby": "Lobby",
  "/game": "Game Room",
  "/settlement": "Claim Prize",
  "/history": "Match History",
};

export function AppShell({
  apiUrl,
  children,
  notice,
  route,
  rpcInfo,
  socketState,
  solanaCluster,
  walletControls,
  navigate,
}: AppShellProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1520px] bg-[#06050a] p-4 text-zinc-100 sm:p-6">
      <header className="grid items-end gap-4 py-2 pb-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase text-violet-300">Sentinel Quiz</p>
          <h2 className="text-3xl font-extrabold tracking-normal text-white">{pageTitles[route]}</h2>
        </div>
        {walletControls}
      </header>

      <AppNav route={route} navigate={navigate} />

      <section className="mb-4 grid gap-2 md:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr]" aria-label="System status">
        <article className="min-w-0 rounded-lg border border-violet-900/50 bg-zinc-950 p-3">
          <span className="mb-1 block text-[11px] font-extrabold uppercase text-zinc-400">Backend</span>
          <strong className="block truncate font-mono text-xs text-zinc-100">{apiUrl}</strong>
        </article>
        <article className="min-w-0 rounded-lg border border-violet-900/50 bg-zinc-950 p-3">
          <span className="mb-1 block text-[11px] font-extrabold uppercase text-zinc-400">Realtime</span>
          <strong className={`block truncate font-mono text-xs ${socketState === "online" ? "text-emerald-400" : "text-amber-300"}`}>
            {socketState}
          </strong>
        </article>
        <article className="min-w-0 rounded-lg border border-violet-900/50 bg-zinc-950 p-3">
          <span className="mb-1 block text-[11px] font-extrabold uppercase text-zinc-400">Cluster</span>
          <strong className="block truncate font-mono text-xs text-zinc-100">{rpcInfo?.cluster || solanaCluster}</strong>
        </article>
        <article className="min-w-0 rounded-lg border border-violet-900/50 bg-zinc-950 p-3">
          <span className="mb-1 block text-[11px] font-extrabold uppercase text-zinc-400">Join tx required</span>
          <strong className="block truncate font-mono text-xs text-zinc-100">
            {rpcInfo?.joinTxVerificationRequired ? "yes" : "no"}
          </strong>
        </article>
      </section>

      {children}

      <section className="fixed bottom-4 right-4 z-10 max-w-[min(520px,calc(100%-32px))] rounded-lg border border-violet-900/50 bg-zinc-950 px-4 py-3 text-sm text-zinc-400 shadow-2xl">
        {notice}
      </section>
    </main>
  );
}
