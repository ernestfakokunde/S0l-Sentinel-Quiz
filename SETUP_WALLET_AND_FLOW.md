# Solana Quiz App - Wallet + Flow Setup Guide

This file is a practical guide for the wallet connection, client wiring, on-chain program, and off-chain game server. It is written for first-time fullstack Solana work.

## 1) Wallet Connection (Frontend)

### Goal
Connect any wallet that supports Wallet Standard, then send transactions from the UI.

### What we already have
- `@solana/client` and `@solana/react-hooks` are installed.
- `src/providers.tsx` sets up a Solana client and wraps the app.
- `src/App.tsx` shows the wallet buttons.

### What happens
1. The app loads a Solana client with `autoDiscover()`.
2. The wallet buttons appear from `useWalletConnection()`.
3. When a user connects, the wallet account and status update.
4. We later send transactions with `useSendTransaction()`.

### Next wiring
- When you are ready, we will add on-chain instructions in the UI:
  - Create lobby
  - Join lobby
  - Start match
  - Settle match

## 2) On-Chain Program (Anchor)

### Goal
Keep only the critical money and match finalization on-chain.

### Key accounts (planned)
- Lobby PDA: settings, player count, status.
- Match PDA: who played, match status, timestamps.
- Escrow PDA: holds entry fees and pays winners.

### Core instructions (planned)
- `create_lobby(entry_fee, max_players, topic, privacy)`
- `join_lobby()`
- `start_match()`
- `settle_match(winner, server_signature, score_hash)`

### Why this is safe
- Funds are escrowed on-chain.
- The server only signs results, it cannot move funds by itself.
- The program verifies the server signature before payout.

## 3) Off-Chain Game Server

### Goal
Handle realtime gameplay and scoring (fast), then submit the result on-chain.

### Stack choice
- Express + ws (simple and familiar).

### What the server does
- Runs matchmaking and lobby routing.
- Streams questions and timers over WebSocket.
- Scores answers and signs the final match result.
- Writes match history to Postgres.

### What the server does NOT do
- It never holds user funds.
- It cannot pay itself from escrow.

## 4) Database (Postgres via Neon)

### Goal
Store match history and lobby snapshots for the history page.

### What we will store
- Player addresses
- Match ID, winner, scores, timestamps
- Entry fees and payouts

## 5) End-to-End Flow (Planned)

1. Player connects wallet.
2. Player creates a lobby or matchmaking request.
3. On-chain: entry fee escrowed when lobby/match is created.
4. Off-chain: server starts the live quiz over WebSocket.
5. Off-chain: server scores and signs the final result.
6. On-chain: client submits the signed result for payout.
7. Off-chain: server saves history to Postgres.

## 6) How we will build it (Step-by-step)

1. Lock down the on-chain account schema.
2. Implement Anchor instructions for lobby/match/escrow.
3. Regenerate the TS client via Codama.
4. Add a small server (Express + ws).
5. Add Prisma models for history.
6. Wire UI buttons to the on-chain instructions.
7. Pipe realtime game events through WebSocket.

## 7) Notes for your first Solana fullstack build

- Keep real-time actions off-chain for speed.
- Keep money and final settlement on-chain for safety.
- Start with devnet to avoid real costs.
- Always simulate transactions before sending.

## 8) PDA basics (simple mental model)

- A PDA (Program Derived Address) is NOT a wallet you control.
- It is a deterministic address derived from seeds + the program ID.
- The program can sign for it using seeds, but no private key exists.
- We use PDAs for lobbies, matches, and escrow because they are predictable and safe.

If you want, the next step can be the Anchor account schema draft or the server API draft.