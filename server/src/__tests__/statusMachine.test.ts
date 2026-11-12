import { describe, it, expect } from 'vitest';
import {
  canTransition,
  validateTransition,
  StatusTransitionError,
  VALID_TRANSITIONS,
  ReportStatus,
} from '../lib/statusMachine';

describe('Status Machine Transitions', () => {
  describe('Valid transitions', () => {
    it('allows draft -> submitted', () => {
      expect(canTransition('draft', 'submitted')).toBe(true);
      expect(() => validateTransition('draft', 'submitted')).not.toThrow();
    });

    it('allows submitted -> assigned and rejected', () => {
      expect(canTransition('submitted', 'assigned')).toBe(true);
      expect(canTransition('submitted', 'rejected')).toBe(true);
      expect(() => validateTransition('submitted', 'assigned')).not.toThrow();
      expect(() => validateTransition('submitted', 'rejected')).not.toThrow();
    });

    it('allows assigned -> in_progress and rejected', () => {
      expect(canTransition('assigned', 'in_progress')).toBe(true);
      expect(canTransition('assigned', 'rejected')).toBe(true);
      expect(() => validateTransition('assigned', 'in_progress')).not.toThrow();
      expect(() => validateTransition('assigned', 'rejected')).not.toThrow();
    });

    it('allows in_progress -> resolved and assigned', () => {
      expect(canTransition('in_progress', 'resolved')).toBe(true);
      expect(canTransition('in_progress', 'assigned')).toBe(true);
      expect(() => validateTransition('in_progress', 'resolved')).not.toThrow();
      expect(() => validateTransition('in_progress', 'assigned')).not.toThrow();
    });

    it('allows rejected -> submitted (re-submission)', () => {
      expect(canTransition('rejected', 'submitted')).toBe(true);
      expect(() => validateTransition('rejected', 'submitted')).not.toThrow();
    });

    it('allows resolved -> in_progress (re-opening)', () => {
      expect(canTransition('resolved', 'in_progress')).toBe(true);
      expect(() => validateTransition('resolved', 'in_progress')).not.toThrow();
    });
  });

  describe('Invalid transitions', () => {
    const invalidPairs: [string, string][] = [
      ['draft', 'assigned'],
      ['draft', 'in_progress'],
      ['draft', 'resolved'],
      ['draft', 'rejected'],
      ['submitted', 'in_progress'],
      ['submitted', 'resolved'],
      ['submitted', 'draft'],
      ['assigned', 'resolved'],
      ['assigned', 'draft'],
      ['assigned', 'submitted'],
      ['in_progress', 'draft'],
      ['in_progress', 'submitted'],
      ['in_progress', 'rejected'],
      ['rejected', 'assigned'],
      ['rejected', 'in_progress'],
      ['rejected', 'resolved'],
      ['rejected', 'draft'],
      ['resolved', 'draft'],
      ['resolved', 'submitted'],
      ['resolved', 'rejected'],
      ['resolved', 'assigned'],
      ['unknown', 'submitted'],
      ['draft', 'unknown'],
    ];

    invalidPairs.forEach(([from, to]) => {
      it(`disallows transition from ${from} to ${to}`, () => {
        expect(canTransition(from, to)).toBe(false);
        expect(() => validateTransition(from, to)).toThrow(StatusTransitionError);
        try {
          validateTransition(from, to);
        } catch (e: any) {
          expect(e.statusCode).toBe(422);
          expect(e.name).toBe('StatusTransitionError');
        }
      });
    });
  });

  describe('Completeness of transition matrix', () => {
    const statuses: ReportStatus[] = [
      'draft',
      'submitted',
      'assigned',
      'in_progress',
      'resolved',
      'rejected',
    ];

    it('covers all predefined statuses', () => {
      statuses.forEach((st) => {
        expect(VALID_TRANSITIONS[st]).toBeDefined();
        expect(Array.isArray(VALID_TRANSITIONS[st])).toBe(true);
        expect(VALID_TRANSITIONS[st].length).toBeGreaterThan(0);
      });
    });
  });
});

