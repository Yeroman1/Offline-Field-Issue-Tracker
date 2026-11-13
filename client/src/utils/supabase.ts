import { createClient } from '@supabase/supabase-js';

if (typeof globalThis.WebSocket === 'undefined') {
  // Polyfill stub for Node.js test environments without native WebSocket
  (globalThis as any).WebSocket = class MockWebSocket {
    constructor() {}
    close() {}
    send() {}
  };
}

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  if (import.meta.env?.DEV) {
    console.warn('Notice: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not defined in environment.');
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey);

