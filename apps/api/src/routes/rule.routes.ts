import { Router } from 'express';
import { RuleController } from '../controllers/rule.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(RuleController.list));
router.post('/', authorize('owner', 'admin'), asyncHandler(RuleController.create));
router.get('/:id', asyncHandler(RuleController.getById));
router.patch('/:id', authorize('owner', 'admin'), asyncHandler(RuleController.update));
router.delete('/:id', authorize('owner', 'admin'), asyncHandler(RuleController.delete));

export { router as ruleRouter };
