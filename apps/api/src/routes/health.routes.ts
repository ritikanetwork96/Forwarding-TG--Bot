import { Router } from 'express';
import { HealthController } from '../controllers/health.controller.js';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    Basic health check endpoint
 * @access  Public
 */
router.get('/', HealthController.getHealth);

export { router as healthRouter };
