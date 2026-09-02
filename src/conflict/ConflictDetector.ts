import { ChangeRange } from '../models/ChangeRange';
import { Conflict } from '../models/Conflict';
import { Repository } from '../models/Repository';
import { DiffResult } from './DiffAnalyzer';

function rangesOverlap(localStart: number, localEnd: number, remoteStart: number, remoteEnd: number): boolean {
  return localStart <= remoteEnd && remoteStart <= localEnd;
}

export class ConflictDetector {
  static detect(
    repository: Repository,
    branch: string,
    remoteCommit: string,
    diff: DiffResult
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    const localByFile = this.groupByFile(diff.local);
    const remoteByFile = this.groupByFile(diff.remote);

    for (const [file, localRanges] of localByFile) {
      const remoteRanges = remoteByFile.get(file);
      if (!remoteRanges) {
        continue;
      }

      for (const local of localRanges) {
        for (const remote of remoteRanges) {
          if (rangesOverlap(local.startLine, local.endLine, remote.startLine, remote.endLine)) {
            conflicts.push({
              repository,
              branch,
              file,
              localStart: local.startLine,
              localEnd: local.endLine,
              remoteStart: remote.startLine,
              remoteEnd: remote.endLine,
              remoteCommit
            });
          }
        }
      }
    }

    return conflicts;
  }

  private static groupByFile(ranges: ChangeRange[]): Map<string, ChangeRange[]> {
    const map = new Map<string, ChangeRange[]>();
    for (const range of ranges) {
      const existing = map.get(range.file);
      if (existing) {
        existing.push(range);
      } else {
        map.set(range.file, [range]);
      }
    }
    return map;
  }
}
