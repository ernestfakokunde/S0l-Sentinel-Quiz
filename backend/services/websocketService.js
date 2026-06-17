import WebSocket from 'ws';
import gameEngine from './gameEngine.js';

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

async function handleMessage(ws, rawMessage) {
  const data = JSON.parse(rawMessage.toString());

  switch (data.type) {
    case 'create_lobby': {
      const lobby = gameEngine.createLobby(data);
      if (data.player || data.host) {
        await gameEngine.joinLobby({
          lobbyId: lobby.lobbyId,
          player: data.player || data.host,
          ws,
          txSignature: data.txSignature,
        });
      }
      send(ws, { type: 'lobby_created', lobby: gameEngine.getLobby(lobby.lobbyId) });
      break;
    }

    case 'find_match': {
      const lobby = gameEngine.findOrCreateMatchmakingLobby(data);
      await gameEngine.joinLobby({
        lobbyId: lobby.lobbyId,
        player: data.player,
        ws,
        txSignature: data.txSignature,
      });
      send(ws, { type: 'matchmaking_joined', lobby: gameEngine.getLobby(lobby.lobbyId) });
      break;
    }

    case 'join_lobby': {
      const lobby = await gameEngine.joinLobby({
        lobbyId: data.lobbyId,
        player: data.player,
        ws,
        txSignature: data.txSignature,
      });
      send(ws, { type: 'joined', lobby });
      break;
    }

    case 'start_match': {
      const lobby = await gameEngine.startMatch(data.lobbyId || ws.lobbyId);
      send(ws, { type: 'start_ack', lobby });
      break;
    }

    case 'add_bot': {
      const lobby = await gameEngine.addBotToLobby(data.lobbyId || ws.lobbyId, data.name);
      send(ws, { type: 'bot_added', lobby });
      break;
    }

    case 'submit_answer': {
      const result = await gameEngine.submitAnswer({
        lobbyId: data.lobbyId || ws.lobbyId,
        player: data.player || ws.player,
        questionIndex: Number(data.questionIndex),
        answerIdx: Number(data.answerIdx),
      });
      send(ws, { type: 'answer_ack', questionIndex: Number(data.questionIndex), ...result });
      break;
    }

    case 'ping':
      send(ws, { type: 'pong', ts: Date.now() });
      break;

    default:
      send(ws, { type: 'error', message: `Unknown message type: ${data.type}` });
  }
}

function registerWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (message) => {
      try {
        await handleMessage(ws, message);
      } catch (err) {
        send(ws, { type: 'error', message: err.message });
      }
    });

    ws.on('close', () => gameEngine.detachSocket(ws));
    send(ws, { type: 'welcome', ts: Date.now() });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping(() => {});
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));
  return wss;
}

export { registerWebSocketServer };
