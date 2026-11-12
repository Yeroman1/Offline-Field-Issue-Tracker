import { Report, ReportCategory, ReportPriority } from '../types';

export const VALID_CATEGORIES: ReportCategory[] = [
  'Water',
  'Equipment',
  'Infrastructure',
  'Safety',
  'Maintenance',
];

export const VALID_PRIORITIES: ReportPriority[] = ['Low', 'Medium', 'High', 'Critical'];

export interface ValidationError {
  field: string;
  message: string;
}

export function validateReportInput(data: Partial<Report>): { isValid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!data.title || data.title.trim().length < 3) {
    errors.push({ field: 'title', message: 'Title must be at least 3 characters long.' });
  }

  if (data.title && data.title.length > 120) {
    errors.push({ field: 'title', message: 'Title cannot exceed 120 characters.' });
  }

  if (!data.category || !VALID_CATEGORIES.includes(data.category)) {
    errors.push({ field: 'category', message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}.` });
  }

  if (!data.priority || !VALID_PRIORITIES.includes(data.priority)) {
    errors.push({ field: 'priority', message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}.` });
  }

  if (data.description && data.description.length > 2000) {
    errors.push({ field: 'description', message: 'Description cannot exceed 2000 characters.' });
  }

  if (data.latitude !== undefined && (isNaN(data.latitude) || data.latitude < -90 || data.latitude > 90)) {
    errors.push({ field: 'latitude', message: 'Latitude must be between -90 and 90.' });
  }

  if (data.longitude !== undefined && (isNaN(data.longitude) || data.longitude < -180 || data.longitude > 180)) {
    errors.push({ field: 'longitude', message: 'Longitude must be between -180 and 180.' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
