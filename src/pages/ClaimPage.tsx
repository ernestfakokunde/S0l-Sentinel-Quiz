import { FIXED_ENTRY_FEE_SOL } from "../gameConfig";
import type { MatchEnded } from "../types";
import { lamportsToSol, shortAddress } from "../utils";

type ClaimPageProps = {
  address?: string;
  claimTxSignature: string;
  claimSubmitting: boolean;
  matchEnded: MatchEnded | null;
  onClaimPrize: () => void | Promise<void>;
  onRecordClaim: () => void | Promise<void>;
  onClaimTxSignatureChange: (value: string) => void;
  onGoToMatchmake: () => void;
};

export function ClaimPage({
  address,
  claimTxSignature,
  claimSubmitting,
  matchEnded,
  onClaimPrize,
  onRecordClaim,
  onClaimTxSignatureChange,
  onGoToMatchmake,
}: ClaimPageProps) {
  const isWinner = Boolean(address && matchEnded && matchEnded.winner === address);

  if (!matchEnded) {
    return (
      <div className="content narrow">
        <section className="empty-state">
          <h2>No prize to claim</h2>
          <p>Win a match to receive a server-signed result here. The on-chain claim instruction will use that signature once the smart contract is deployed.</p>
          <button className="gradient-button launch-match" onClick={onGoToMatchmake}>PLAY A MATCH</button>
        </section>
      </div>
    );
  }

  return (
    <div className="content narrow">
      <section className="claim-panel">
        <div className="page-title">
          <h2>CLAIM PRIZE</h2>
          <p>{isWinner ? "You won this match. Submit the signed result on-chain to release the escrow." : "Match settlement details"}</p>
        </div>

        <div className="claim-grid">
          <article className="rule-card">
            <small>WINNER</small>
            <strong>{matchEnded.winner === address ? "You" : shortAddress(matchEnded.winner)}</strong>
          </article>
          <article className="rule-card">
            <small>PAYOUT</small>
            <strong>◎ {lamportsToSol(matchEnded.payoutLamports)} SOL</strong>
          </article>
          <article className="rule-card">
            <small>TOTAL POT</small>
            <strong>◎ {lamportsToSol(matchEnded.totalPotLamports)} SOL</strong>
          </article>
          <article className="rule-card">
            <small>TREASURY FEE</small>
            <strong>◎ {lamportsToSol(matchEnded.treasuryFeeLamports)} SOL</strong>
          </article>
        </div>

        <label>SIGNED RESULT (FOR ON-CHAIN CLAIM)</label>
        <textarea className="claim-payload" readOnly value={matchEnded.signedResult.canonical} />

        <article className="claim-step">
          <h3>Step 1 — On-chain claim (smart contract)</h3>
          <p>
            Entry fee is fixed at ◎ {FIXED_ENTRY_FEE_SOL} SOL per player. The winner submits this signed result to release the pot from escrow.
          </p>
          <button className="outline-button" disabled={!isWinner || claimSubmitting} onClick={() => void onClaimPrize()}>
            {claimSubmitting ? "SUBMITTING CLAIM..." : "SUBMIT ON-CHAIN CLAIM"}
          </button>
        </article>

        <article className="claim-step">
          <h3>Step 2 — Record claim tx</h3>
          <p>After your wallet confirms the on-chain claim, paste the transaction signature here so the arena can mark the prize as claimed.</p>
          <input
            value={claimTxSignature}
            onChange={(event) => onClaimTxSignatureChange(event.target.value)}
            placeholder="Claim transaction signature"
          />
          <button className="gradient-button launch-match" onClick={() => void onRecordClaim()}>
            RECORD CLAIM
          </button>
        </article>
      </section>
    </div>
  );
}
