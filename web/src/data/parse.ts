import { DataFormatError } from './errors.ts';
import type { AppData } from './model.ts';
import { isRecord, normalizeAppData } from './normalize.ts';
import { migrate } from './schema.ts';

/** Any parsed value → current AppData. Throws DataFormatError or SchemaTooNewError. */
export function parseAppData(raw: unknown): AppData {
  if (!isRecord(raw)) throw new DataFormatError('Data must be a JSON object.');
  return normalizeAppData(migrate(raw));
}

/** JSON text (native data.json, an export, stored data) → current AppData. */
export function parseAppDataJson(text: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DataFormatError('The file is not valid JSON.');
  }
  return parseAppData(raw);
}
