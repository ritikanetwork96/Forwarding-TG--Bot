import { User } from '../models/user.model.js';
import { hashPassword } from '../utils/crypto.js';
import { formatUserDTO } from './auth.service.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import type { UserDTO } from '@telegram-forwarder/shared';

export class UserService {
  /**
   * List all registered users / administrators
   */
  public static async list(): Promise<UserDTO[]> {
    const users = await User.find().sort({ role: -1, createdAt: 1 });
    return users.map(formatUserDTO);
  }

  /**
   * Create a new administrator / manager account
   */
  public static async create(data: {
    name: string;
    username?: string;
    email?: string;
    password: string;
    role?: 'owner' | 'admin';
    tag?: string | null;
    canManageAdmins?: boolean;
    telegramUserId?: string | null;
  }, requesterRole?: string): Promise<UserDTO> {
    const cleanName = data.name.trim();
    const emailPrefix = data.email ? (data.email.split('@')[0] || '') : '';
    const rawUsername = (data.username || emailPrefix || data.name).toLowerCase().trim();
    const cleanUsername = rawUsername.replace(/\s+/g, '');
    const cleanEmail = (data.email || `${cleanUsername}@relay.local`).toLowerCase().trim();

    if (!cleanUsername || !cleanName || !data.password) {
      throw new BadRequestError('Username, name, and password are required');
    }

    if (data.password.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters');
    }

    const existing = await User.findOne({
      $or: [
        { username: cleanUsername },
        { email: cleanEmail },
        { name: { $regex: new RegExp(`^${cleanName}$`, 'i') } },
      ],
    });

    if (existing) {
      throw new ConflictError('A user with this username or name already exists');
    }

    // Privilege escalation protection (SEC-04): Only owner can create owner or grant canManageAdmins
    const isOwner = requesterRole === 'owner';
    const assignedRole = isOwner && data.role === 'owner' ? 'owner' : 'admin';
    const assignedCanManage = isOwner ? Boolean(data.canManageAdmins || data.role === 'owner') : false;

    const passwordHash = await hashPassword(data.password);
    const user = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      name: cleanName,
      passwordHash,
      role: assignedRole,
      tag: data.tag ? data.tag.trim() : 'Manager',
      status: 'active',
      canManageAdmins: assignedCanManage,
      telegramUserId: data.telegramUserId ? data.telegramUserId.trim() : null,
      tokenVersion: 0,
    });

    return formatUserDTO(user);
  }

  /**
   * Update admin details, role, tag, status, or password
   */
  public static async update(
    id: string,
    data: {
      name?: string;
      tag?: string | null;
      role?: 'owner' | 'admin';
      status?: 'active' | 'disabled';
      canManageAdmins?: boolean;
      password?: string;
      telegramUserId?: string | null;
    },
    requesterRole?: string,
    requesterId?: string
  ): Promise<UserDTO> {
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isOwner = requesterRole === 'owner';

    // Privilege escalation defense (SEC-04): Non-owners cannot modify an owner's account
    if (!isOwner && user.role === 'owner' && user._id.toString() !== requesterId) {
      throw new BadRequestError('Permission denied: Non-owners cannot modify an Owner account');
    }

    // Only owner can assign the owner role
    if (data.role !== undefined) {
      if (data.role === 'owner' && !isOwner) {
        throw new BadRequestError('Permission denied: Only the system Owner can promote accounts to Owner');
      }
      user.role = data.role;
    }

    // Only owner can toggle canManageAdmins
    if (data.canManageAdmins !== undefined) {
      if (!isOwner) {
        throw new BadRequestError('Permission denied: Only the system Owner can modify team management privileges');
      }
      user.canManageAdmins = Boolean(data.canManageAdmins || user.role === 'owner');
    }

    if (data.name !== undefined) {
      user.name = data.name.trim();
    }
    if (data.tag !== undefined) {
      user.tag = data.tag ? data.tag.trim() : null;
    }
    if (data.telegramUserId !== undefined) {
      user.telegramUserId = data.telegramUserId ? data.telegramUserId.trim() : null;
    }
    if (data.status !== undefined) {
      if (user.role === 'owner' && data.status === 'disabled') {
        throw new BadRequestError('The primary Owner account cannot be disabled');
      }
      user.status = data.status;
    }
    if (data.password) {
      if (data.password.length < 8) {
        throw new BadRequestError('Password must be at least 8 characters');
      }
      user.passwordHash = await hashPassword(data.password);
      user.tokenVersion += 1;
    }

    await user.save();
    return formatUserDTO(user);
  }

  /**
   * Delete an admin account
   */
  public static async delete(id: string, requesterId?: string): Promise<void> {
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.role === 'owner') {
      throw new BadRequestError('The primary Owner account cannot be deleted');
    }

    if (requesterId && user._id.toString() === requesterId) {
      throw new BadRequestError('You cannot delete your own active account');
    }

    await User.deleteOne({ _id: id });
  }
}
