import { Types } from 'mongoose';
import { Category, type ICategory } from '../models/category.model.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { ErrorCodes, type CategoryDTO, type CategoryStatus } from '@telegram-forwarder/shared';

export function formatCategoryDTO(cat: any): CategoryDTO {
  return {
    _id: cat._id.toString(),
    name: cat.name,
    displayName: cat.displayName || undefined,
    iconEmoji: cat.iconEmoji || undefined,
    customEmojiId: cat.customEmojiId || undefined,
    slug: cat.slug,
    description: cat.description,
    icon: cat.icon,
    destinationIds: cat.destinationIds?.map((id: any) => id.toString()) || [],
    status: cat.status,
    deletedAt: cat.deletedAt ? new Date(cat.deletedAt).toISOString() : null,
    createdAt: new Date(cat.createdAt).toISOString(),
    updatedAt: new Date(cat.updatedAt).toISOString(),
  };
}

export class CategoryService {
  public static async list(query: { status?: CategoryStatus } = {}): Promise<CategoryDTO[]> {
    // Auto purge deleted categories older than 48 hours (2 days)
    const purgeThreshold = new Date(Date.now() - 48 * 3600 * 1000);
    await Category.deleteMany({ status: 'deleted', deletedAt: { $lt: purgeThreshold } }).catch(
      () => {}
    );

    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = { $ne: 'deleted' };
    }

    const categories = await Category.find(filter).sort({ name: 1 }).lean();
    return categories.map(formatCategoryDTO);
  }

  public static async getById(id: string): Promise<CategoryDTO> {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    return formatCategoryDTO(category);
  }

  public static async create(data: {
    name: string;
    displayName?: string | null;
    iconEmoji?: string;
    customEmojiId?: string | null;
    slug?: string;
    description?: string;
    icon?: string;
    destinationIds?: string[];
  }): Promise<CategoryDTO> {
    const slug = data.slug
      ? data.slug.toLowerCase().trim()
      : data.name
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');

    const existing = await Category.findOne({ slug });
    if (existing) {
      throw new ConflictError(
        `Category slug '${slug}' is already in use`,
        ErrorCodes.SLUG_ALREADY_EXISTS
      );
    }

    const category = await Category.create({
      name: data.name.trim(),
      displayName: data.displayName ? data.displayName.trim() : null,
      iconEmoji: data.iconEmoji ? data.iconEmoji.trim() : '📁',
      customEmojiId: data.customEmojiId ? data.customEmojiId.trim() : null,
      slug,
      description: data.description?.trim() || '',
      icon: data.icon?.trim() || 'Folder',
      destinationIds: data.destinationIds || [],
      status: 'active',
    });

    return formatCategoryDTO(category);
  }

  public static async update(
    id: string,
    data: {
      name?: string;
      displayName?: string | null;
      iconEmoji?: string;
      customEmojiId?: string | null;
      slug?: string;
      description?: string;
      icon?: string;
      destinationIds?: string[];
      status?: CategoryStatus;
    }
  ): Promise<CategoryDTO> {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    if (data.slug && data.slug !== category.slug) {
      const cleanSlug = data.slug.toLowerCase().trim();
      const conflict = await Category.findOne({ slug: cleanSlug, _id: { $ne: id } });
      if (conflict) {
        throw new ConflictError(
          `Slug '${cleanSlug}' is already in use`,
          ErrorCodes.SLUG_ALREADY_EXISTS
        );
      }
      category.slug = cleanSlug;
    }

    if (data.name !== undefined) category.name = data.name.trim();
    if (data.displayName !== undefined)
      category.displayName = data.displayName?.trim() || undefined;
    if (data.iconEmoji !== undefined) category.iconEmoji = data.iconEmoji?.trim() || '📁';
    if (data.customEmojiId !== undefined)
      category.customEmojiId = data.customEmojiId?.trim() || undefined;
    if (data.description !== undefined) category.description = data.description.trim();
    if (data.icon !== undefined) category.icon = data.icon.trim();
    if (data.destinationIds !== undefined)
      category.destinationIds = data.destinationIds.map((id) => new Types.ObjectId(id)) as unknown as Types.ObjectId[];
    if (data.status !== undefined) category.status = data.status;

    await category.save();
    return formatCategoryDTO(category);
  }

  public static async delete(id: string): Promise<void> {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Soft delete to Trash with 48-hour restorable grace period
    category.status = 'deleted';
    category.deletedAt = new Date();
    await category.save();
  }

  public static async restore(id: string): Promise<CategoryDTO> {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    category.status = 'active';
    category.deletedAt = null;
    await category.save();
    return formatCategoryDTO(category);
  }

  public static async permanentDelete(id: string): Promise<void> {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    await Category.findByIdAndDelete(id);
  }
}
