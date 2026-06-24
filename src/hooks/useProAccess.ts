import { useState, useEffect, useCallback } from 'react';

export interface ProAccessState {
  isValid: boolean;
  isOfflineGrace: boolean;
  isLoading: boolean;
  reason?: string;
  plan?: string;
  expiresAt?: string;
  refresh: () => Promise<void>;
}

export function useProAccess(): ProAccessState {
  const [state, setState] = useState<Omit<ProAccessState, 'refresh'>>({
    isValid: false,
    isOfflineGrace: false,
    isLoading: true,
  });

  const checkAccess = useCallback(async () => {
    try {
      const result = await window.api.license.getState();
      setState({
        isValid: result.isValid,
        isOfflineGrace: result.isOfflineGrace,
        isLoading: false,
        reason: result.reason,
        plan: result.plan,
        expiresAt: result.expiresAt
      });
    } catch (err) {
      setState({
        isValid: false,
        isOfflineGrace: false,
        isLoading: false,
        reason: 'ipc_error'
      });
    }
  }, []);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  return { ...state, refresh: checkAccess };
}
