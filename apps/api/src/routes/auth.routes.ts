import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authLimiter, resetLimiter } from '../middleware/rate-limit.middleware.js';

const router = Router();

// Public Authentication Routes (strictly rate-limited)
router.post('/login', authLimiter, (req, res, next) => {
  AuthController.login(req, res).catch(next);
});

// Out-of-band Telegram 2FA Password Reset
router.post('/telegram-reset/request', resetLimiter, (req, res, next) => {
  AuthController.requestTelegramReset(req, res).catch(next);
});

router.post('/telegram-reset/verify', resetLimiter, (req, res, next) => {
  AuthController.verifyTelegramReset(req, res).catch(next);
});

// Protected Session Routes
router.get('/me', authenticate, (req, res, next) => {
  AuthController.getMe(req, res).catch(next);
});

router.post('/logout', authenticate, (req, res, next) => {
  AuthController.logout(req, res).catch(next);
});

export { router as authRouter };
