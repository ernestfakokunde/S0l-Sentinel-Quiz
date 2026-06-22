// =============================================================================
// SENTINEL02 VAULT PROGRAM — Phase 1 (Config + lobby + join)
// =============================================================================
//
// BUILD ORDER CHECKLIST (update as you go):
//   [x] Step 1 — Config + Lobby state structs
//   [x] Step 2 — initialize_config (master PDA, run once after deploy)
//   [x] Step 3 — create_lobby (one lobby + escrow per match)
//   [x] Step 4 — join_lobby (player pays entry fee into escrow)
//   [ ] Step 5 — anchor build + deploy devnet + run initialize_config once
//   [ ] Step 6 — Phase 2: claim_prize (verify backend signature, pay winner)
//   [ ] Step 7 — Regenerate TS client + wire frontend join/create flows
//
// RELATIONSHIP MAP:
//   Config  ──reads──►  every instruction checks entry_fee, treasury, signer pubkey
//   Lobby   ──owns──►   match metadata (host, player count, open/locked/settled)
//   Escrow  ──holds──►  SOL from all joins; separate PDA so money is isolated per lobby
//   Backend ──signs──►  match result (Phase 2); result_signer pubkey stored in Config
//
// NEXT AFTER THIS FILE COMPILES:
//   1. cd anchor && anchor build
//   2. anchor deploy --provider.cluster devnet
//   3. Call initialize_config(entry_fee=1_000_000, treasury_fee_bps=500)
//   4. Test create_lobby + join_lobby with two wallets on devnet
// =============================================================================

mod constant;

use anchor_lang::prelude::*;
use solana_instructions_sysvar::{load_instruction_at_checked, ID as INSTRUCTIONS_SYSVAR_ID};
use solana_sha256_hasher::hash;
use anchor_lang::system_program::{transfer, Transfer};
use constant::{CONFIG_SEED, ESCROW_SEED, LOBBY_SEED, MAX_PLAYERS, MAX_PLAYERS_USIZE};

declare_id!("Ah28Tt2zCqnMTcKjSwYvFayc7gB1Q98cNqsTHA2hE7wn");

// -----------------------------------------------------------------------------
// ON-CHAIN DATA — what gets persisted inside each account
// -----------------------------------------------------------------------------

/// Global master account (PDA seeds: ["config"]).
/// Created once at deploy; all lobbies read entry_fee and treasury rules from here.
#[account]
pub struct Config {
    pub authority: Pubkey,       // admin wallet that ran initialize_config
    pub result_signer: Pubkey,   // backend Ed25519 pubkey — used in Phase 2 claim
    pub treasury: Pubkey,        // wallet that receives the platform fee on claim
    pub entry_fee: u64,          // e.g. 1_000_000 lamports = 0.001 SOL
    pub treasury_fee_bps: u16,   // e.g. 500 = 5% of pot
    pub bump: u8,                // PDA bump seed (stored so we can re-derive the address)
}

impl Config {
    // 8-byte Anchor discriminator + all fields above
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 2 + 1;
}

/// Lifecycle of a lobby; stored as u8 on Lobby.status.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum LobbyStatus {
    Open,       // accepting joins
    Locked,     // full (2 players) — ready for game + claim
    Settled,    // winner paid (Phase 2)
    Cancelled,  // refunded (future)
}

/// Per-match account (PDA seeds: ["lobby", lobby_id]).
/// Links to Escrow via the same lobby_id; backend passes lobby_id as a 32-byte hash of lobby UUID.
#[account]
pub struct Lobby {
    pub lobby_id: [u8; 32],
    pub host: Pubkey,
    pub entry_fee: u64,    // copied from Config at create time
    pub max_players: u8,   // fixed at 2 for this arena
    pub player_count: u8,
    pub players: [Pubkey; MAX_PLAYERS_USIZE],
    pub status: u8,        // LobbyStatus as u8
    pub bump: u8,
}

impl Lobby {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 1 + 1 + (32 * MAX_PLAYERS_USIZE) + 1 + 1;
}

/// Escrow PDA (seeds: ["escrow", lobby_id]) — holds deposited SOL for one lobby.
/// No extra fields needed; lamports live on the account itself.
#[account]
pub struct Escrow {}

impl Escrow {
    pub const SIZE: usize = 8;
}

// -----------------------------------------------------------------------------
// INSTRUCTIONS — entry points the frontend/backend call
// -----------------------------------------------------------------------------

#[program]
pub mod vault {
    use super::*;

    /// STEP 2 — Run once after deploy.
    /// Creates the Config PDA and stores program-wide rules + backend signer pubkey.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        entry_fee: u64,
        treasury_fee_bps: u16,
    ) -> Result<()> {
        let global_config = &mut ctx.accounts.global_config;
        global_config.authority = ctx.accounts.authority.key();
        global_config.result_signer = ctx.accounts.result_signer.key();
        global_config.treasury = ctx.accounts.treasury.key();
        global_config.entry_fee = entry_fee;
        global_config.treasury_fee_bps = treasury_fee_bps;
        global_config.bump = ctx.bumps.global_config;
        Ok(())
    }

    /// STEP 3 — Host opens a match.
    /// Creates Lobby state and an empty Escrow PDA that will hold player deposits.
    pub fn create_lobby(ctx: Context<CreateLobby>, lobby_id: [u8; 32]) -> Result<()> {
        let lobby = &mut ctx.accounts.lobby;
        lobby.lobby_id = lobby_id;
        lobby.host = ctx.accounts.host.key();
        lobby.entry_fee = ctx.accounts.global_config.entry_fee;
        lobby.max_players = MAX_PLAYERS;
        lobby.player_count = 0;
        lobby.players = [Pubkey::default(); MAX_PLAYERS_USIZE];
        lobby.status = LobbyStatus::Open as u8;
        lobby.bump = ctx.bumps.lobby;
        Ok(())
    }

    /// STEP 4 — Player joins and pays entry fee.
    /// SOL moves player wallet → escrow PDA; when lobby is full, status becomes Locked.
    pub fn join_lobby(ctx: Context<JoinLobby>) -> Result<()> {
        let lobby = &mut ctx.accounts.lobby;
        let entry_fee = ctx.accounts.global_config.entry_fee;

        require!(
            lobby.status == LobbyStatus::Open as u8,
            ErrorCode::LobbyNotOpen
        );
        require!(
            lobby.player_count < lobby.max_players,
            ErrorCode::LobbyFull
        );
        require!(
            !lobby.players[..lobby.player_count as usize]
                .iter()
                .any(|player| *player == ctx.accounts.player.key()),
            ErrorCode::PlayerAlreadyJoined
        );

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            entry_fee,
        )?;

        let player_index = lobby.player_count as usize;
        lobby.players[player_index] = ctx.accounts.player.key();
        lobby.player_count = lobby
            .player_count
            .checked_add(1)
            .ok_or(ErrorCode::LobbyFull)?;

        if lobby.player_count >= lobby.max_players {
            lobby.status = LobbyStatus::Locked as u8;
        }

        Ok(())
    }



    /// Cancels a lobby before settlement and refunds all joined players.
    /// The host signs cancellation; both player refund accounts are supplied so the
    /// escrow can return each deposited entry fee in one transaction.
    pub fn cancel_lobby(ctx: Context<CancelLobby>) -> Result<()> {
        let lobby = &mut ctx.accounts.lobby;

        require!(
            lobby.status == LobbyStatus::Open as u8 || lobby.status == LobbyStatus::Locked as u8,
            ErrorCode::LobbyNotCancellable
        );
        require!(ctx.accounts.host.key() == lobby.host, ErrorCode::UnauthorizedCancel);

        let refund_accounts = [
            ctx.accounts.player_one.to_account_info(),
            ctx.accounts.player_two.to_account_info(),
        ];
        let entry_fee = lobby.entry_fee;

        for index in 0..lobby.player_count as usize {
            let player_key = lobby.players[index];
            let refund_account = &refund_accounts[index];
            require!(
                refund_account.key() == player_key,
                ErrorCode::RefundAccountMismatch
            );
            require!(
                ctx.accounts.escrow.to_account_info().lamports() >= entry_fee,
                ErrorCode::InsufficientEscrowFunds
            );

            **ctx
                .accounts
                .escrow
                .to_account_info()
                .try_borrow_mut_lamports()? -= entry_fee;
            **refund_account.try_borrow_mut_lamports()? += entry_fee;
        }

        lobby.status = LobbyStatus::Cancelled as u8;
        Ok(())
    }

    /// STEP 6 — Winner claims the escrowed pot with a backend-signed result.
    /// The transaction must include an Ed25519 verification instruction immediately
    /// before this instruction. This instruction checks that verification, checks the
    /// signed canonical JSON matches the winner/lobby/payout being settled, and then
    /// moves lamports from escrow to winner + treasury.
    pub fn claim_prize(
        ctx: Context<ClaimPrize>,
        lobby_id: String,
        message: Vec<u8>,
        signature: [u8; 64],
        payout_lamports: u64,
        treasury_fee_lamports: u64,
    ) -> Result<()> {
        let lobby = &mut ctx.accounts.lobby;
        let global_config = &ctx.accounts.global_config;

        require!(
            lobby.status == LobbyStatus::Locked as u8,
            ErrorCode::LobbyNotClaimable
        );
        require!(
            hash(lobby_id.as_bytes()).to_bytes() == lobby.lobby_id,
            ErrorCode::LobbyIdMismatch
        );
        require!(
            ctx.accounts.treasury.key() == global_config.treasury,
            ErrorCode::InvalidTreasury
        );

        verify_ed25519_ix(
            &ctx.accounts.instructions.to_account_info(),
            &global_config.result_signer.to_bytes(),
            &message,
            &signature,
        )?;

        let winner = ctx.accounts.winner.key().to_string();
        require!(
            message_contains(&message, &format!("\"lobbyId\":\"{}\"", lobby_id)),
            ErrorCode::SignedResultMismatch
        );
        require!(
            message_contains(&message, &format!("\"winner\":\"{}\"", winner)),
            ErrorCode::SignedResultMismatch
        );
        require!(
            message_contains(
                &message,
                &format!("\"payoutLamports\":\"{}\"", payout_lamports)
            ),
            ErrorCode::SignedResultMismatch
        );
        require!(
            message_contains(
                &message,
                &format!("\"treasuryFeeLamports\":\"{}\"", treasury_fee_lamports)
            ),
            ErrorCode::SignedResultMismatch
        );

        let total_payout = payout_lamports
            .checked_add(treasury_fee_lamports)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(
            ctx.accounts.escrow.to_account_info().lamports() >= total_payout,
            ErrorCode::InsufficientEscrowFunds
        );

        **ctx
            .accounts
            .escrow
            .to_account_info()
            .try_borrow_mut_lamports()? -= total_payout;
        **ctx
            .accounts
            .winner
            .to_account_info()
            .try_borrow_mut_lamports()? += payout_lamports;
        **ctx
            .accounts
            .treasury
            .to_account_info()
            .try_borrow_mut_lamports()? += treasury_fee_lamports;

        lobby.status = LobbyStatus::Settled as u8;
        Ok(())
    }
}

fn message_contains(message: &[u8], needle: &str) -> bool {
    message
        .windows(needle.as_bytes().len())
        .any(|window| window == needle.as_bytes())
}

fn verify_ed25519_ix(
    instructions: &AccountInfo,
    expected_pubkey: &[u8; 32],
    expected_message: &[u8],
    expected_signature: &[u8; 64],
) -> Result<()> {
    let ix = load_instruction_at_checked(0, instructions)?;
    require!(
        ix.program_id == solana_sdk_ids::ed25519_program::id(),
        ErrorCode::MissingEd25519Instruction
    );
    require!(ix.data.len() >= 16, ErrorCode::InvalidEd25519Instruction);
    require!(ix.data[0] == 1, ErrorCode::InvalidEd25519Instruction);

    let signature_offset = u16::from_le_bytes([ix.data[2], ix.data[3]]) as usize;
    let pubkey_offset = u16::from_le_bytes([ix.data[6], ix.data[7]]) as usize;
    let message_offset = u16::from_le_bytes([ix.data[10], ix.data[11]]) as usize;
    let message_size = u16::from_le_bytes([ix.data[12], ix.data[13]]) as usize;

    let signature_end = signature_offset
        .checked_add(64)
        .ok_or(ErrorCode::InvalidEd25519Instruction)?;
    let pubkey_end = pubkey_offset
        .checked_add(32)
        .ok_or(ErrorCode::InvalidEd25519Instruction)?;
    let message_end = message_offset
        .checked_add(message_size)
        .ok_or(ErrorCode::InvalidEd25519Instruction)?;

    require!(
        signature_end <= ix.data.len() && pubkey_end <= ix.data.len() && message_end <= ix.data.len(),
        ErrorCode::InvalidEd25519Instruction
    );
    require!(
        &ix.data[signature_offset..signature_end] == expected_signature,
        ErrorCode::InvalidResultSignature
    );
    require!(
        &ix.data[pubkey_offset..pubkey_end] == expected_pubkey,
        ErrorCode::InvalidResultSigner
    );
    require!(
        &ix.data[message_offset..message_end] == expected_message,
        ErrorCode::SignedResultMismatch
    );

    Ok(())
}

// -----------------------------------------------------------------------------
// ACCOUNT VALIDATION — which accounts each instruction expects and how PDAs are derived
// -----------------------------------------------------------------------------

/// Accounts for initialize_config.
/// authority pays rent; result_signer is only a Pubkey (no on-chain account needed).
#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: backend result signer Pubkey (from GET /signer on your API)
    pub result_signer: UncheckedAccount<'info>,

    /// CHECK: treasury wallet that receives fees on claim
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = Config::SIZE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub global_config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

/// Accounts for create_lobby.
/// lobby_id arg must match seeds on both lobby and escrow PDAs.
#[derive(Accounts)]
#[instruction(lobby_id: [u8; 32])]
pub struct CreateLobby<'info> {
    #[account(mut)]
    pub host: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = global_config.bump)]
    pub global_config: Account<'info, Config>,

    #[account(
        init,
        payer = host,
        space = Lobby::SIZE,
        seeds = [LOBBY_SEED, lobby_id.as_ref()],
        bump,
    )]
    pub lobby: Account<'info, Lobby>,

    /// Escrow holds SOL for this lobby (PDA owned by this program).
    #[account(
        init,
        payer = host,
        space = Escrow::SIZE,
        seeds = [ESCROW_SEED, lobby_id.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

/// Accounts for join_lobby.
/// Escrow is found via lobby.lobby_id so it stays tied to the same match.
#[derive(Accounts)]
pub struct JoinLobby<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = global_config.bump)]
    pub global_config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby.lobby_id.as_ref()],
        bump = lobby.bump,
    )]
    pub lobby: Account<'info, Lobby>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, lobby.lobby_id.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}


/// Accounts for cancel_lobby.
#[derive(Accounts)]
pub struct CancelLobby<'info> {
    #[account(mut)]
    pub host: Signer<'info>,

    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby.lobby_id.as_ref()],
        bump = lobby.bump,
    )]
    pub lobby: Account<'info, Lobby>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, lobby.lobby_id.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: checked against lobby.players[0] when present.
    #[account(mut)]
    pub player_one: UncheckedAccount<'info>,

    /// CHECK: checked against lobby.players[1] when present.
    #[account(mut)]
    pub player_two: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Accounts for claim_prize.
#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = global_config.bump)]
    pub global_config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [LOBBY_SEED, lobby.lobby_id.as_ref()],
        bump = lobby.bump,
    )]
    pub lobby: Account<'info, Lobby>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, lobby.lobby_id.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: checked against global_config.treasury.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Ed25519 instruction sysvar, checked by address.
    #[account(address = INSTRUCTIONS_SYSVAR_ID)]
    pub instructions: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

// -----------------------------------------------------------------------------
// ERRORS — custom messages returned when require! checks fail
// -----------------------------------------------------------------------------

#[error_code]
pub enum ErrorCode {
    #[msg("Lobby is not open for joins")]
    LobbyNotOpen,
    #[msg("Lobby is already full")]
    LobbyFull,
    #[msg("Player has already joined this lobby")]
    PlayerAlreadyJoined,
    #[msg("Lobby cannot be cancelled in its current state")]
    LobbyNotCancellable,
    #[msg("Only the lobby host can cancel")]
    UnauthorizedCancel,
    #[msg("Refund account does not match the joined player")]
    RefundAccountMismatch,
    #[msg("Lobby is not ready to be claimed")]
    LobbyNotClaimable,
    #[msg("Signed lobby id does not match the lobby account")]
    LobbyIdMismatch,
    #[msg("Treasury account does not match global config")]
    InvalidTreasury,
    #[msg("Missing Ed25519 signature verification instruction")]
    MissingEd25519Instruction,
    #[msg("Invalid Ed25519 signature verification instruction")]
    InvalidEd25519Instruction,
    #[msg("Backend result signer does not match global config")]
    InvalidResultSigner,
    #[msg("Backend result signature does not match the claim")]
    InvalidResultSignature,
    #[msg("Signed result payload does not match the claim")]
    SignedResultMismatch,
    #[msg("Escrow does not have enough lamports to pay this claim")]
    InsufficientEscrowFunds,
    #[msg("Math overflow")]
    MathOverflow,
}

// Re-export defaults so tests/scripts can import them from the crate root.
pub use constant::{
    DEFAULT_ENTRY_FEE_LAMPORTS as ENTRY_FEE_LAMPORTS,
    DEFAULT_TREASURY_FEE_BPS as TREASURY_FEE_BPS,
};
