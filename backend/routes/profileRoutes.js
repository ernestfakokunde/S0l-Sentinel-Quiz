import express from 'express';
import * as controller from '../controllers/profileController.js';

const router = express.Router();

router.get('/:wallet', controller.readProfile);
router.put('/:wallet', controller.saveProfile);

export default router;
