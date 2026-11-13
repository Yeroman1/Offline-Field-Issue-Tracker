import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

if (typeof globalThis.WebSocket === 'undefined') {
  // Polyfill stub for Node.js test environments without native WebSocket
  (globalThis as any).WebSocket = class MockWebSocket {
    constructor() {}
    close() {}
    send() {}
  };
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    console.warn('Notice: SUPABASE_URL or SUPABASE_ANON_KEY is not configured in environment.');
  }
}

export const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});