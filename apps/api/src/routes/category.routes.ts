import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// All category routes require authentication
router.use(authenticate);

router.get('/', asyncHandler(CategoryController.list));
router.post('/', asyncHandler(CategoryController.create));
router.get('/:id', asyncHandler(CategoryController.getById));
router.patch('/:id', asyncHandler(CategoryController.update));
router.delete('/:id', asyncHandler(CategoryController.delete));
router.post('/:id/restore', asyncHandler(CategoryController.restore));
router.delete('/:id/permanent', asyncHandler(CategoryController.permanentDelete));

export { router as categoryRouter };

