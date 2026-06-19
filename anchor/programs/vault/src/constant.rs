/// Program-wide constants shared across instructions and account validation.

/// PDA seed for the global Config account (one per program deploy).
pub const CONFIG_SEED: &[u8] = b"config";

/// PDA seed prefix for per-match Lobby accounts.
pub const LOBBY_SEED: &[u8] = b"lobby";

/// PDA seed prefix for per-match Escrow accounts (holds player SOL).
pub const ESCROW_SEED: &[u8] = b"escrow";

/// Fixed arena size — two players per lobby.
pub const MAX_PLAYERS: u8 = 2;
pub const MAX_PLAYERS_USIZE: usize = 2;

/// Default entry fee: 0.001 SOL (matches frontend FIXED_ENTRY_FEE_LAMPORTS).
pub const DEFAULT_ENTRY_FEE_LAMPORTS: u64 = 1_000_000;

/// Default treasury fee: 500 bps = 5% (matches backend TREASURY_FEE_BPS).
pub const DEFAULT_TREASURY_FEE_BPS: u16 = 500;
