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

const supabaseUrl = process.env.SUPABASE_URL || 'https://rmfkkpmfnymvksyvdjyy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_vdTAubPm21xSVSXmclCv2A_bTQZhgrn';

export const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});