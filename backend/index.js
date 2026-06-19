import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';

import lobbyRoutes from './routes/lobbyRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import questionRoutes from './routes/questionRoutes.js';
import signingRoutes from './routes/signingRoutes.js';
import solanaRoutes from './routes/solanaRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import { checkDatabaseConnection } from './services/prisma.js';
import { registerWebSocketServer } from './services/websocketService.js';

const app = express();
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sol-quiz-arena-backend' });
});

app.use('/lobbies', lobbyRoutes);
app.use('/history', historyRoutes);
app.use('/questions', questionRoutes);
app.use('/solana', solanaRoutes);
app.use('/matches', matchRoutes);
app.use('/profiles', profileRoutes);
app.use('/', signingRoutes);

const server = http.createServer(app);
registerWebSocketServer(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  void checkDatabaseConnection();
});
