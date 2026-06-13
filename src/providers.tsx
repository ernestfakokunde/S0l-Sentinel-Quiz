import { SolanaProvider } from "@solana/react-hooks";
import { PropsWithChildren } from "react";
import { autoDiscover, createClient } from "@solana/client";

const endpoint = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";

const client = createClient({
  endpoint,
  walletConnectors: autoDiscover(),
});

export function Providers({ children }: PropsWithChildren) {
  return <SolanaProvider client={client}>{children}</SolanaProvider>;
}
