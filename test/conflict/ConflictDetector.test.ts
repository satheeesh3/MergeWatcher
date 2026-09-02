import * as assert from 'assert';
import { ConflictDetector } from '../../src/conflict/ConflictDetector';
import { Repository } from '../../src/models/Repository';

const repo: Repository = { rootPath: '/repo', name: 'notification-service' };

suite('ConflictDetector', () => {
  test('detects overlapping ranges in the same file', () => {
    const conflicts = ConflictDetector.detect(repo, 'uat', 'abc123', {
      local: [{ file: 'src/services/notification.ts', startLine: 120, endLine: 135 }],
      remote: [{ file: 'src/services/notification.ts', startLine: 128, endLine: 140 }]
    });

    assert.strictEqual(conflicts.length, 1);
    assert.strictEqual(conflicts[0].file, 'src/services/notification.ts');
  });

  test('ignores non-overlapping ranges', () => {
    const conflicts = ConflictDetector.detect(repo, 'uat', 'abc123', {
      local: [{ file: 'src/a.ts', startLine: 1, endLine: 5 }],
      remote: [{ file: 'src/a.ts', startLine: 10, endLine: 15 }]
    });

    assert.strictEqual(conflicts.length, 0);
  });

  test('ignores overlapping ranges in different files', () => {
    const conflicts = ConflictDetector.detect(repo, 'uat', 'abc123', {
      local: [{ file: 'src/a.ts', startLine: 1, endLine: 5 }],
      remote: [{ file: 'src/b.ts', startLine: 1, endLine: 5 }]
    });

    assert.strictEqual(conflicts.length, 0);
  });

  test('touching boundaries count as overlap', () => {
    const conflicts = ConflictDetector.detect(repo, 'uat', 'abc123', {
      local: [{ file: 'src/a.ts', startLine: 1, endLine: 5 }],
      remote: [{ file: 'src/a.ts', startLine: 5, endLine: 10 }]
    });

    assert.strictEqual(conflicts.length, 1);
  });
});
