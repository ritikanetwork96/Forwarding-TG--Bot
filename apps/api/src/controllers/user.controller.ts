import type { Request, Response } from 'express';
import { UserService } from '../services/user.service.js';

export class UserController {
  public static async list(_req: Request, res: Response): Promise<void> {
    const users = await UserService.list();
    res.json(users);
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const user = await UserService.create(req.body, req.user?.role);
    res.status(201).json(user);
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const user = await UserService.update(id, req.body, req.user?.role, req.user?._id?.toString());
    res.json(user);
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const requesterId = req.user?._id?.toString();
    await UserService.delete(id, requesterId);
    res.json({ success: true, message: 'User removed successfully' });
  }
}
