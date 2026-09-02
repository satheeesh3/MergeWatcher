import { Repository } from './Repository';

export interface Conflict {
  repository: Repository;
  branch: string;
  file: string;
  localStart: number;
  localEnd: number;
  remoteStart: number;
  remoteEnd: number;
  remoteCommit: string;
}
