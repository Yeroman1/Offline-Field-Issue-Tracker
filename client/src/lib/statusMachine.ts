import { ReportStatus } from '../types';

export const VALID_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  draft: ['submitted'],
  submitted: ['assigned', 'rejected'],
  assigned: ['in_progress', 'rejected'],
  in_progress: ['resolved', 'assigned'],
  rejected: ['submitted'],
  resolved: ['in_progress'],
};

export function isValidTransition(from: ReportStatus, to: ReportStatus): boolean {
  if (from === to) return true; // idempotence or no change
  const allowed = VALID_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

export function getNextAllowedStatuses(from: ReportStatus): ReportStatus[] {
  return VALID_TRANSITIONS[from] || [];
}

export function validateTransition(from: ReportStatus, to: ReportStatus): void {
  if (from === to) return;
  if (!isValidTransition(from, to)) {
    const allowed = VALID_TRANSITIONS[from] || [];
    throw new Error(
      `Invalid status transition from '${from}' to '${to}'. Allowed transitions: ${
        allowed.length > 0 ? allowed.join(', ') : 'none'
      }`
    );
  }
}
