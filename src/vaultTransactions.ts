import { getProgramDerivedAddress, type Address } from "@solana/kit";
import type { Lobby, MatchEnded } from "./types";
import { VAULT_PROGRAM_ADDRESS } from "./generated/vault";

const CREATE_LOBBY_DISCRIMINATOR = new Uint8Array([116, 55, 74, 48, 40, 51, 135, 155]);
const JOIN_LOBBY_DISCRIMINATOR = new Uint8Array([127, 102, 119, 190, 215, 223, 212, 159]);
const CANCEL_LOBBY_DISCRIMINATOR = new Uint8Array([241, 47, 118, 95, 81, 67, 137, 13]);
const CLAIM_PRIZE_DISCRIMINATOR = new Uint8Array([157, 233, 139, 121, 246, 62, 234, 235]);
const ED25519_PROGRAM_ADDRESS = "Ed25519SigVerify111111111111111111111111111" as Address;
const INSTRUCTIONS_SYSVAR_ADDRESS = "Sysvar1nstructions1111111111111111111111111" as Address;
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;
const CONFIG_SEED = new TextEncoder().encode("config");
const LOBBY_SEED = new TextEncoder().encode("lobby");
const ESCROW_SEED = new TextEncoder().encode("escrow");
const DEFAULT_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const LOBBY_ACCOUNT_SIZE = 148;
const ESCROW_ACCOUNT_SIZE = 8;
const TX_FEE_BUFFER_LAMPORTS = 10_000n;

type ClaimInstructionsInput = {
  matchEnded: MatchEnded;
  winner: Address;
  treasury: Address;
};

type RpcAccountInfo = {
  data: [string, string];
  lamports: number;
  owner: string;
};

type FundingCheckInput = {
  payer: Address;
  createsLobby?: boolean;
  rpcUrl?: string;
};

export type LobbyPdas = {
  globalConfig: Address;
  lobby: Address;
  escrow: Address;
  lobbyIdHash: Uint8Array;
};

export type VaultFundingRequirement = {
  payerBalanceLamports: bigint;
  requiredLamports: bigint;
  entryFeeLamports: bigint;
  rentLamports: bigint;
  globalConfig: Address;
};

async function rpcRequest<T>(rpcUrl: string, method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "sentinel02-vault-preflight",
      method,
      params,
    }),
  });
  if (!response.ok) throw new Error(`Solana RPC request failed: ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || "Solana RPC request failed.");
  return payload.result as T;
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function hexToBytes(value: string) {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) throw new Error("lobbyIdHash must be 32 bytes hex.");
  return Uint8Array.from(value.match(/.{2}/g) || [], (byte) => parseInt(byte, 16));
}

function writeU16(data: Uint8Array, offset: number, value: number) {
  new DataView(data.buffer).setUint16(offset, value, true);
}

function writeU32(data: Uint8Array, offset: number, value: number) {
  new DataView(data.buffer).setUint32(offset, value, true);
}

function writeU64(data: Uint8Array, offset: number, value: bigint) {
  new DataView(data.buffer).setBigUint64(offset, value, true);
}

function readU64(data: Uint8Array, offset: number) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true);
}

function concatBytes(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

async function sha256Bytes(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function encodeAnchorString(value: string) {
  const bytes = new TextEncoder().encode(value);
  const length = new Uint8Array(4);
  writeU32(length, 0, bytes.length);
  return concatBytes([length, bytes]);
}

function encodeAnchorVec(bytes: Uint8Array) {
  const length = new Uint8Array(4);
  writeU32(length, 0, bytes.length);
  return concatBytes([length, bytes]);
}

function encodeCreateLobbyData(lobbyIdHash: Uint8Array) {
  if (lobbyIdHash.length !== 32) throw new Error("lobbyIdHash must be 32 bytes.");
  return concatBytes([CREATE_LOBBY_DISCRIMINATOR, lobbyIdHash]);
}

function encodeClaimPrizeData(matchEnded: MatchEnded, message: Uint8Array, signature: Uint8Array) {
  const payout = new Uint8Array(8);
  const treasuryFee = new Uint8Array(8);
  writeU64(payout, 0, BigInt(matchEnded.payoutLamports));
  writeU64(treasuryFee, 0, BigInt(matchEnded.treasuryFeeLamports));

  return concatBytes([
    CLAIM_PRIZE_DISCRIMINATOR,
    encodeAnchorString(matchEnded.lobbyId),
    encodeAnchorVec(message),
    signature,
    payout,
    treasuryFee,
  ]);
}

function createEd25519Instruction(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array) {
  if (signature.length !== 64) throw new Error("Backend result signature must be 64 bytes.");
  if (publicKey.length !== 32) throw new Error("Backend result signer public key must be 32 bytes.");

  const headerLength = 16;
  const signatureOffset = headerLength;
  const publicKeyOffset = signatureOffset + signature.length;
  const messageOffset = publicKeyOffset + publicKey.length;
  const data = new Uint8Array(headerLength + signature.length + publicKey.length + message.length);

  data[0] = 1;
  data[1] = 0;
  writeU16(data, 2, signatureOffset);
  writeU16(data, 4, 0xffff);
  writeU16(data, 6, publicKeyOffset);
  writeU16(data, 8, 0xffff);
  writeU16(data, 10, messageOffset);
  writeU16(data, 12, message.length);
  writeU16(data, 14, 0xffff);
  data.set(signature, signatureOffset);
  data.set(publicKey, publicKeyOffset);
  data.set(message, messageOffset);

  return {
    programAddress: ED25519_PROGRAM_ADDRESS,
    accounts: [],
    data,
  };
}

export async function deriveLobbyPdas(lobbyId: string, lobbyIdHashHex?: string | null): Promise<LobbyPdas> {
  const lobbyIdHash = lobbyIdHashHex ? hexToBytes(lobbyIdHashHex) : await sha256Bytes(lobbyId);
  const [globalConfig] = await getProgramDerivedAddress({
    programAddress: VAULT_PROGRAM_ADDRESS,
    seeds: [CONFIG_SEED],
  });
  const [lobby] = await getProgramDerivedAddress({
    programAddress: VAULT_PROGRAM_ADDRESS,
    seeds: [LOBBY_SEED, lobbyIdHash],
  });
  const [escrow] = await getProgramDerivedAddress({
    programAddress: VAULT_PROGRAM_ADDRESS,
    seeds: [ESCROW_SEED, lobbyIdHash],
  });
  return { globalConfig, lobby, escrow, lobbyIdHash };
}

export function formatLamportsAsSol(lamports: bigint) {
  const whole = lamports / 1_000_000_000n;
  const fractional = (lamports % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

export async function getVaultFundingRequirement({
  payer,
  createsLobby = false,
  rpcUrl = DEFAULT_RPC_URL,
}: FundingCheckInput): Promise<VaultFundingRequirement> {
  const [globalConfig] = await getProgramDerivedAddress({
    programAddress: VAULT_PROGRAM_ADDRESS,
    seeds: [CONFIG_SEED],
  });
  const configResult = await rpcRequest<{ value: RpcAccountInfo | null }>(rpcUrl, "getAccountInfo", [
    globalConfig,
    { encoding: "base64", commitment: "confirmed" },
  ]);
  if (!configResult.value) {
    throw new Error(
      `Vault config is not initialized on this cluster. Initialize ${globalConfig} before creating or joining lobbies.`,
    );
  }

  const configData = base64ToBytes(configResult.value.data[0]);
  if (configData.length < 115) throw new Error("Vault config account is too small to decode.");
  const entryFeeLamports = readU64(configData, 104);

  const balanceResult = await rpcRequest<{ value: number }>(rpcUrl, "getBalance", [
    payer,
    { commitment: "confirmed" },
  ]);
  const payerBalanceLamports = BigInt(balanceResult.value);

  let rentLamports = 0n;
  if (createsLobby) {
    const [lobbyRent, escrowRent] = await Promise.all([
      rpcRequest<number>(rpcUrl, "getMinimumBalanceForRentExemption", [LOBBY_ACCOUNT_SIZE]),
      rpcRequest<number>(rpcUrl, "getMinimumBalanceForRentExemption", [ESCROW_ACCOUNT_SIZE]),
    ]);
    rentLamports = BigInt(lobbyRent) + BigInt(escrowRent);
  }

  return {
    payerBalanceLamports,
    requiredLamports: entryFeeLamports + rentLamports + TX_FEE_BUFFER_LAMPORTS,
    entryFeeLamports,
    rentLamports,
    globalConfig,
  };
}

export async function assertVaultFunding(input: FundingCheckInput) {
  const requirement = await getVaultFundingRequirement(input);
  if (requirement.payerBalanceLamports < requirement.requiredLamports) {
    throw new Error(
      `Insufficient SOL for vault transaction: wallet has ${formatLamportsAsSol(
        requirement.payerBalanceLamports,
      )} SOL, needs about ${formatLamportsAsSol(requirement.requiredLamports)} SOL. On-chain entry fee is ${formatLamportsAsSol(
        requirement.entryFeeLamports,
      )} SOL.`,
    );
  }
  return requirement;
}

export async function buildCreateLobbyAndJoinInstructions(lobbyId: string, host: Address) {
  const pdas = await deriveLobbyPdas(lobbyId);
  return {
    pdas,
    instructions: [
      {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: host, role: 3 },
          { address: pdas.globalConfig, role: 0 },
          { address: pdas.lobby, role: 1 },
          { address: pdas.escrow, role: 1 },
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
        ],
        data: encodeCreateLobbyData(pdas.lobbyIdHash),
      },
      {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: host, role: 3 },
          { address: pdas.globalConfig, role: 0 },
          { address: pdas.lobby, role: 1 },
          { address: pdas.escrow, role: 1 },
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
        ],
        data: JOIN_LOBBY_DISCRIMINATOR,
      },
    ],
  };
}

export async function buildJoinLobbyInstructions(lobby: Lobby, player: Address) {
  const pdas = await deriveLobbyPdas(lobby.lobbyId, lobby.lobbyIdHash);
  return {
    pdas,
    instructions: [
      {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: player, role: 3 },
          { address: pdas.globalConfig, role: 0 },
          { address: pdas.lobby, role: 1 },
          { address: pdas.escrow, role: 1 },
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
        ],
        data: JOIN_LOBBY_DISCRIMINATOR,
      },
    ],
  };
}

export async function buildCancelLobbyInstructions(lobby: Lobby, host: Address) {
  const pdas = await deriveLobbyPdas(lobby.lobbyId, lobby.lobbyIdHash);
  const realPlayers = lobby.players.filter((player) => !player.bot);
  const playerOne = (realPlayers[0]?.player || host) as Address;
  const playerTwo = (realPlayers[1]?.player || playerOne) as Address;

  return {
    pdas,
    instructions: [
      {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: host, role: 3 },
          { address: pdas.lobby, role: 1 },
          { address: pdas.escrow, role: 1 },
          { address: playerOne, role: 1 },
          { address: playerTwo, role: 1 },
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
        ],
        data: CANCEL_LOBBY_DISCRIMINATOR,
      },
    ],
  };
}

export async function buildClaimPrizeInstructions({ matchEnded, winner, treasury }: ClaimInstructionsInput) {
  const signedResult = matchEnded.signedResult;
  const message = signedResult.messageBase64
    ? base64ToBytes(signedResult.messageBase64)
    : new TextEncoder().encode(signedResult.canonical);
  const signature = base64ToBytes(signedResult.signatureBase64);
  const publicKey = base64ToBytes(signedResult.publicKeyBase64);
  const pdas = await deriveLobbyPdas(matchEnded.lobbyId, matchEnded.lobbyIdHash);

  return [
    createEd25519Instruction(message, signature, publicKey),
    {
      programAddress: VAULT_PROGRAM_ADDRESS,
      accounts: [
        { address: winner, role: 3 },
        { address: pdas.globalConfig, role: 0 },
        { address: pdas.lobby, role: 1 },
        { address: pdas.escrow, role: 1 },
        { address: treasury, role: 1 },
        { address: INSTRUCTIONS_SYSVAR_ADDRESS, role: 0 },
        { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
      ],
      data: encodeClaimPrizeData(matchEnded, message, signature),
    },
  ];
}
