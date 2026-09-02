import * as assert from 'assert';
import { DiffParser } from '../../src/conflict/DiffParser';

suite('DiffParser', () => {
  test('parses a single hunk range', () => {
    const diff = [
      'diff --git a/src/foo.ts b/src/foo.ts',
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -120,0 +120,16 @@',
      '+line'
    ].join('\n');

    const ranges = DiffParser.parse(diff);
    assert.strictEqual(ranges.length, 1);
    assert.deepStrictEqual(ranges[0], { file: 'src/foo.ts', startLine: 120, endLine: 135 });
  });

  test('handles single-line hunks without a count', () => {
    const diff = ['+++ b/src/bar.ts', '@@ -10 +10 @@', '+line'].join('\n');
    const ranges = DiffParser.parse(diff);
    assert.deepStrictEqual(ranges[0], { file: 'src/bar.ts', startLine: 10, endLine: 10 });
  });

  test('handles pure deletions (zero added lines)', () => {
    const diff = ['+++ b/src/baz.ts', '@@ -5,3 +4,0 @@'].join('\n');
    const ranges = DiffParser.parse(diff);
    assert.deepStrictEqual(ranges[0], { file: 'src/baz.ts', startLine: 4, endLine: 4 });
  });

  test('returns no ranges for empty diff', () => {
    assert.deepStrictEqual(DiffParser.parse(''), []);
  });
});
