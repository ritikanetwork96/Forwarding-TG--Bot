import { DestinationGroup, type IDestinationGroup } from '../models/destination-group.model.js';
import { Destination } from '../models/destination.model.js';
import { ForwardingRule } from '../models/forwarding-rule.model.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { formatDestinationDTO } from './destination.service.js';
import {
  ErrorCodes,
  type DestinationGroupDTO,
  type DestinationGroupWithDestinationsDTO,
  type DestinationGroupStatus,
  type DestinationDTO,
} from '@telegram-forwarder/shared';
import { Types } from 'mongoose';

export function formatDestinationGroupDTO(group: IDestinationGroup): DestinationGroupDTO {
  return {
    _id: group._id.toString(),
    name: group.name,
    description: group.description ?? null,
    destinationIds: (group.destinationIds || []).map((id) => id.toString()),
    status: group.status,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

export class DestinationGroupService {
  /**
   * Resolves a collection of individual destinationIds and destinationGroupIds
   * into a deduplicated list of Destination ObjectIds.
   */
  public static async resolveTargets(params: {
    destinationIds?: string[];
    destinationGroupIds?: string[];
  }): Promise<Types.ObjectId[]> {
    const targetIdSet = new Set<string>();

    if (params.destinationIds && params.destinationIds.length > 0) {
      for (const id of params.destinationIds) {
        if (id && Types.ObjectId.isValid(id)) {
          targetIdSet.add(id);
        }
      }
    }

    if (params.destinationGroupIds && params.destinationGroupIds.length > 0) {
      const validGroupIds = params.destinationGroupIds
        .filter((id) => id && Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));

      if (validGroupIds.length > 0) {
        const groups = await DestinationGroup.find({
          _id: { $in: validGroupIds },
          status: 'active',
        });
        for (const grp of groups) {
          for (const dId of grp.destinationIds || []) {
            targetIdSet.add(dId.toString());
          }
        }
      }
    }

    return Array.from(targetIdSet).map((id) => new Types.ObjectId(id));
  }

  public static async list(
    query: { status?: DestinationGroupStatus } = {}
  ): Promise<DestinationGroupDTO[]> {
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    }

    const groups = await DestinationGroup.find(filter).sort({ createdAt: -1 });
    return groups.map(formatDestinationGroupDTO);
  }

  public static async listWithDestinations(
    query: { status?: DestinationGroupStatus } = {}
  ): Promise<DestinationGroupWithDestinationsDTO[]> {
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    }

    const groups = await DestinationGroup.find(filter).sort({ createdAt: -1 });
    const allDestIds = new Set<string>();
    for (const g of groups) {
      for (const dId of g.destinationIds || []) {
        allDestIds.add(dId.toString());
      }
    }

    const dests = await Destination.find({ _id: { $in: Array.from(allDestIds) } });
    const destMap = new Map<string, DestinationDTO>();
    for (const d of dests) {
      destMap.set(d._id.toString(), formatDestinationDTO(d));
    }

    return groups.map((g) => {
      const base = formatDestinationGroupDTO(g);
      const memberDests = (g.destinationIds || [])
        .map((id) => destMap.get(id.toString()))
        .filter((d): d is DestinationDTO => d !== undefined);

      const activeCount = memberDests.filter(
        (d) => d.status === 'active' && d.verification?.canPublish
      ).length;

      return {
        ...base,
        destinations: memberDests,
        destinationCount: memberDests.length,
        activeCount,
      };
    });
  }

  public static async getById(id: string): Promise<DestinationGroupDTO> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Destination group not found');
    }
    const group = await DestinationGroup.findById(id);
    if (!group) {
      throw new NotFoundError('Destination group not found');
    }
    return formatDestinationGroupDTO(group);
  }

  public static async create(data: {
    name: string;
    description?: string | null;
    destinationIds?: string[];
  }): Promise<DestinationGroupDTO> {
    const cleanName = data.name.trim();

    const destinationObjectIds: Types.ObjectId[] = [];
    if (data.destinationIds && data.destinationIds.length > 0) {
      // Validate that destinations exist
      const dests = await Destination.find({ _id: { $in: data.destinationIds } });
      if (dests.length !== data.destinationIds.length) {
        throw new BadRequestError(
          'One or more destination IDs are invalid',
          ErrorCodes.VALIDATION_ERROR
        );
      }
      destinationObjectIds.push(...data.destinationIds.map((id) => new Types.ObjectId(id)));
    }

    const group = await DestinationGroup.create({
      name: cleanName,
      description: data.description ? data.description.trim() : null,
      destinationIds: destinationObjectIds,
      status: 'active',
    });

    return formatDestinationGroupDTO(group);
  }

  public static async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      destinationIds?: string[];
      status?: DestinationGroupStatus;
    }
  ): Promise<DestinationGroupDTO> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Destination group not found');
    }

    const group = await DestinationGroup.findById(id);
    if (!group) {
      throw new NotFoundError('Destination group not found');
    }

    if (data.name !== undefined) group.name = data.name.trim();
    if (data.description !== undefined) {
      group.description = data.description ? data.description.trim() : null;
    }
    if (data.status !== undefined) group.status = data.status;

    if (data.destinationIds !== undefined) {
      if (data.destinationIds.length > 0) {
        const dests = await Destination.find({ _id: { $in: data.destinationIds } });
        if (dests.length !== data.destinationIds.length) {
          throw new BadRequestError(
            'One or more destination IDs are invalid',
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }
      group.destinationIds = data.destinationIds.map((destId) => new Types.ObjectId(destId));
    }

    await group.save();
    return formatDestinationGroupDTO(group);
  }

  public static async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Destination group not found');
    }
    const group = await DestinationGroup.findById(id);
    if (!group) {
      throw new NotFoundError('Destination group not found');
    }
    await DestinationGroup.findByIdAndDelete(id);

    // Referential integrity: remove deleted group ID from any ForwardingRule referencing it
    await ForwardingRule.updateMany(
      { destinationGroupIds: group._id },
      { $pull: { destinationGroupIds: group._id } }
    );
  }
}
