import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const userRouter: Router = Router();

userRouter.use(authenticate);

userRouter.use((req, res, next) => {
  if (req.user?.role === 'owner' || req.user?.canManageAdmins === true) {
    return next();
  }
  return res.status(403).json({
    status: 'error',
    message: 'Access denied: Only system owner or authorized administrators can manage team access',
  });
});

userRouter.get('/', asyncHandler(UserController.list));
userRouter.post('/', asyncHandler(UserController.create));
userRouter.patch('/:id', asyncHandler(UserController.update));
userRouter.delete('/:id', asyncHandler(UserController.delete));
