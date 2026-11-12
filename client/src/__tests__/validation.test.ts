import { describe, it, expect } from 'vitest';
import { validateReportInput, VALID_CATEGORIES, VALID_PRIORITIES } from '../lib/validation';
import { Report } from '../types';

describe('validation', () => {
  it('validates a complete valid report successfully', () => {
    const validReport: Partial<Report> = {
      title: 'Water pump valve failure in sector 4',
      category: 'Water',
      priority: 'Critical',
      description: 'High pressure leak at main flange.',
      latitude: 30.0444,
      longitude: 31.2357,
    };

    const result = validateReportInput(validReport);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects reports with empty or too short title', () => {
    const result = validateReportInput({
      title: 'ab',
      category: 'Water',
      priority: 'Low',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'title')).toBe(true);
  });

  it('rejects invalid category', () => {
    const result = validateReportInput({
      title: 'Broken electrical fence',
      category: 'UnknownCategory' as any,
      priority: 'Medium',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'category')).toBe(true);
  });

  it('rejects invalid priority', () => {
    const result = validateReportInput({
      title: 'Generator inspection',
      category: 'Equipment',
      priority: 'SuperUrgent' as any,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'priority')).toBe(true);
  });

  it('rejects out-of-range coordinates', () => {
    const invalidLat = validateReportInput({
      title: 'Valid title here',
      category: 'Safety',
      priority: 'High',
      latitude: 95.0, // max is 90
    });
    expect(invalidLat.isValid).toBe(false);
    expect(invalidLat.errors.some((e) => e.field === 'latitude')).toBe(true);

    const invalidLng = validateReportInput({
      title: 'Valid title here',
      category: 'Safety',
      priority: 'High',
      longitude: 195.0, // max is 180
    });
    expect(invalidLng.isValid).toBe(false);
    expect(invalidLng.errors.some((e) => e.field === 'longitude')).toBe(true);
  });

  it('has all expected categories and priorities defined', () => {
    expect(VALID_CATEGORIES).toEqual([
      'Water',
      'Equipment',
      'Infrastructure',
      'Safety',
      'Maintenance',
    ]);
    expect(VALID_PRIORITIES).toEqual(['Low', 'Medium', 'High', 'Critical']);
  });
});
