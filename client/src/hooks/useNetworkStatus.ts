import { useState, useEffect, useCallback } from 'react';

const SIMULATE_OFFLINE_KEY = 'nilepixel_simulate_offline';

export function getSimulatedOffline(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIMULATE_OFFLINE_KEY) === 'true';
}

export function setSimulatedOffline(val: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SIMULATE_OFFLINE_KEY, val ? 'true' : 'false');
  window.dispatchEvent(new Event('nilepixel_offline_simulation_changed'));
}

export interface NetworkStatus {
  isOnline: boolean;              // effective online status
  browserOnline: boolean;         // navigator.onLine
  isSimulatedOffline: boolean;    // user manually simulated offline
  isServerReachable: boolean;     // health check passed
  lastCheckedAt: Date | null;
  latencyMs: number | null;
  checkHealth: () => Promise<boolean>;
  toggleSimulatedOffline: () => void;
}

export function useNetworkStatus(): NetworkStatus {
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSimulatedOffline, setIsSimulatedOfflineState] = useState<boolean>(getSimulatedOffline());
  const [isServerReachable, setIsServerReachable] = useState<boolean>(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const checkHealth = useCallback(async (): Promise<boolean> => {
    if (getSimulatedOffline()) {
      setIsServerReachable(false);
      setLatencyMs(null);
      setLastCheckedAt(new Date());
      return false;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsServerReachable(false);
      setLatencyMs(null);
      setLastCheckedAt(new Date());
      return false;
    }

    const start = performance.now();
    try {
      // Check API health endpoint (respecting VITE_API_BASE_URL if configured)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const healthUrl = apiBase ? `${apiBase}/api/health` : '/api/health';

      const res = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      }).catch(async () => {
        // Fallback to explicit localhost:3001 in local dev
        return await fetch('http://localhost:3001/api/health', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
          signal: controller.signal,
        });
      });

      clearTimeout(timeoutId);
      const elapsed = Math.round(performance.now() - start);

      if (res && res.ok) {
        setIsServerReachable(true);
        setLatencyMs(elapsed);
        setLastCheckedAt(new Date());
        return true;
      } else {
        setIsServerReachable(false);
        setLatencyMs(null);
        setLastCheckedAt(new Date());
        return false;
      }
    } catch {
      setIsServerReachable(false);
      setLatencyMs(null);
      setLastCheckedAt(new Date());
      return false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setBrowserOnline(true);
      checkHealth();
    };
    const handleOffline = () => {
      setBrowserOnline(false);
      setIsServerReachable(false);
    };

    const handleSimulationChange = () => {
      const sim = getSimulatedOffline();
      setIsSimulatedOfflineState(sim);
      if (sim) {
        setIsServerReachable(false);
      } else {
        checkHealth();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('nilepixel_offline_simulation_changed', handleSimulationChange);

    // Initial check
    checkHealth();

    // Periodic ping every 15 seconds
    const interval = setInterval(() => {
      checkHealth();
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('nilepixel_offline_simulation_changed', handleSimulationChange);
      clearInterval(interval);
    };
  }, [checkHealth]);

  const toggleSimulatedOffline = useCallback(() => {
    const newVal = !getSimulatedOffline();
    setSimulatedOffline(newVal);
  }, []);

  const isOnline = browserOnline && !isSimulatedOffline && isServerReachable;

  return {
    isOnline,
    browserOnline,
    isSimulatedOffline,
    isServerReachable,
    lastCheckedAt,
    latencyMs,
    checkHealth,
    toggleSimulatedOffline,
  };
}
