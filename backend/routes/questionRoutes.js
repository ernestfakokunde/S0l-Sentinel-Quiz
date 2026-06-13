import express from 'express';
import * as controller from '../controllers/questionController.js';

const router = express.Router();

router.get('/', controller.listQuestions);
router.post('/seed-defaults', controller.seedQuestions);

export default router;
