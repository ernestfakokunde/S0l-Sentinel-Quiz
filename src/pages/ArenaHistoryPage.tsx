import type { HistoryMatch } from "../types";
import { formatDate, lamportsToSol, shortAddress } from "../utils";

type ArenaHistoryPageProps = {
  history: HistoryMatch[];
  address?: string;
  onRefresh: () => void | Promise<void>;
  onOpenClaim: (matchId: string) => void | Promise<void>;
};

export function ArenaHistoryPage({ history, address, onRefresh, onOpenClaim }: ArenaHistoryPageProps) {
  return (
    <div className="content narrow">
      <section className="history-panel">
        <div className="lobby-head">
          <div>
            <h2>MATCH HISTORY</h2>
            <p>{history.length} completed matches</p>
          </div>
          <button className="refresh" onClick={() => void onRefresh()}>⟳ Refresh</button>
        </div>

        {history.length ? (
          <div className="history-list">
            {history.map((match) => {
              const isWinner = address === match.winner;
              const claimable = isWinner && match.claimStatus !== "claimed";
              return (
                <article className="history-row" key={match.matchId}>
                  <div>
                    <strong>{isWinner ? "You won" : `Lost to ${shortAddress(match.winner)}`}</strong>
                    <p>
                      ◎ {lamportsToSol(match.prizeLamports)} prize • {match.players} players • {formatDate(match.finishedAt)}
                    </p>
                    <em className={match.claimStatus === "claimed" ? "claimed" : "pending"}>
                      {match.claimStatus || "unclaimed"}
                    </em>
                  </div>
                  {claimable ? (
                    <button className="gradient-button" onClick={() => void onOpenClaim(match.matchId)}>CLAIM</button>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No match history yet" copy="Finished matches appear here once the backend persists them to Postgres." />
        )}
      </section>
    </div>
  );
}

function EmptyState({ copy, title }: { copy: string; title: string }) {
  return <section className="empty-state"><h2>{title}</h2><p>{copy}</p></section>;
}
