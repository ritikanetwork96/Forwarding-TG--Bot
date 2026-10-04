import { ForwardingRule, type IForwardingRule } from '../models/forwarding-rule.model.js';
import { DestinationGroup } from '../models/destination-group.model.js';
import { Destination } from '../models/destination.model.js';
import { Source } from '../models/source.model.js';
import type { PublishMode, WorkflowType } from '@telegram-forwarder/shared';
import { Types } from 'mongoose';
import { logger } from '../utils/logger.js';

export interface ResolvedRuleTarget {
  ruleId: string;
  ruleName: string;
  publishMode: PublishMode;
  workflowType: WorkflowType;
  destinationIds: string[];
}

export class RuleEngineService {
  /**
   * Deterministically evaluates forwarding rules for an ingested message.
   *
   * 1. Matches active rules by sourceId and optional categoryId.
   * 2. Evaluates in descending priority order.
   * 3. Expands Destination Groups into active, verified destinations.
   * 4. Deduplicates destinations so no destination is targeted more than once for a message.
   */
  public static async evaluateMessageRules(
    sourceId: Types.ObjectId,
    categoryId?: Types.ObjectId | null
  ): Promise<ResolvedRuleTarget[]> {
    // 0. Resolve source chat to prevent circular self-forwarding
    const sourceDoc = await Source.findById(sourceId);
    const sourceChatId = sourceDoc?.telegramChatId;

    // 1. Find all active rules for this source or all-source rules, sorted by priority desc, createdAt asc
    const activeRules: IForwardingRule[] = await ForwardingRule.find({
      $or: [{ sourceId }, { sourceId: null }, { sourceId: { $exists: false } }],
      isActive: true,
    }).sort({ priority: -1, createdAt: 1 });

    if (activeRules.length === 0) {
      return [];
    }

    // 2. Filter rules by category
    const matchingRules = activeRules.filter((rule) => {
      if (!rule.categoryId) {
        // Rule without specific category matches all messages from this source
        return true;
      }
      if (!categoryId) {
        // Message has no category, but rule requires a specific category
        return false;
      }
      return rule.categoryId.toString() === categoryId.toString();
    });

    if (matchingRules.length === 0) {
      return [];
    }

    const resolvedTargets: ResolvedRuleTarget[] = [];
    const assignedDestinationIds = new Set<string>();

    for (const rule of matchingRules) {
      // Collect direct destination IDs
      const rawDestinationIds = new Set<string>(
        (rule.destinationIds || []).map((id) => id.toString())
      );

      // Expand Destination Groups
      if (rule.destinationGroupIds && rule.destinationGroupIds.length > 0) {
        const activeGroups = await DestinationGroup.find({
          _id: { $in: rule.destinationGroupIds },
          status: 'active',
        });

        for (const group of activeGroups) {
          for (const destId of group.destinationIds || []) {
            rawDestinationIds.add(destId.toString());
          }
        }
      }

      // Remove destinations already claimed by higher-priority rules
      const unassignedDestIds: string[] = [];
      for (const destId of rawDestinationIds) {
        if (!assignedDestinationIds.has(destId)) {
          unassignedDestIds.push(destId);
        }
      }

      if (unassignedDestIds.length === 0) {
        continue;
      }

      // Query database to ensure active status and non-restricted verification
      const destFilter: any = {
        _id: { $in: unassignedDestIds },
        status: 'active',
        'verification.canPublish': { $ne: false },
      };
      if (sourceChatId) {
        destFilter.telegramChatId = { $ne: sourceChatId };
      }

      const validDestinations = await Destination.find(destFilter);

      const eligibleDestinationIds = validDestinations.map((d) => d._id.toString());

      if (eligibleDestinationIds.length > 0) {
        // Claim these destinations
        for (const id of eligibleDestinationIds) {
          assignedDestinationIds.add(id);
        }

        resolvedTargets.push({
          ruleId: rule._id.toString(),
          ruleName: rule.name,
          publishMode: rule.publishMode,
          workflowType: rule.workflowType,
          destinationIds: eligibleDestinationIds,
        });

        logger.debug(
          `Rule [${rule.name}] matched: ${eligibleDestinationIds.length} verified destinations resolved`
        );
      }
    }

    return resolvedTargets;
  }
}
