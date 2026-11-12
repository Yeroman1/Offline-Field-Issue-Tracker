import { useState, useEffect } from 'react';
import { UserProfile } from '../types';

export const PROFILES: Record<string, UserProfile> = {
  worker: {
    id: 'USR-882',
    name: 'Sarah J.',
    role: 'worker',
    team: 'Hydro Rapid Response Alpha',
  },
  coordinator: {
    id: 'USR-001',
    name: 'Ahmed K.',
    role: 'coordinator',
    team: 'Central Field Operations Hub',
  },
};

const USER_ROLE_KEY = 'nilepixel_active_role';

export function getStoredRole(): 'worker' | 'coordinator' {
  if (typeof window === 'undefined') return 'worker';
  const role = localStorage.getItem(USER_ROLE_KEY);
  return role === 'coordinator' ? 'coordinator' : 'worker';
}

export function setStoredRole(role: 'worker' | 'coordinator'): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_ROLE_KEY, role);
  window.dispatchEvent(new Event('nilepixel_role_changed'));
}

export function useUserRole() {
  const [role, setRoleState] = useState<'worker' | 'coordinator'>(getStoredRole());

  useEffect(() => {
    const handleRoleChange = () => {
      setRoleState(getStoredRole());
    };
    window.addEventListener('nilepixel_role_changed', handleRoleChange);
    return () => {
      window.removeEventListener('nilepixel_role_changed', handleRoleChange);
    };
  }, []);

  const setRole = (newRole: 'worker' | 'coordinator') => {
    setStoredRole(newRole);
  };

  const user = PROFILES[role];

  return {
    role,
    user,
    setRole,
    isCoordinator: role === 'coordinator',
    isWorker: role === 'worker',
  };
}
