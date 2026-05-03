import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOccurrenceKeys,
  isoToMinutes,
  normalizeRecipeUrl,
  sanitizeSingleLineInput,
  sanitizeTerminalText,
} from '../src/utils/helpers.js';

test('sanitizeSingleLineInput removes carriage returns and newlines', () => {
  assert.equal(
    sanitizeSingleLineInput('https://example.com/recipe\r\n'),
    'https://example.com/recipe',
  );
});

test('normalizeRecipeUrl adds https when protocol is missing', () => {
  assert.equal(
    normalizeRecipeUrl('example.com/recipe'),
    'https://example.com/recipe',
  );
});

test('normalizeRecipeUrl preserves valid http URLs', () => {
  assert.equal(
    normalizeRecipeUrl('http://example.com/recipe'),
    'http://example.com/recipe',
  );
});

test('normalizeRecipeUrl rejects invalid URLs', () => {
  assert.equal(normalizeRecipeUrl('not a url'), null);
});

test('normalizeRecipeUrl rejects non-http schemes', () => {
  assert.equal(normalizeRecipeUrl('file:///etc/passwd'), null);
  assert.equal(normalizeRecipeUrl('javascript:alert(1)'), null);
});

test('normalizeRecipeUrl rejects empty input', () => {
  assert.equal(normalizeRecipeUrl('   '), null);
});

test('isoToMinutes handles fractional ISO duration fields', () => {
  assert.equal(isoToMinutes('PT1.5H'), 90);
  assert.equal(isoToMinutes('PT90.5S'), 2);
});

test('sanitizeTerminalText strips ansi and control sequences', () => {
  assert.equal(
    sanitizeTerminalText('\u001b]0;spoofed title\u0007Fresh \u001b[31mbasil\u001b[0m'),
    'Fresh basil',
  );
});

test('buildOccurrenceKeys deduplicates identical items with suffix counts', () => {
  assert.deepEqual(
    buildOccurrenceKeys(['a', 'b', 'a', 'c', 'b']),
    ['a-1', 'b-1', 'a-2', 'c-1', 'b-2'],
  );
  assert.deepEqual(buildOccurrenceKeys([]), []);
});
