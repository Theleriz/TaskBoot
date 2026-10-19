/** The text is not valid JSON or not an object at all. */
export class DataFormatError extends Error {
  override name = 'DataFormatError';
}

/** The data was written by a newer version of the app. It must not be overwritten. */
export class SchemaTooNewError extends Error {
  override name = 'SchemaTooNewError';
  readonly version: number;

  constructor(version: number) {
    super(`Data schema version ${version} is newer than this app supports.`);
    this.version = version;
  }
}

/** Saving failed: storage is full, blocked or the shell did not answer. */
export class StorageError extends Error {
  override name = 'StorageError';
}
