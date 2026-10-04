import { Router } from 'express';
import { QueueController } from '../controllers/queue.controller.js';

const router = Router();

/**
 * @route   GET /api/queue/status
 * @desc    Get BullMQ publish queue and Redis operational status
 * @access  Public / Authenticated
 */
router.get('/status', QueueController.getStatus);

export { router as queueRouter };
