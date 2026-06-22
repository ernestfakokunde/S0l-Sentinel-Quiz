import { PublicKey } from '@solana/web3.js';
import { getSignerInfo } from '../services/signerService.js';

const signer = getSignerInfo();
const publicKey = new PublicKey(Buffer.from(signer.publicKeyBase64, 'base64'));

console.log(JSON.stringify({
  resultSignerPubkey: publicKey.toBase58(),
  ephemeral: signer.ephemeral,
}, null, 2));

if (signer.ephemeral) {
  console.error('RESULT_SIGNER_PRIVATE_KEY_PEM or RESULT_SIGNER_PRIVATE_KEY_DER_BASE64 is not set. Do not initialize production config with this ephemeral signer.');
  process.exitCode = 1;
}
