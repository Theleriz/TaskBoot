import type { AppData } from './model.ts';
import { parseAppDataJson } from './parse.ts';

export interface ExportOptions {
  /** Secrets are stored in plain text; leave them out when the file will be shared. */
  includeSecrets: boolean;
  now?: Date;
}

/**
 * Export file: the AppData fields plus `app` and `exportedAt`.
 * The same format as the native data.json, so either can be imported in both apps.
 */
export function exportData(data: AppData, options: ExportOptions): string {
  const file = {
    app: 'task-tracker',
    exportedAt: (options.now ?? new Date()).toISOString(),
    ...data,
    secrets: options.includeSecrets ? data.secrets : [],
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Reads an export, a native data.json or stored data.
 * Throws DataFormatError for broken files and SchemaTooNewError for files from a newer app.
 */
export function importData(text: string): AppData {
  return parseAppDataJson(text);
}

export function exportFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `task-tracker-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
