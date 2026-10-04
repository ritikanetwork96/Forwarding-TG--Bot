import { Router } from 'express';
import { PublishController } from '../controllers/publish.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(authenticate);

router.post('/manual', authorize('owner', 'admin'), asyncHandler(PublishController.manual));
router.post(
  '/retry-failed/:messageId',
  authorize('owner', 'admin'),
  asyncHandler(PublishController.retryFailed)
);
router.post(
  '/retry-log/:logId',
  authorize('owner', 'admin'),
  asyncHandler(PublishController.retryLog)
);
router.post(
  '/resend-log/:logId',
  authorize('owner', 'admin'),
  asyncHandler(PublishController.resendLog)
);
router.post(
  '/resend-post/:messageId',
  authorize('owner', 'admin'),
  asyncHandler(PublishController.resendPost)
);

export { router as publishRouter };
