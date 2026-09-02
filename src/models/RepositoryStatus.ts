import { Conflict } from './Conflict';

export type RepoStatus = 'synced' | 'behind' | 'conflict' | 'error' | 'stopped';

export interface RepositoryStatus {
  name: string;
  path: string;
  branch: string | undefined;
  status: RepoStatus;
  localCommit: string | undefined;
  remoteCommit: string | undefined;
  ahead: number;
  behind: number;
  conflicts: Conflict[];
  lastChecked: number;
  /** Extra context for 'error' and 'stopped' states (e.g. "Excluded via settings"). */
  note?: string;
}
