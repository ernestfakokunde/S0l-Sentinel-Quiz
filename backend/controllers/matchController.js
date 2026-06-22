import { prisma } from '../services/prisma.js';
import { toJsonSafe } from '../services/json.js';
import { verifyTransactionSignature } from '../services/solanaRpcService.js';

async function getMatch(req, res) {
  try {
    const match = await prisma.match.findUnique({ where: { matchId: req.params.matchId } });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    return res.json({ match: toJsonSafe(match) });
  } catch (err) {
    console.error('Match lookup failed', err);
    return res.status(500).json({ error: 'Match could not be loaded' });
  }
}

async function recordClaim(req, res) {
  try {
    const { claimTxSignature } = req.body || {};
    if (!claimTxSignature) return res.status(400).json({ error: 'claimTxSignature is required' });

    const verification = await verifyTransactionSignature(claimTxSignature);
    if (!verification.verified) {
      console.warn('Claim verification failed', verification.reason);
      return res.status(400).json({ error: 'Claim transaction could not be verified' });
    }

    const match = await prisma.match.update({
      where: { matchId: req.params.matchId },
      data: {
        claimStatus: 'claimed',
        claimTxSignature,
        claimedAt: new Date(),
      },
    });

    return res.json({ match: toJsonSafe(match), verification });
  } catch (err) {
    console.error('Claim record failed', err);
    return res.status(500).json({ error: 'Claim could not be recorded' });
  }
}

export {
  getMatch,
  recordClaim,
};
