import { Router } from 'express';
import { DestinationController } from '../controllers/destination.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(DestinationController.list));
router.post('/', authorize('owner', 'admin'), asyncHandler(DestinationController.create));
router.get('/:id', asyncHandler(DestinationController.getById));
router.post('/:id/verify', authorize('owner', 'admin'), asyncHandler(DestinationController.verify));
router.patch('/:id', authorize('owner', 'admin'), asyncHandler(DestinationController.update));
router.delete('/:id', authorize('owner', 'admin'), asyncHandler(DestinationController.delete));

export { router as destinationRouter };
