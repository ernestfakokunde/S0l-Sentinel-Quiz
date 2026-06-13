import gameEngine from '../services/gameEngine.js';

function listLobbies(_req, res) {
  res.json({ lobbies: gameEngine.listLobbies() });
}

function getLobby(req, res) {
  const lobby = gameEngine.getLobby(req.params.lobbyId);
  if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
  return res.json({ lobby });
}

function createLobby(req, res) {
  try {
    const lobby = gameEngine.createLobby(req.body || {});
    return res.status(201).json({ lobby });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

function findMatch(req, res) {
  try {
    const lobby = gameEngine.findOrCreateMatchmakingLobby(req.body || {});
    return res.json({ lobby });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function startLobby(req, res) {
  try {
    const lobby = await gameEngine.startMatch(req.params.lobbyId);
    return res.json({ lobby });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export {
  listLobbies,
  getLobby,
  createLobby,
  findMatch,
  startLobby,
};
