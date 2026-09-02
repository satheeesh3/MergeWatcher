export interface Repository {
  /** Absolute filesystem path to the repository root. */
  rootPath: string;
  /** Short display name, derived from the folder name. */
  name: string;
}
