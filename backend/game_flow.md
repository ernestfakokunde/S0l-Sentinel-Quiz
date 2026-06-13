# Game Flow & Data Model (Backend)

This document explains how to store quiz questions, choose randomized question sets per match, prevent duplicate question usage across concurrent matches, and sign final results.

Table of contents
- Data model (Postgres / Prisma)
- Question selection strategies (randomness, uniqueness)
- Match lifecycle (lobby -> start -> play -> settle)
- WebSocket protocol (messages)
- Server signing and canonical result blob
- Security and anti-cheat notes


## Data model (what we added)
We added these Prisma models in `backend/prisma/schema.prisma`:
- `Question` — the canonical question bank; `choices` stored as JSON.
- `MatchQuestion` — a per-match snapshot of assigned questions (ensures immutability).
- `PlayerAnswer` — stores player answers for auditing and analytics.

Existing models `Match` and `LobbySnapshot` hold match summaries and lobby snapshots.


## Question content
Store each question like:
- `topic`: string (e.g., "Solana Basics")
- `text`: the question text
- `choices`: JSON array of strings
- `answerIdx`: integer index of the correct choice (0-based)
- `difficulty`: optional int

Example (SQL/JSONB):
```json
{
  "id": "...",
  "topic": "Solana Basics",
  "text": "What is a PDA in Solana?",
  "choices": ["Program Derived Address", "Private Deterministic Account", "Public Derived Account", "Program Data Address"],
  "answerIdx": 0
}
```


## Question selection strategies
We must ensure two guarantees:
1. Randomness — each match gets an unpredictable question set.
2. Uniqueness — two concurrent matches shouldn't serve the same questions if you want exclusivity.

Options:

A) Simple random sampling (no exclusivity)
- `SELECT id FROM "Question" WHERE topic=$1 ORDER BY random() LIMIT $N`
- Pros: Easy. Cons: Different matches may get same questions; acceptable for casual play.

B) Reserve-and-assign (exclusive questions per match)
- Within a DB transaction, pick random question ids and create `MatchQuestion` rows (with `matchId`) so subsequent selection excludes them.
- Implementation: SELECT FOR UPDATE SKIP LOCKED on a separate `QuestionPool` table or maintain a lightweight `available=true` flag.
- Pros: Guarantees exclusivity for live matches. Cons: Needs housekeeping (release questions if match cancelled) and adds DB writes.

C) Deterministic shuffle per match (reproducible but unique)
- Create a cryptographic seed per match (e.g., server `randomBytes(32)`), store its hash in the match record, then derive question indices by seeding an RNG and sampling without replacement from the question pool.
- Pros: Reproducible for audits, avoids DB locking if you sample by indexes. Cons: Requires careful indexing mapping between RNG output and rows.

Recommended for MVP: Use option A (simple random sampling) unless you require strict exclusivity. For competitive matches with reward, I recommend option B or C.


## Implementation: Reserve-and-assign (example)
This example uses Prisma + Postgres transaction to reserve questions exclusively for a match. It assumes moderate load and a reasonably sized question bank.

Pseudo-code (Node.js):

```js
// pick and reserve N questions for a match
async function assignQuestionsForMatch(matchId, topic, N) {
  return await prisma.$transaction(async (tx) => {
    // 1. pick candidate questions (random)
    const candidates = await tx.$queryRaw`
      SELECT id, text, choices
      FROM "Question"
      WHERE topic = ${topic}
      ORDER BY random()
      LIMIT ${N * 4}`; // pick a pool to avoid contention

    // 2. pick the first N that are not currently reserved (check MatchQuestion)
    const chosen = [];
    for (const q of candidates) {
      const already = await tx.matchQuestion.findFirst({ where: { questionId: q.id, matchId: { not: null } } });
      if (!already) chosen.push(q);
      if (chosen.length === N) break;
    }

    if (chosen.length < N) throw new Error('Not enough available questions');

    // 3. create MatchQuestion rows snapshotting text+choices
    for (let i = 0; i < chosen.length; i++) {
      await tx.matchQuestion.create({ data: {
        matchId,
        questionId: chosen[i].id,
        index: i,
        snapshot: { text: chosen[i].text, choices: chosen[i].choices }
      }});
    }

    return chosen.map((c) => c.id);
  });
}
```

Notes: the above is a straightforward approach. For high concurrency, replace the `findFirst` checks with a `FOR UPDATE SKIP LOCKED` pattern on a lightweight reservation table.


## Match lifecycle (server responsibilities)
1. `create_lobby` (client on-chain) or `POST /lobbies` (server off-chain to list)
2. Players join lobby. On-chain escrow happens when joining (client sends tx). Server watches lobby fill or `start_match` request.
3. Server receives start signal and creates a `Match` record in Postgres with `matchId` (UUID) and assigns questions via `assignQuestionsForMatch`.
4. Server opens a WebSocket room and notifies players `match_started` with question metadata (text + choices) — send question by question or batch.
5. Players submit answers via WS messages; server records `PlayerAnswer` rows and updates scores in memory.
6. When match ends (time elapsed or all questions), server computes winner(s) and produces a canonical result blob.
7. Server signs the canonical blob with its ED25519 key and returns the signature to the client (or the client requests a signed blob via authenticated endpoint).
8. Client submits `settle_match` on-chain with server signature; program verifies signature and transfers funds.
9. Server writes finalized `Match` row and `MatchQuestion` snapshots persist.


## WebSocket protocol (suggested messages)
From client -> server (JSON):
- `{type:'join', matchId, player}`
- `{type:'ready'}`
- `{type:'answer', questionIndex, answerIdx, ts}`
- `{type:'leave'}`

From server -> client:
- `{type:'match_started', matchId, questions: [{index, text, choices}]}`
- `{type:'question', index, text, choices, timeLimitMs}`
- `{type:'answer_ack', index}`
- `{type:'score_update', scores: [{player, score}]}`
- `{type:'match_ended', winner, signature, pubkey, resultHash}`

The `match_ended` message includes the server signature and public key so clients can submit on-chain.


## Canonical result blob & signing
Canonical blob should include all data needed to verify the result and prevent replay:
- `matchId` (UUID)
- `winner` (pubkey)
- `resultHash` (sha256 of the sequence of question ids + correct indices + timestamp + per-player scores)
- `finishedAt` timestamp
- `nonce` (optional incrementing server nonce)

Construct a canonical binary encoding (e.g., JSON with stable ordering then UTF-8 bytes) and compute `sha256`. Server signs the blob with ED25519.

Example signing in Node.js using `tweetnacl` and `tweetnacl-util`:

```js
const nacl = require('tweetnacl');
const { encodeUTF8, decodeBase64, encodeBase64 } = require('tweetnacl-util');

function signResult(secretKeyUint8Array, canonicalJsonString) {
  const msg = new TextEncoder().encode(canonicalJsonString);
  const sig = nacl.sign.detached(msg, secretKeyUint8Array);
  return Buffer.from(sig).toString('base64');
}
```

Verification on the program side uses Solana's ed25519 program or `ed25519` instruction verification via CPI.


## Security and anti-cheat
- Server must be trusted to run the game and sign correct results. Keep the signing key offline or in a secure environment for production.
- Include `matchId` and timestamp in the signed blob to prevent replay.
- To reduce fraud, server can publish the question set hash (`sha256` of question ids) to on-chain or a registry prior to starting (optional).
- Validate client-submitted answers rates and timing to detect bots.


## Putting it together: server responsibilities checklist
- [ ] Seed questions into `Question` table (admin UI or SQL seed).
- [ ] Implement `assignQuestionsForMatch()` with DB transaction.
- [ ] Serve `match_started` over WS and stream questions.
- [ ] Record `PlayerAnswer` rows and compute scores.
- [ ] Generate canonical result blob and sign with `tweetnacl`.
- [ ] Return signature to client for on-chain settlement.
- [ ] Persist `Match` final record and free any reserved questions.


## Example next steps (commands)
Install signing lib and regenerate Prisma client

```bash
cd backend
npm install tweetnacl tweetnacl-util
npx prisma generate
```

Run dev server

```bash
npm run dev
# or
node index.js
```


If you want, I can now:
- Add server-side code to `index.js` that implements `assignQuestionsForMatch` and the WS `start_match` handler, plus a dev signing endpoint that uses `tweetnacl`.
- Provide a SQL seed file and a small admin script to populate the `Question` table with Solana-themed questions.
Which one should I do next?"}