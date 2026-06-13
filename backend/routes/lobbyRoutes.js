import express from 'express';
import * as controller from '../controllers/lobbyController.js';

const router = express.Router();

router.get('/', controller.listLobbies);
router.post('/', controller.createLobby);
router.post('/matchmake', controller.findMatch);
router.get('/:lobbyId', controller.getLobby);
router.post('/:lobbyId/start', controller.startLobby);

export default router;
