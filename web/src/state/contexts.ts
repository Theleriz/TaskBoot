import { createContext } from 'react';
import type { AppData } from '../data/model.ts';
import type { Platform } from '../platform/platform.ts';

export type LoadState =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      /** Data came from a newer app version: shown, but never saved over. */
      readOnly: boolean;
      /** One-time message for the user (migration, recovery, problems). */
      notice: string | null;
    };

export interface AppDataApi {
  data: AppData;
  load: LoadState;
  /** Last save error, if saving is failing. */
  saveError: string | null;
  /** Applies an operation to a copy of the data and saves it. */
  apply(recipe: (draft: AppData) => void): void;
  /** Replaces everything (import). */
  replace(data: AppData): void;
}

export const AppDataContext = createContext<AppDataApi | null>(null);
export const PlatformContext = createContext<Platform | null>(null);
export const ToastContext = createContext<((text: string) => void) | null>(null);
