import { SolanaProvider, useWalletConnection } from "@solana/react-hooks";
import { PropsWithChildren } from "react";
import { autoDiscover, createClient } from "@solana/client";
import { ArenaProvider } from "./context/ArenaContext";

const endpoint = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";

const client = createClient({
  endpoint,
  walletConnectors: autoDiscover(),
});

function ArenaBridge({ children }: PropsWithChildren) {
  const { wallet } = useWalletConnection();
  const walletAddress = wallet?.account.address.toString();
  return <ArenaProvider walletAddress={walletAddress}>{children}</ArenaProvider>;
}

export function Providers({ children }: PropsWithChildren) {
  return (
    <SolanaProvider client={client}>
      <ArenaBridge>{children}</ArenaBridge>
    </SolanaProvider>
  );
}
