import express from 'express';
import * as controller from '../controllers/matchController.js';

const router = express.Router();

router.get('/:matchId', controller.getMatch);
router.post('/:matchId/claim', controller.recordClaim);

export default router;
