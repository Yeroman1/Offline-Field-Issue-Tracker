export type ReportStatus =
  | 'draft'
  | 'submitted'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected';

export class StatusTransitionError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'StatusTransitionError';
    this.statusCode = 422;
    Object.setPrototypeOf(this, StatusTransitionError.prototype);
  }
}

export const VALID_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  draft: ['submitted'],
  submitted: ['assigned', 'rejected'],
  assigned: ['in_progress', 'rejected'],
  in_progress: ['resolved', 'assigned'],
  rejected: ['submitted'],
  resolved: ['in_progress'],
};

export function isValidStatus(status: string): status is ReportStatus {
  return ['draft', 'submitted', 'assigned', 'in_progress', 'resolved', 'rejected'].includes(
    status
  );
}

export function canTransition(current: string, next: string): boolean {
  if (!isValidStatus(current) || !isValidStatus(next)) {
    return false;
  }
  const allowed = VALID_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

export function validateTransition(current: string, next: string): void {
  if (!canTransition(current, next)) {
    const allowed = isValidStatus(current) ? VALID_TRANSITIONS[current] : [];
    throw new StatusTransitionError(
      `Invalid status transition from '${current}' to '${next}'. Allowed transitions: ${
        allowed.length > 0 ? allowed.join(', ') : 'none'
      }`
    );
  }
}

