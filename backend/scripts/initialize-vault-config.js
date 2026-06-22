import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { getSignerInfo } from '../services/signerService.js';

const PROGRAM_ID = new PublicKey(process.env.VAULT_PROGRAM_ID || 'Ah28Tt2zCqnMTcKjSwYvFayc7gB1Q98cNqsTHA2hE7wn');
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS;
const ENTRY_FEE_LAMPORTS = BigInt(process.env.ENTRY_FEE_LAMPORTS || '1000000');
const TREASURY_FEE_BPS = Number(process.env.TREASURY_FEE_BPS || '500');
const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR_PATH || path.join(os.homedir(), '.config/solana/id.json');

function readKeypair(filePath) {
  const resolved = filePath.startsWith('~') ? path.join(os.homedir(), filePath.slice(1)) : filePath;
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(resolved, 'utf8'))));
}

function writeU64(buffer, offset, value) {
  buffer.writeBigUInt64LE(value, offset);
}

function writeU16(buffer, offset, value) {
  buffer.writeUInt16LE(value, offset);
}

if (!TREASURY_ADDRESS) {
  throw new Error('TREASURY_ADDRESS is required in backend/.env');
}

if (TREASURY_FEE_BPS < 0 || TREASURY_FEE_BPS > 10_000) {
  throw new Error('TREASURY_FEE_BPS must be between 0 and 10000');
}

const signer = getSignerInfo();
if (signer.ephemeral) {
  throw new Error('Refusing to initialize config with ephemeral backend signer. Set RESULT_SIGNER_PRIVATE_KEY_PEM or RESULT_SIGNER_PRIVATE_KEY_DER_BASE64 first.');
}

const authority = readKeypair(KEYPAIR_PATH);
const resultSigner = new PublicKey(Buffer.from(signer.publicKeyBase64, 'base64'));
const treasury = new PublicKey(TREASURY_ADDRESS);
const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);

const data = Buffer.alloc(18);
Buffer.from([208, 127, 21, 1, 194, 190, 196, 70]).copy(data, 0);
writeU64(data, 8, ENTRY_FEE_LAMPORTS);
writeU16(data, 16, TREASURY_FEE_BPS);

const ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    { pubkey: resultSigner, isSigner: false, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: false },
    { pubkey: globalConfig, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data,
});

const connection = new Connection(RPC_URL, process.env.SOLANA_CONFIRMATION || 'confirmed');
const existing = await connection.getAccountInfo(globalConfig, process.env.SOLANA_CONFIRMATION || 'confirmed');
if (existing) {
  console.log(JSON.stringify({ alreadyInitialized: true, globalConfig: globalConfig.toBase58() }, null, 2));
  process.exit(0);
}

const signature = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [authority], {
  commitment: process.env.SOLANA_CONFIRMATION || 'confirmed',
});

console.log(JSON.stringify({
  signature,
  programId: PROGRAM_ID.toBase58(),
  globalConfig: globalConfig.toBase58(),
  authority: authority.publicKey.toBase58(),
  resultSigner: resultSigner.toBase58(),
  treasury: treasury.toBase58(),
  entryFeeLamports: ENTRY_FEE_LAMPORTS.toString(),
  treasuryFeeBps: TREASURY_FEE_BPS,
}, null, 2));
