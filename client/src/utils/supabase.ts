import { createClient } from '@supabase/supabase-js';

if (typeof globalThis.WebSocket === 'undefined') {
  // Polyfill stub for Node.js test environments without native WebSocket
  (globalThis as any).WebSocket = class MockWebSocket {
    constructor() {}
    close() {}
    send() {}
  };
}

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://rmfkkpmfnymvksyvdjyy.supabase.co';
const supabaseKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vdTAubPm21xSVSXmclCv2A_bTQZhgrn';

export const supabase = createClient(supabaseUrl, supabaseKey);

