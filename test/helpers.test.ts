import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecipeUrl, sanitizeSingleLineInput } from '../src/utils/helpers.js';

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
