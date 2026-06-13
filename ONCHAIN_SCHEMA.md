# On-chain Schema for Sol Quiz App

This document defines the PDAs, seeds, account fields, and Anchor instruction prototypes for the Vault/Quiz program. It is an early design that balances simplicity and safety.

## Goals & constraints
- Keep money handling minimal and auditable on-chain.
- Keep real-time logic off-chain.
- Allow a server-signed final result to be settled on-chain.
- Keep account sizes small to reduce rent.

## PDAs and purpose

1. Lobby PDA
- Seeds: `[b"lobby", host_pubkey, &lobby_id_bytes]`
- Purpose: store lobby settings (entry_fee, max_players, topic, privacy), current player count, list of player pubkeys (optional limited-size), status.
- Owner: program

2. Escrow PDA (per match/lobby)
- Seeds: `[b"escrow", lobby_pda]`
- Purpose: holds lamports for entry fees until settlement.
- Type: `SystemAccount` owned by program

3. Match PDA
- Seeds: `[b"match", lobby_pda, &match_id_bytes]`
- Purpose: record match participants summary, result hash, winning pubkey, settled boolean.
- Owner: program

4. Treasury/Platform PDA
- Seeds: `[b"treasury"]`
- Purpose: platform fee destination; program can transfer a cut upon settle.
- Owner: program

5. ServerSigners (off-chain)
- The server holds an ECDSA/Ed25519 keypair and publishes the public key on-chain in a Registry PDA or hard-coded during deployment. Program verifies server-signed result payloads.

## Account fields (suggested shapes)

### Lobby (packed):
- u8: version
- Pubkey: host (32)
- u64: entry_fee_lamports
- u8: max_players
- u8: players_len
- [Pubkey; N]: players (N = maxPlayers cap, store up to 8 players)
- u8: status (0=open,1=locked,2=closed)
- u32: created_at (unix)
- u16: topic_len + topic bytes (keep small, e.g., 64 max)

### Match (packed):
- u8: version
- Pubkey: lobby (32)
- u8: players_len
- [Pubkey; N] players
- Pubkey: winner (32) or [0..]
- u8: settled (0/1)
- [u8; 32]: result_hash (sha256 of canonical result blob)
- u32: finished_at

### Escrow:
- System account owned by program; stores lamports. No custom data needed.

## Instruction prototypes (Anchor style)

- `create_lobby(entry_fee: u64, max_players: u8, topic: String, privacy: u8)`
  - Accounts: host signer, lobby_pda (init with space), system_program
  - Effects: create lobby, set host, initialize players_len=0

- `join_lobby()`
  - Accounts: player signer, lobby_pda (mut), escrow_pda (mut, init if needed), system_program
  - Effects: transfer entry_fee from player to escrow_pda

- `start_match()`
  - Accounts: host or server signer, lobby_pda (mut), match_pda (init), escrow_pda (mut)
  - Effects: lock lobby, create match record (snapshot players)

- `settle_match(result_blob: Vec<u8>, server_sig: [u8;64])`
  - Accounts: submitter signer, match_pda (mut), escrow_pda (mut), treasury_pda (mut), system_program
  - Effects: verify signature (server public key hard-coded or via registry), pay winner and platform fee, mark match settled

- `cancel_lobby()`
  - Accounts: host signer, lobby_pda (mut), escrow_pda (mut), system_program
  - Effects: refund players if needed, close lobby

## Signature verification
- Server signs the canonical result blob (match id, winner pubkey, result hash, timestamp) with ed25519.
- Program verifies using `solana_program::ed25519_program` or an on-chain registry of allowed signers.

## Account size and rent
- Lobby: estimate ~2KB (topic + player list) — calculate exact with serialization.
- Match: ~1KB
- Escrow: system account lamports only

## Example Rust (Anchor) snippets
- I'll prepare `create_lobby` and `join_lobby` implementations next.

---

If this layout looks good, I'll implement the Anchor account structs and `create_lobby` + `join_lobby` functions (with size constants and Anchor constraints).