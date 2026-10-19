import { SchemaTooNewError } from './errors.ts';

/**
 * Version of the stored data format.
 * 0 — no `schemaVersion` field: native data.json and the legacy web app (same shape as 1).
 * 1 — phase 0.3: the same fields plus `schemaVersion`.
 *
 * To change the format: bump this number and add a migration from the previous version.
 */
export const CURRENT_SCHEMA_VERSION = 1;

type Data = Record<string, unknown>;

// MIGRATIONS[n] turns version n into version n + 1.
const MIGRATIONS: Record<number, (data: Data) => Data> = {
  0: (data) => ({ ...data, schemaVersion: 1 }),
};

export function schemaVersionOf(data: Data): number {
  const v = data.schemaVersion;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
}

/** Brings data up to CURRENT_SCHEMA_VERSION. Throws SchemaTooNewError for data from a newer app. */
export function migrate(data: Data): Data {
  let version = schemaVersionOf(data);
  if (version > CURRENT_SCHEMA_VERSION) throw new SchemaTooNewError(version);

  let current = data;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`Missing data migration from schema version ${version}.`);
    current = step(current);
    version += 1;
  }
  return current;
}
