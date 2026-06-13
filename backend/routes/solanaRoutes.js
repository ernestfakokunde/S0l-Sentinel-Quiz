import express from 'express';
import * as controller from '../controllers/solanaController.js';

const router = express.Router();

router.get('/rpc', controller.getRpcStatus);
router.post('/transactions/verify', controller.verifyTransaction);

export default router;
