import crypto from 'crypto';
import { prisma } from './prisma.js';
import { getQuestionsForMatch, snapshotMatchQuestions } from './questionService.js';
import { signCanonicalResult } from './signerService.js';
import { verifyTransactionSignature } from './solanaRpcService.js';
import { hashlobbyid } from './hashlobbyid.js';

const DEFAULTS = {
  entryFeeLamports: '1000000',
  maxPlayers: 2,
  questionCount: 5,
  questionTimeMs: 15000,
  topic: 'Solana Basics',
  mode: 'Speed',
  privacy: 'public',
};

class GameEngine {
  constructor() {
    this.lobbies = new Map();
    this.socketsByLobby = new Map();
  }

  createLobby(input = {}) {
    const lobbyId = input.lobbyId || crypto.randomUUID();
    const lobbyIdHash = hashlobbyid(lobbyId);
    const lobby = {
      lobbyId,
      lobbyIdHash: lobbyIdHash.toString("hex"),
      host: input.host,
      entryFeeLamports: String(input.entryFeeLamports || DEFAULTS.entryFeeLamports),
      maxPlayers: Number(input.maxPlayers || DEFAULTS.maxPlayers),
      questionCount: Number(input.questionCount || DEFAULTS.questionCount),
      questionTimeMs: Number(input.questionTimeMs || DEFAULTS.questionTimeMs),
      topic: input.topic || DEFAULTS.topic,
      mode: input.mode || DEFAULTS.mode,
      privacy: input.privacy || DEFAULTS.privacy,
      status: 'waiting',
      players: [],
      createdAt: new Date().toISOString(),
      matchId: null,
      onchainLobbyPda: input.onchainLobbyPda || null,
      escrowPda: input.escrowPda || null,
      createdTxSignature: input.createdTxSignature || null,
    };

    if (lobby.maxPlayers < 2) lobby.maxPlayers = 2;
    if (lobby.questionCount < 1) lobby.questionCount = 1;
    if (lobby.questionTimeMs < 3000) lobby.questionTimeMs = 3000;

    this.lobbies.set(lobbyId, lobby);
    this.persistLobbySnapshot(lobby).catch((err) => {
      console.warn('Could not persist lobby snapshot:', err.message);
    });

    return this.publicLobby(lobby);
  }

  async persistLobbySnapshot(lobby) {
    await prisma.lobbySnapshot.upsert({
      where: { lobbyId: lobby.lobbyId },
      create: {
        lobbyId: lobby.lobbyId,
        host: lobby.host || 'unknown',
        entryFeeLamports: BigInt(lobby.entryFeeLamports),
        maxPlayers: lobby.maxPlayers,
        players: lobby.players.length,
        playerWallets: lobby.players.map(({ player }) => player),
        questionCount: lobby.questionCount,
        questionTimeMs: lobby.questionTimeMs,
        topic: lobby.topic,
        mode: lobby.mode,
        privacy: lobby.privacy,
        status: lobby.status,
        onchainLobbyPda: lobby.onchainLobbyPda,
        escrowPda: lobby.escrowPda,
        createdTxSignature: lobby.createdTxSignature,
      },
      update: {
        players: lobby.players.length,
        playerWallets: lobby.players.map(({ player }) => player),
        status: lobby.status,
        topic: lobby.topic,
        privacy: lobby.privacy,
        onchainLobbyPda: lobby.onchainLobbyPda,
        escrowPda: lobby.escrowPda,
        createdTxSignature: lobby.createdTxSignature,
      },
    });
  }

  listLobbies() {
    return [...this.lobbies.values()].map((lobby) => this.publicLobby(lobby));
  }

  getLobby(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    return lobby ? this.publicLobby(lobby) : null;
  }

  findOrCreateMatchmakingLobby(input = {}) {
    const openLobby = [...this.lobbies.values()].find((lobby) => (
      lobby.status === 'waiting'
      && lobby.privacy === 'public'
      && lobby.topic === (input.topic || DEFAULTS.topic)
      && lobby.entryFeeLamports === String(input.entryFeeLamports || DEFAULTS.entryFeeLamports)
      && lobby.players.length < lobby.maxPlayers
    ));

    if (openLobby) return this.publicLobby(openLobby);
    return this.createLobby(input);
  }

  attachSocket(ws, lobbyId, player) {
    if (!this.socketsByLobby.has(lobbyId)) this.socketsByLobby.set(lobbyId, new Set());
    this.socketsByLobby.get(lobbyId).add(ws);
    ws.lobbyId = lobbyId;
    ws.player = player;
  }

  detachSocket(ws) {
    if (!ws.lobbyId) return;
    const sockets = this.socketsByLobby.get(ws.lobbyId);
    if (!sockets) return;
    sockets.delete(ws);
    if (sockets.size === 0) this.socketsByLobby.delete(ws.lobbyId);
  }

  send(ws, payload) {
    if (ws.readyState === 1) ws.send(JSON.stringify(payload));
  }

  broadcast(lobbyId, payload) {
    const sockets = this.socketsByLobby.get(lobbyId);
    if (!sockets) return;
    for (const ws of sockets) this.send(ws, payload);
  }

  async verifyJoinTxIfNeeded(txSignature) {
    const required = process.env.REQUIRE_JOIN_TX_VERIFICATION === 'true';

    if (!txSignature) {
      if (required) throw new Error('Join transaction signature is required');
      return { verified: false, reason: 'No transaction signature supplied' };
    }

    const result = await verifyTransactionSignature(txSignature);
    if (required && !result.verified) {
      throw new Error(result.reason || 'Join transaction could not be verified');
    }

    return result;
  }

  async persistPlayerJoin({ lobby, player, txSignature, txVerification }) {
    await prisma.playerJoin.upsert({
      where: { lobbyId_player: { lobbyId: lobby.lobbyId, player } },
      create: {
        lobbyId: lobby.lobbyId,
        matchId: lobby.matchId,
        player,
        txSignature: txSignature || null,
        txVerified: Boolean(txVerification?.verified),
        txSlot: txVerification?.slot ? BigInt(txVerification.slot) : null,
        txConfirmation: txVerification?.confirmationStatus || null,
        entryFeeLamports: BigInt(lobby.entryFeeLamports),
      },
      update: {
        matchId: lobby.matchId,
        txSignature: txSignature || null,
        txVerified: Boolean(txVerification?.verified),
        txSlot: txVerification?.slot ? BigInt(txVerification.slot) : null,
        txConfirmation: txVerification?.confirmationStatus || null,
        entryFeeLamports: BigInt(lobby.entryFeeLamports),
      },
    });
  }

  async joinLobby({ lobbyId, player, ws, txSignature }) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error('Lobby not found');
    if (!player) throw new Error('Player wallet is required');
    if (lobby.status !== 'waiting') throw new Error('Lobby is not waiting for players');

    const txVerification = await this.verifyJoinTxIfNeeded(txSignature);
    const existing = lobby.players.find((item) => item.player === player);

    if (!existing) {
      if (lobby.players.length >= lobby.maxPlayers) throw new Error('Lobby is full');
      lobby.players.push({
        player,
        txSignature: txSignature || null,
        txVerified: Boolean(txVerification?.verified),
        joinedAt: new Date().toISOString(),
        score: 0,
      });
    } else if (txSignature) {
      existing.txSignature = txSignature;
      existing.txVerified = Boolean(txVerification?.verified);
    }

    await this.persistPlayerJoin({ lobby, player, txSignature, txVerification })
      .catch((err) => console.warn('Could not persist player join:', err.message));
    await this.persistLobbySnapshot(lobby)
      .catch((err) => console.warn('Lobby update failed:', err.message));

    if (ws) this.attachSocket(ws, lobbyId, player);

    this.broadcast(lobbyId, { type: 'lobby_update', lobby: this.publicLobby(lobby) });

    if (lobby.players.length >= lobby.maxPlayers) {
      await this.startMatch(lobbyId);
    }

    return this.publicLobby(lobby);
  }


  async cancelLobby({ lobbyId, player, txSignature }) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error('Lobby not found');
    if (!player) throw new Error('Player wallet is required');
    if (lobby.host !== player) throw new Error('Only the lobby host can cancel');
    if (lobby.status !== 'waiting') throw new Error('Only waiting lobbies can be cancelled');
    const requireOnchainEscrow = process.env.REQUIRE_ONCHAIN_ESCROW === 'true';
    if (requireOnchainEscrow && !txSignature) throw new Error('Cancel/refund transaction signature is required');

    let txVerification = null;
    if (txSignature) {
      txVerification = await verifyTransactionSignature(txSignature);
      if (!txVerification.verified) {
        throw new Error(txVerification.reason || 'Cancel/refund transaction could not be verified');
      }
    }

    lobby.status = 'cancelled';
    lobby.cancelTxSignature = txSignature;
    lobby.cancelledAt = new Date().toISOString();

    await prisma.playerJoin.updateMany({
      where: { lobbyId: lobby.lobbyId },
      data: {
        refunded: Boolean(txSignature),
        refundTxSignature: txSignature || null,
      },
    }).catch((err) => console.warn('Could not persist lobby refunds:', err.message));

    await this.persistLobbySnapshot(lobby)
      .catch((err) => console.warn('Lobby cancel update failed:', err.message));

    this.broadcast(lobbyId, { type: 'lobby_cancelled', lobby: this.publicLobby(lobby), txSignature });
    return this.publicLobby(lobby);
  }

  async addBotToLobby(lobbyId, name = 'DemoRival') {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error('Lobby not found');
    if (lobby.status !== 'waiting') throw new Error('Lobby is not waiting for players');
    if (lobby.players.length >= lobby.maxPlayers) throw new Error('Lobby is full');

    const player = `bot:${name}:${crypto.randomUUID().slice(0, 6)}`;
    lobby.players.push({
      player,
      txSignature: null,
      txVerified: false,
      joinedAt: new Date().toISOString(),
      score: 0,
      bot: true,
    });

    await this.persistLobbySnapshot(lobby)
      .catch((err) => console.warn('Lobby bot update failed:', err.message));

    this.broadcast(lobbyId, { type: 'lobby_update', lobby: this.publicLobby(lobby) });

    if (lobby.players.length >= lobby.maxPlayers) {
      await this.startMatch(lobbyId);
    }

    return this.publicLobby(lobby);
  }

  async startMatch(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error('Lobby not found');
    if (lobby.status !== 'waiting') return this.publicLobby(lobby);
    if (lobby.players.length < 2) throw new Error('At least 2 players are required');

    const matchId = lobby.matchId || crypto.randomUUID();
    const questions = await getQuestionsForMatch({ topic: lobby.topic, count: lobby.questionCount });

    lobby.status = 'playing';
    lobby.matchId = matchId;
    lobby.match = {
      matchId,
      questions,
      currentIndex: -1,
      questionStartedAt: null,
      answersByQuestion: new Map(),
      scores: new Map(lobby.players.map(({ player }) => [player, 0])),
      timer: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
    };

    await snapshotMatchQuestions(matchId, questions);
    await this.persistLobbySnapshot(lobby).catch((err) => console.warn('Lobby start update failed:', err.message));
    await prisma.playerJoin.updateMany({
      where: { lobbyId: lobby.lobbyId },
      data: { matchId },
    }).catch((err) => console.warn('Could not attach joins to match:', err.message));

    this.broadcast(lobbyId, {
      type: 'match_started',
      lobby: this.publicLobby(lobby),
      matchId,
      players: lobby.players.map(({ player }) => player),
      questionCount: questions.length,
    });

    this.nextQuestion(lobbyId);
    return this.publicLobby(lobby);
  }

  nextQuestion(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || !lobby.match) return;

    const match = lobby.match;
    if (match.timer) clearTimeout(match.timer);

    match.currentIndex += 1;
    if (match.currentIndex >= match.questions.length) {
      this.endMatch(lobbyId).catch((err) => console.error('End match failed:', err));
      return;
    }

    const question = match.questions[match.currentIndex];
    match.questionStartedAt = Date.now();
    match.answersByQuestion.set(match.currentIndex, new Map());

    this.broadcast(lobbyId, {
      type: 'question',
      matchId: match.matchId,
      index: match.currentIndex,
      text: question.text,
      choices: question.choices,
      timeLimitMs: lobby.questionTimeMs,
      startedAt: match.questionStartedAt,
    });

    match.timer = setTimeout(() => this.nextQuestion(lobbyId), lobby.questionTimeMs);
  }

  async submitAnswer({ lobbyId, player, questionIndex, answerIdx }) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || !lobby.match) throw new Error('Match not found');
    if (lobby.status !== 'playing') throw new Error('Match is not active');
    if (!lobby.players.some((item) => item.player === player)) throw new Error('Player is not in lobby');

    const match = lobby.match;
    if (questionIndex !== match.currentIndex) throw new Error('Answer is for the wrong question');

    const elapsedMs = Date.now() - match.questionStartedAt;
    if (elapsedMs > lobby.questionTimeMs) throw new Error('Question timer expired');

    const answers = match.answersByQuestion.get(questionIndex);
    if (answers.has(player)) throw new Error('Player already answered this question');

    const question = match.questions[questionIndex];
    const correct = Number(answerIdx) === question.answerIdx;
    const timeBonus = Math.max(0, Math.ceil((lobby.questionTimeMs - elapsedMs) / 1000) * 10);
    const points = correct ? 100 + timeBonus : 0;

    answers.set(player, { answerIdx: Number(answerIdx), correct, points, answeredAt: new Date().toISOString() });
    match.scores.set(player, (match.scores.get(player) || 0) + points);

    prisma.playerAnswer.create({
      data: {
        matchId: match.matchId,
        player,
        questionId: question.id,
        questionIndex,
        answerIdx: Number(answerIdx),
        correct,
        points,
        responseTimeMs: elapsedMs,
      },
    }).catch((err) => console.warn('Could not persist player answer:', err.message));

    const scores = this.formatScores(match);
    this.broadcast(lobbyId, { type: 'score_update', matchId: match.matchId, scores });

    if (answers.size >= lobby.players.length) {
      if (match.timer) clearTimeout(match.timer);
      match.timer = setTimeout(() => this.nextQuestion(lobbyId), 150);
    }

    return { correct, points, scores };
  }

  formatScores(match) {
    return [...match.scores.entries()]
      .map(([player, score]) => ({ player, score }))
      .sort((a, b) => b.score - a.score || a.player.localeCompare(b.player));
  }

  async endMatch(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || !lobby.match || lobby.status === 'finished') return;

    const match = lobby.match;
    if (match.timer) clearTimeout(match.timer);

    lobby.status = 'finished';
    match.endedAt = new Date().toISOString();

    const scores = this.formatScores(match);
    const winner = scores[0]?.player || lobby.players[0].player;
    const totalPot = BigInt(lobby.entryFeeLamports) * BigInt(lobby.players.length);
    const treasuryFeeBps = BigInt(process.env.TREASURY_FEE_BPS || '500');
    const treasuryFeeLamports = (totalPot * treasuryFeeBps) / 10000n;
    const payoutLamports = totalPot - treasuryFeeLamports;

    const resultPayload = {
      matchId: match.matchId,
      lobbyId: lobby.lobbyId,
      lobbyIdHash: lobby.lobbyIdHash,
      winner,
      payoutLamports: payoutLamports.toString(),
      treasuryFeeLamports: treasuryFeeLamports.toString(),
      totalPotLamports: totalPot.toString(),
      players: lobby.players.map(({ player }) => player),
      scores,
      questionIds: match.questions.map((question) => question.id),
      finishedAt: match.endedAt,
      nonce: crypto.randomUUID(),
    };

    const signedResult = signCanonicalResult(resultPayload);

    await prisma.match.create({
      data: {
        matchId: match.matchId,
        lobbyId: lobby.lobbyId,
        winner,
        prizeLamports: payoutLamports,
        treasuryFeeLamports,
        totalPotLamports: totalPot,
        players: lobby.players.length,
        scores,
        resultPayload,
        resultHash: signedResult.resultHash,
        resultSignature: signedResult.signatureBase64,
        signerPublicKey: signedResult.publicKeyBase64,
        finishedAt: new Date(match.endedAt),
      },
    }).catch((err) => console.warn('Could not persist final match:', err.message));

    await this.persistLobbySnapshot(lobby).catch((err) => console.warn('Lobby finish update failed:', err.message));

    const message = {
      type: 'match_ended',
      matchId: match.matchId,
      lobbyId: lobby.lobbyId,
      lobbyIdHash: lobby.lobbyIdHash,
      winner,
      payoutLamports: payoutLamports.toString(),
      treasuryFeeLamports: treasuryFeeLamports.toString(),
      totalPotLamports: totalPot.toString(),
      scores,
      signedResult,
    };

    this.broadcast(lobbyId, message);
    return message;
  }

  publicLobby(lobby) {
    return {
      lobbyId: lobby.lobbyId,
      lobbyIdHash: lobby.lobbyIdHash,
      host: lobby.host,
      entryFeeLamports: lobby.entryFeeLamports,
      maxPlayers: lobby.maxPlayers,
      questionCount: lobby.questionCount,
      questionTimeMs: lobby.questionTimeMs,
      topic: lobby.topic,
      mode: lobby.mode,
      privacy: lobby.privacy,
      status: lobby.status,
      onchainLobbyPda: lobby.onchainLobbyPda,
      escrowPda: lobby.escrowPda,
      players: lobby.players.map(({ player, joinedAt, txSignature, txVerified, score, bot }) => ({
        player,
        joinedAt,
        txSignature,
        txVerified,
        score,
        bot: Boolean(bot),
      })),
      createdAt: lobby.createdAt,
      matchId: lobby.matchId,
    };
  }
}

export default new GameEngine();
