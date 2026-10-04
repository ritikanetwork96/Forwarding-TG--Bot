import { ForwardingRule, type IForwardingRule } from '../models/forwarding-rule.model.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import {
  type ForwardingRuleDTO,
  type PublishMode,
  type WorkflowType,
  ErrorCodes,
} from '@telegram-forwarder/shared';
import { Types } from 'mongoose';

export function formatRuleDTO(rule: IForwardingRule): ForwardingRuleDTO {
  return {
    _id: rule._id.toString(),
    name: rule.name,
    sourceId: rule.sourceId ? rule.sourceId.toString() : '',
    categoryId: rule.categoryId ? rule.categoryId.toString() : null,
    destinationIds: (rule.destinationIds || []).map((id) => id.toString()),
    destinationGroupIds: (rule.destinationGroupIds || []).map((id) => id.toString()),
    publishMode: rule.publishMode,
    workflowType: rule.workflowType,
    isActive: rule.isActive,
    priority: rule.priority,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export class RuleService {
  public static async list(
    query: { sourceId?: string; isActive?: boolean } = {}
  ): Promise<ForwardingRuleDTO[]> {
    const filter: Record<string, unknown> = {};
    if (query.sourceId && Types.ObjectId.isValid(query.sourceId)) {
      filter.sourceId = new Types.ObjectId(query.sourceId);
    }
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    const rules = await ForwardingRule.find(filter).sort({ priority: -1, createdAt: -1 });
    return rules.map(formatRuleDTO);
  }

  public static async getById(id: string): Promise<ForwardingRuleDTO> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Forwarding rule not found');
    }
    const rule = await ForwardingRule.findById(id);
    if (!rule) {
      throw new NotFoundError('Forwarding rule not found');
    }
    return formatRuleDTO(rule);
  }

  public static async create(data: {
    name: string;
    sourceId: string;
    categoryId?: string | null;
    destinationIds?: string[];
    destinationGroupIds?: string[];
    publishMode?: PublishMode;
    workflowType?: WorkflowType;
    isActive?: boolean;
    priority?: number;
  }): Promise<ForwardingRuleDTO> {
    const destIds = data.destinationIds || [];
    const groupIds = data.destinationGroupIds || [];

    if (destIds.length === 0 && groupIds.length === 0) {
      throw new BadRequestError(
        'At least one destination or destination group is required',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const rule = await ForwardingRule.create({
      name: data.name.trim(),
      sourceId: new Types.ObjectId(data.sourceId),
      categoryId: data.categoryId ? new Types.ObjectId(data.categoryId) : null,
      destinationIds: destIds.map((id) => new Types.ObjectId(id)),
      destinationGroupIds: groupIds.map((id) => new Types.ObjectId(id)),
      publishMode: data.publishMode || 'copy',
      workflowType: data.workflowType || 'manual_approval',
      isActive: data.isActive !== undefined ? data.isActive : true,
      priority: data.priority !== undefined ? data.priority : 0,
    });

    return formatRuleDTO(rule);
  }

  public static async update(
    id: string,
    data: {
      name?: string;
      sourceId?: string;
      categoryId?: string | null;
      destinationIds?: string[];
      destinationGroupIds?: string[];
      publishMode?: PublishMode;
      workflowType?: WorkflowType;
      isActive?: boolean;
      priority?: number;
    }
  ): Promise<ForwardingRuleDTO> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Forwarding rule not found');
    }
    const rule = await ForwardingRule.findById(id);
    if (!rule) {
      throw new NotFoundError('Forwarding rule not found');
    }

    if (data.name !== undefined) rule.name = data.name.trim();
    if (data.sourceId !== undefined) rule.sourceId = new Types.ObjectId(data.sourceId);
    if (data.categoryId !== undefined) {
      rule.categoryId = data.categoryId ? new Types.ObjectId(data.categoryId) : null;
    }
    if (data.destinationIds !== undefined) {
      rule.destinationIds = data.destinationIds.map((destId) => new Types.ObjectId(destId));
    }
    if (data.destinationGroupIds !== undefined) {
      rule.destinationGroupIds = data.destinationGroupIds.map((grpId) => new Types.ObjectId(grpId));
    }
    if (data.publishMode !== undefined) rule.publishMode = data.publishMode;
    if (data.workflowType !== undefined) rule.workflowType = data.workflowType;
    if (data.isActive !== undefined) rule.isActive = data.isActive;
    if (data.priority !== undefined) rule.priority = data.priority;

    await rule.save();
    return formatRuleDTO(rule);
  }

  public static async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Forwarding rule not found');
    }
    const rule = await ForwardingRule.findById(id);
    if (!rule) {
      throw new NotFoundError('Forwarding rule not found');
    }
    await ForwardingRule.findByIdAndDelete(id);
  }
}
