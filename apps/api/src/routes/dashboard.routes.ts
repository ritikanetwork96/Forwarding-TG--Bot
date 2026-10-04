import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// Protect dashboard route with standard authentication
router.use(authenticate);

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get aggregated executive KPI metrics, upcoming schedules, activity and health
 * @access  Authenticated (Admin / Owner)
 */
router.get('/stats', asyncHandler(DashboardController.getStats));

export { router as dashboardRouter };
