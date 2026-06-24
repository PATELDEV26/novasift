import React from 'react';
import { useProAccess } from '../hooks/useProAccess';

interface ProGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProGuard: React.FC<ProGuardProps> = ({ children, fallback = null }) => {
  const { isValid, isLoading } = useProAccess();

  if (isLoading) {
    return <div className="p-4 text-sm text-zinc-400">Loading access rights...</div>;
  }

  if (!isValid) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
