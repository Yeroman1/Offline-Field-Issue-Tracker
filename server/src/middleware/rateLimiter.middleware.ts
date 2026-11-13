import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const isTest = process.env.NODE_ENV === 'test';

/**
 * Standard API rate limiter.
 */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: isTest ? 10000 : env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
});

/**
 * Stricter rate limiter for sensitive write endpoints.
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTest ? 10000 : 60, // 60 writes per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: 'Too many write submissions. Please throttle your requests.',
    error: {
      code: 'WRITE_RATE_LIMIT_EXCEEDED',
    },
  },
});

