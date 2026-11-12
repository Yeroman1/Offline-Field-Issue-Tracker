import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  validateTransition,
  getNextAllowedStatuses,
} from '../lib/statusMachine';

describe('statusMachine', () => {
  it('allows valid transition: draft -> submitted', () => {
    expect(isValidTransition('draft', 'submitted')).toBe(true);
    expect(() => validateTransition('draft', 'submitted')).not.toThrow();
  });

  it('allows valid transitions: submitted -> assigned, rejected', () => {
    expect(isValidTransition('submitted', 'assigned')).toBe(true);
    expect(isValidTransition('submitted', 'rejected')).toBe(true);
    expect(() => validateTransition('submitted', 'assigned')).not.toThrow();
    expect(() => validateTransition('submitted', 'rejected')).not.toThrow();
  });

  it('allows valid transitions: assigned -> in_progress, rejected', () => {
    expect(isValidTransition('assigned', 'in_progress')).toBe(true);
    expect(isValidTransition('assigned', 'rejected')).toBe(true);
    expect(() => validateTransition('assigned', 'in_progress')).not.toThrow();
    expect(() => validateTransition('assigned', 'rejected')).not.toThrow();
  });

  it('allows valid transitions: in_progress -> resolved, assigned', () => {
    expect(isValidTransition('in_progress', 'resolved')).toBe(true);
    expect(isValidTransition('in_progress', 'assigned')).toBe(true);
    expect(() => validateTransition('in_progress', 'resolved')).not.toThrow();
    expect(() => validateTransition('in_progress', 'assigned')).not.toThrow();
  });

  it('allows valid transition: rejected -> submitted (reopening)', () => {
    expect(isValidTransition('rejected', 'submitted')).toBe(true);
    expect(() => validateTransition('rejected', 'submitted')).not.toThrow();
  });

  it('allows valid transition: resolved -> in_progress (rework)', () => {
    expect(isValidTransition('resolved', 'in_progress')).toBe(true);
    expect(() => validateTransition('resolved', 'in_progress')).not.toThrow();
  });

  it('allows identical status transition as idempotent no-op', () => {
    expect(isValidTransition('in_progress', 'in_progress')).toBe(true);
    expect(() => validateTransition('in_progress', 'in_progress')).not.toThrow();
  });

  it('rejects invalid transitions and throws descriptive errors', () => {
    // draft cannot jump straight to resolved
    expect(isValidTransition('draft', 'resolved')).toBe(false);
    expect(() => validateTransition('draft', 'resolved')).toThrow(
      /Invalid status transition from 'draft' to 'resolved'/
    );

    // submitted cannot jump straight to resolved
    expect(isValidTransition('submitted', 'resolved')).toBe(false);
    expect(() => validateTransition('submitted', 'resolved')).toThrow(
      /Invalid status transition from 'submitted' to 'resolved'/
    );

    // resolved cannot jump straight to submitted
    expect(isValidTransition('resolved', 'submitted')).toBe(false);
    expect(() => validateTransition('resolved', 'submitted')).toThrow(
      /Invalid status transition from 'resolved' to 'submitted'/
    );

    // rejected cannot jump to in_progress directly
    expect(isValidTransition('rejected', 'in_progress')).toBe(false);
    expect(() => validateTransition('rejected', 'in_progress')).toThrow(
      /Invalid status transition from 'rejected' to 'in_progress'/
    );
  });

  it('getNextAllowedStatuses returns correct array', () => {
    expect(getNextAllowedStatuses('draft')).toEqual(['submitted']);
    expect(getNextAllowedStatuses('submitted')).toEqual(['assigned', 'rejected']);
    expect(getNextAllowedStatuses('assigned')).toEqual(['in_progress', 'rejected']);
    expect(getNextAllowedStatuses('in_progress')).toEqual(['resolved', 'assigned']);
    expect(getNextAllowedStatuses('rejected')).toEqual(['submitted']);
    expect(getNextAllowedStatuses('resolved')).toEqual(['in_progress']);
  });
});
