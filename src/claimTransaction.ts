import {
  getProgramDerivedAddress,
  type Address,
} from "@solana/kit";
import type { MatchEnded } from "./types";
import { VAULT_PROGRAM_ADDRESS } from "./generated/vault";

const CLAIM_PRIZE_DISCRIMINATOR = new Uint8Array([157, 233, 139, 121, 246, 62, 234, 235]);
const ED25519_PROGRAM_ADDRESS = "Ed25519SigVerify111111111111111111111111111" as Address;
const INSTRUCTIONS_SYSVAR_ADDRESS = "Sysvar1nstructions1111111111111111111111111" as Address;
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;
const CONFIG_SEED = new TextEncoder().encode("config");
const LOBBY_SEED = new TextEncoder().encode("lobby");
const ESCROW_SEED = new TextEncoder().encode("escrow");

type ClaimInstructionsInput = {
  matchEnded: MatchEnded;
  winner: Address;
  treasury: Address;
};

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
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

export async function buildClaimPrizeInstructions({ matchEnded, winner, treasury }: ClaimInstructionsInput) {
  const signedResult = matchEnded.signedResult;
  const message = signedResult.messageBase64
    ? base64ToBytes(signedResult.messageBase64)
    : new TextEncoder().encode(signedResult.canonical);
  const signature = base64ToBytes(signedResult.signatureBase64);
  const publicKey = base64ToBytes(signedResult.publicKeyBase64);
  const lobbyIdHash = await sha256Bytes(matchEnded.lobbyId);

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

  return [
    createEd25519Instruction(message, signature, publicKey),
    {
      programAddress: VAULT_PROGRAM_ADDRESS,
      accounts: [
        { address: winner, role: 3 },
        { address: globalConfig, role: 0 },
        { address: lobby, role: 1 },
        { address: escrow, role: 1 },
        { address: treasury, role: 1 },
        { address: INSTRUCTIONS_SYSVAR_ADDRESS, role: 0 },
        { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
      ],
      data: encodeClaimPrizeData(matchEnded, message, signature),
    },
  ];
}
