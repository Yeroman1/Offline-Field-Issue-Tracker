import { Request, Response, NextFunction } from 'express';
import { supabaseServer } from '../config/supabase';
import { prisma } from '../config/database';

export interface AuthenticatedUser {
  id: string; // Supabase auth.users UUID
  email?: string;
  role: 'FIELD_WORKER' | 'COORDINATOR';
  fullName?: string;
  name?: string;
  deviceId?: string;
  isSimulated?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      actor?: AuthenticatedUser;
    }
  }
}

/**
 * Validates real Supabase Auth JWT bearer tokens.
 * Extracts authentic user identity directly from Supabase Auth service.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  // In isolated automated test runs, support deterministic test authorization
  if (process.env.NODE_ENV === 'test' && (req.headers['x-test-actor-id'] || req.headers['x-actor-id'] || req.headers['x-actor-role'])) {
    const rawRole = (req.headers['x-test-actor-role'] || req.headers['x-actor-role']) as string;
    const testRole = rawRole?.toUpperCase() === 'COORDINATOR' ? 'COORDINATOR' : 'FIELD_WORKER';
    const testId = (req.headers['x-test-actor-id'] || req.headers['x-actor-id'] || 'usr-test-123') as string;
    const testName = (req.headers['x-test-actor-name'] || req.headers['x-actor-name'] || 'Test User') as string;

    req.user = {
      id: testId,
      email: (req.headers['x-test-actor-email'] as string) || 'test@nilepixel.org',
      role: testRole,
      fullName: testName,
      name: testName,
      deviceId: (req.headers['x-device-id'] as string) || 'test-device',
      isSimulated: true,
    };
    req.actor = req.user;
    next();
    return;
  }

  // Public/health or unauthenticated reads if token is not provided
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // If route doesn't strictly require authentication, proceed without req.user
    next();
    return;
  }

  const token = authHeader.substring(7).trim();

  try {
    const { data, error } = await supabaseServer.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired Supabase authentication session.',
        error: { code: 'UNAUTHORIZED', details: error?.message },
      });
      return;
    }

    const sbUser = data.user;
    const rawRole = (sbUser.app_metadata?.role || sbUser.user_metadata?.role || 'FIELD_WORKER').toString().toUpperCase();
    const role: 'FIELD_WORKER' | 'COORDINATOR' = rawRole === 'COORDINATOR' ? 'COORDINATOR' : 'FIELD_WORKER';

    const fullName = sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || sbUser.email;
    req.user = {
      id: sbUser.id,
      email: sbUser.email,
      role,
      fullName,
      name: fullName,
      deviceId: (req.headers['x-device-id'] as string) || 'field-terminal',
    };
    req.actor = req.user;

    // Ensure legitimate user profile exists in PostgreSQL
    await prisma.userProfile.upsert({
      where: { id: sbUser.id },
      update: {
        email: sbUser.email || '',
        fullName: fullName || 'Field Worker',
      },
      create: {
        id: sbUser.id,
        email: sbUser.email || '',
        fullName: fullName || 'Field Worker',
        role,
        team: sbUser.user_metadata?.team || 'Field Unit',
      },
    }).catch((err) => {
      console.warn('UserProfile auto-sync notice:', err.message);
    });

    next();
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify authentication token with Supabase.',
      error: { code: 'AUTH_VERIFICATION_FAILED', details: err.message },
    });
  }
}

export const identifyActor = authenticateToken;

/**
 * Enforces backend authorization based strictly on verified user role.
 * Never trusts client-supplied headers or body flags.
 */
export function requireRole(allowedRoles: ('FIELD_WORKER' | 'COORDINATOR')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        error: { code: 'UNAUTHORIZED' },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: this operation requires one of [${allowedRoles.join(', ')}] permissions. Current role: ${req.user.role}.`,
        error: { code: 'FORBIDDEN' },
      });
      return;
    }

    next();
  };
}