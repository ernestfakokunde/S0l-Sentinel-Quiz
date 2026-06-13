import { Connection, clusterApiUrl } from '@solana/web3.js';

let cachedConnection;
let cachedConnectionKey;

function getCluster() {
  return process.env.SOLANA_CLUSTER || 'devnet';
}

function getRpcUrl() {
  return process.env.RPC_URL || process.env.SOLANA_RPC_URL || clusterApiUrl(getCluster());
}

function getWssRpcUrl() {
  return process.env.WSS_RPC_URL || process.env.SOLANA_WSS_RPC_URL || null;
}

function getCommitment() {
  return process.env.SOLANA_CONFIRMATION || 'confirmed';
}

function getConnection() {
  const rpcUrl = getRpcUrl();
  const wssRpcUrl = getWssRpcUrl();
  const commitment = getCommitment();
  const connectionKey = JSON.stringify({ rpcUrl, wssRpcUrl, commitment });

  if (!cachedConnection || cachedConnectionKey !== connectionKey) {
    cachedConnection = new Connection(rpcUrl, {
      commitment,
      ...(wssRpcUrl ? { wsEndpoint: wssRpcUrl } : {}),
    });
    cachedConnectionKey = connectionKey;
  }
  return cachedConnection;
}

function getRpcInfo() {
  return {
    cluster: getCluster(),
    rpcConfigured: Boolean(process.env.RPC_URL || process.env.SOLANA_RPC_URL),
    wssRpcConfigured: Boolean(process.env.WSS_RPC_URL || process.env.SOLANA_WSS_RPC_URL),
    commitment: getCommitment(),
    joinTxVerificationRequired: process.env.REQUIRE_JOIN_TX_VERIFICATION === 'true',
  };
}

async function verifyTransactionSignature(txSignature) {
  if (!txSignature || typeof txSignature !== 'string') {
    throw new Error('txSignature is required');
  }

  const connection = getConnection();
  const statusResult = await connection.getSignatureStatuses([txSignature], {
    searchTransactionHistory: true,
  });

  const status = statusResult.value[0];
  if (!status) {
    return {
      verified: false,
      reason: 'Transaction signature was not found on the configured Solana cluster',
      txSignature,
      ...getRpcInfo(),
    };
  }

  if (status.err) {
    return {
      verified: false,
      reason: 'Transaction failed on-chain',
      txSignature,
      slot: status.slot,
      err: status.err,
      confirmationStatus: status.confirmationStatus,
      ...getRpcInfo(),
    };
  }

  return {
    verified: true,
    txSignature,
    slot: status.slot,
    confirmationStatus: status.confirmationStatus,
    confirmations: status.confirmations,
    ...getRpcInfo(),
  };
}

export {
  getConnection,
  getRpcInfo,
  verifyTransactionSignature,
};
