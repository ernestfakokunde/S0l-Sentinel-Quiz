import express from 'express';
import * as controller from '../controllers/signingController.js';

const router = express.Router();

router.get('/signer', controller.getSigner);
router.post('/match/sign', controller.devSign);

export default router;
