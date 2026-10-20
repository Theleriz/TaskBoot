import { useContext } from 'react';
import { AppDataContext, PlatformContext, ToastContext } from './contexts.ts';

export function useAppData() {
  const api = useContext(AppDataContext);
  if (!api) throw new Error('useAppData must be used inside AppDataProvider');
  return api;
}

export function usePlatform() {
  const platform = useContext(PlatformContext);
  if (!platform) throw new Error('usePlatform must be used inside PlatformContext');
  return platform;
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside ToastProvider');
  return show;
}
