import { prisma } from '../services/prisma.js';
import { toJsonSafe } from '../services/json.js';

async function getHistory(req, res) {
  try {
    const wallet = typeof req.query.wallet === 'string' ? req.query.wallet : null;
    const where = wallet
      ? {
          OR: [
            { winner: wallet },
            { resultPayload: { path: ['players'], array_contains: [wallet] } },
          ],
        }
      : undefined;
    const matches = await prisma.match.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ matches: toJsonSafe(matches) });
  } catch (err) {
    console.error('History query failed', err);
    return res.status(500).json({ error: 'History could not be loaded' });
  }
}

export { getHistory };
