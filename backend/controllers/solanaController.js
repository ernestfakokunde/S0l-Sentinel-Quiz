import { getRpcInfo, verifyTransactionSignature } from '../services/solanaRpcService.js';

function getRpcStatus(_req, res) {
  res.json({ solana: getRpcInfo() });
}

async function verifyTransaction(req, res) {
  try {
    const result = await verifyTransactionSignature(req.body?.txSignature);
    return res.json({ transaction: result });
  } catch (err) {
    console.error('Transaction verification failed', err);
    return res.status(400).json({ error: 'Transaction could not be verified' });
  }
}

export {
  getRpcStatus,
  verifyTransaction,
};
