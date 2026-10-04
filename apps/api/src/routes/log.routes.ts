import { Router } from 'express';
import { LogController } from '../controllers/log.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(LogController.list));
router.get('/:id', asyncHandler(LogController.getById));

export { router as logRouter };
