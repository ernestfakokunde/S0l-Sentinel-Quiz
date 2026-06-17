import { shortAddress } from "../utils";

type WalletConnector = {
  id: string;
  name: string;
};

type WalletPanelProps = {
  address?: string;
  connectors: readonly WalletConnector[];
  connect: (connectorId: string) => unknown;
  disconnect: () => unknown;
  isWalletConnected: boolean;
  status: string;
};

export function WalletPanel({
  address,
  connectors,
  connect,
  disconnect,
  isWalletConnected,
  status,
}: WalletPanelProps) {
  return (
    <div className="grid w-full min-w-0 grid-cols-1 items-center gap-2 rounded-lg border border-violet-900/50 bg-zinc-950/80 p-2 sm:min-w-[520px] sm:grid-cols-[minmax(145px,1fr)_minmax(160px,210px)_112px]">
      <div className="flex min-w-0 items-center gap-2 px-2 text-sm font-bold">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isWalletConnected ? "bg-emerald-400" : "bg-amber-300"}`} />
        <span className="truncate">{isWalletConnected ? shortAddress(address) : "Wallet required"}</span>
      </div>
      <select
        className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={status === "connecting" || isWalletConnected}
        onChange={(event) => event.target.value && void connect(event.target.value)}
        value=""
      >
        <option value="">{status === "connecting" ? "Connecting..." : "Connect wallet"}</option>
        {connectors.map((connector) => (
          <option key={connector.id} value={connector.id}>
            {connector.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="min-h-11 rounded-lg border border-violet-900/70 bg-zinc-900 px-3 text-sm font-bold text-zinc-100 transition hover:-translate-y-0.5 hover:border-violet-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => void disconnect()}
        disabled={!isWalletConnected}
      >
        Disconnect
      </button>
    </div>
  );
}
