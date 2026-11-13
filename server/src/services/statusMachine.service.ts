import { ReportStatus } from '../types';
import { BusinessRuleError } from '../utils/errors.util';

/**
 * Valid Finite State Transitions for NilePixel Issue Reports.
 * 
 * Life Cycle:
 * DRAFT -> SUBMITTED
 * SUBMITTED -> ASSIGNED | REJECTED
 * ASSIGNED -> IN_PROGRESS | REJECTED
 * IN_PROGRESS -> RESOLVED | ASSIGNED
 * REJECTED -> SUBMITTED (Resubmission after remediation)
 * RESOLVED -> IN_PROGRESS (Reopened due to recurring defect)
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  [ReportStatus.DRAFT]: [ReportStatus.SUBMITTED],
  [ReportStatus.SUBMITTED]: [ReportStatus.ASSIGNED, ReportStatus.REJECTED],
  [ReportStatus.ASSIGNED]: [ReportStatus.IN_PROGRESS, ReportStatus.REJECTED],
  [ReportStatus.IN_PROGRESS]: [ReportStatus.RESOLVED, ReportStatus.ASSIGNED],
  [ReportStatus.REJECTED]: [ReportStatus.SUBMITTED],
  [ReportStatus.RESOLVED]: [ReportStatus.IN_PROGRESS],
};

/**
 * Validates if transitioning from currentStatus to targetStatus is permitted.
 * Throws BusinessRuleError (HTTP 422) if transition is unlawful.
 */
export function validateStatusTransition(
  currentStatusRaw: string,
  targetStatusRaw: string
): { isValid: boolean; currentStatus: ReportStatus; targetStatus: ReportStatus } {
  const current = currentStatusRaw.toUpperCase() as ReportStatus;
  const target = targetStatusRaw.toUpperCase() as ReportStatus;

  const validTargets = ALLOWED_STATUS_TRANSITIONS[current] || [];

  if (!validTargets.includes(target)) {
    throw new BusinessRuleError(
      `Invalid report status transition from '${current}' to '${target}'. Allowed transitions: [${validTargets.join(', ')}]`,
      'INVALID_STATUS_TRANSITION',
      {
        currentStatus: current,
        targetStatus: target,
        allowedTransitions: validTargets,
      }
    );
  }

  return { isValid: true, currentStatus: current, targetStatus: target };
}

/**
 * Returns allowed next statuses for a given status.
 */
export function getAllowedNextStatuses(statusRaw: string): ReportStatus[] {
  const status = statusRaw.toUpperCase() as ReportStatus;
  return ALLOWED_STATUS_TRANSITIONS[status] || [];
}

