import { prisma } from '../services/prisma.js';
import { toJsonSafe } from '../services/json.js';

async function getHistory(_req, res) {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ matches: toJsonSafe(matches) });
  } catch (err) {
    console.error('DB error', err);
    return res.status(500).json({ error: 'DB error' });
  }
}

export { getHistory };
