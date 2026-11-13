import crypto from 'crypto';

/**
 * Normalizes an object by sorting its keys recursively, ensuring deterministic JSON serialization.
 */
export function normalizePayload(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(normalizePayload);
  }
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, any> = {};
  for (const key of sortedKeys) {
    result[key] = normalizePayload(obj[key]);
  }
  return result;
}

/**
 * Computes a deterministic SHA-256 fingerprint of a request payload.
 */
export function computePayloadHash(payload: any): string {
  const normalized = normalizePayload(payload);
  const jsonString = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(jsonString, 'utf8').digest('hex');
}

