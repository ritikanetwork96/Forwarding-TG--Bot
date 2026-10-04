import { Router } from 'express';
import { ScheduleController } from '../controllers/schedule.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize('owner', 'admin'), asyncHandler(ScheduleController.create));
router.get('/', authorize('owner', 'admin'), asyncHandler(ScheduleController.list));
router.get('/stats', authorize('owner', 'admin'), asyncHandler(ScheduleController.getStats));
router.get('/:id', authorize('owner', 'admin'), asyncHandler(ScheduleController.getById));
router.put('/:id', authorize('owner', 'admin'), asyncHandler(ScheduleController.update));
router.post('/:id/cancel', authorize('owner', 'admin'), asyncHandler(ScheduleController.cancel));
router.post(
  '/:id/publish-now',
  authorize('owner', 'admin'),
  asyncHandler(ScheduleController.publishNow)
);

export { router as scheduleRouter };
