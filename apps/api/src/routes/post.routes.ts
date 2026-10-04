import { Router } from 'express';
import { PostController } from '../controllers/post.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(PostController.list));
router.post('/', authorize('owner', 'admin'), asyncHandler(PostController.create));
router.get('/:id', asyncHandler(PostController.getById));
router.patch('/:id', authorize('owner', 'admin'), asyncHandler(PostController.update));
router.delete('/:id', authorize('owner', 'admin'), asyncHandler(PostController.delete));

export { router as postRouter };
