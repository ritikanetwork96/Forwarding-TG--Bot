import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService, formatUserDTO } from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.js';

export const loginSchema = z
  .object({
    email: z.string().email().optional(),
    login: z.string().optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((data) => Boolean(data.email || data.login), {
    message: 'Valid username or email identifier is required',
  })
  .transform((data) => ({
    email: (data.email || data.login) as string,
    password: data.password,
  }));

export const resetRequestSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
});

export const resetVerifySchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  otp: z.string().min(6, 'OTP must be at least 6 digits').max(8),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export class AuthController {
  public static async login(req: Request, res: Response): Promise<void> {
    const validated = loginSchema.parse(req.body);
    const result = await AuthService.login(validated);
    sendSuccess(res, result, 'Login successful', 200);
  }

  public static async requestTelegramReset(req: Request, res: Response): Promise<void> {
    const validated = resetRequestSchema.parse(req.body);
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const result = await AuthService.requestTelegramPasswordReset(validated.identifier, clientIp);
    sendSuccess(res, result, result.message, 200);
  }

  public static async verifyTelegramReset(req: Request, res: Response): Promise<void> {
    const validated = resetVerifySchema.parse(req.body);
    const result = await AuthService.verifyTelegramPasswordReset(validated);
    sendSuccess(res, result, result.message, 200);
  }

  public static async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }
    sendSuccess(res, formatUserDTO(req.user), 'User profile retrieved');
  }

  public static async logout(req: Request, res: Response): Promise<void> {
    if (req.user) {
      await AuthService.logout(req.user._id.toString());
    }
    sendSuccess(res, null, 'Logged out successfully');
  }
}
