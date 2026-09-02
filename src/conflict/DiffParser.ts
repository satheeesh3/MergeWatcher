import { ChangeRange } from '../models/ChangeRange';

const FILE_HEADER = /^\+\+\+ b\/(.+)$/;
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parses `git diff --unified=0` output into per-file changed line ranges,
 * using the "new" side (+) of each hunk.
 */
export class DiffParser {
  static parse(diffText: string): ChangeRange[] {
    const ranges: ChangeRange[] = [];
    if (!diffText) {
      return ranges;
    }

    let currentFile: string | undefined;

    for (const line of diffText.split('\n')) {
      const fileMatch = FILE_HEADER.exec(line);
      if (fileMatch) {
        currentFile = fileMatch[1];
        continue;
      }

      const hunkMatch = HUNK_HEADER.exec(line);
      if (hunkMatch && currentFile) {
        const start = parseInt(hunkMatch[1], 10);
        const count = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;

        if (count === 0) {
          // Pure deletion on this side; mark the surrounding line as affected.
          ranges.push({ file: currentFile, startLine: start, endLine: start });
        } else {
          ranges.push({ file: currentFile, startLine: start, endLine: start + count - 1 });
        }
      }
    }

    return ranges;
  }
}
