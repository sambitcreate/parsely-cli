import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOccurrenceKeys,
  isValidUrl,
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

test('isValidUrl accepts well-formed public http(s) URLs', () => {
  assert.equal(isValidUrl('https://example.com/recipe'), true);
  assert.equal(isValidUrl('http://example.com'), true);
  assert.equal(isValidUrl('https://sub.domain.example.com/path?q=1'), true);
  assert.equal(isValidUrl('https://8.8.8.8/'), true);
});

test('isValidUrl rejects non-http schemes', () => {
  assert.equal(isValidUrl('file:///etc/passwd'), false);
  assert.equal(isValidUrl('javascript:alert(1)'), false);
  assert.equal(isValidUrl('data:text/html,<script>'), false);
  assert.equal(isValidUrl('ftp://example.com'), false);
});

test('isValidUrl rejects localhost and mDNS hostnames', () => {
  assert.equal(isValidUrl('http://localhost'), false);
  assert.equal(isValidUrl('http://localhost:3000/path'), false);
  assert.equal(isValidUrl('http://foo.localhost'), false);
  assert.equal(isValidUrl('http://router.internal'), false);
  assert.equal(isValidUrl('http://printer.local'), false);
});

test('isValidUrl rejects RFC 1918 private IPv4 ranges', () => {
  assert.equal(isValidUrl('http://127.0.0.1'), false);
  assert.equal(isValidUrl('http://127.1.2.3:8080'), false);
  assert.equal(isValidUrl('http://10.0.0.1'), false);
  assert.equal(isValidUrl('http://10.255.255.254'), false);
  assert.equal(isValidUrl('http://192.168.1.1'), false);
  assert.equal(isValidUrl('http://172.16.0.1'), false);
  assert.equal(isValidUrl('http://172.20.0.1'), false);
  assert.equal(isValidUrl('http://172.31.255.254'), false);
  // 172.15 and 172.32 are NOT private
  assert.equal(isValidUrl('http://172.15.0.1'), true);
  assert.equal(isValidUrl('http://172.32.0.1'), true);
});

test('isValidUrl rejects cloud metadata and link-local IPv4', () => {
  assert.equal(isValidUrl('http://169.254.169.254/latest/meta-data'), false);
  assert.equal(isValidUrl('http://169.254.1.1'), false);
  assert.equal(isValidUrl('http://0.0.0.0'), false);
});

test('isValidUrl rejects loopback and private IPv6', () => {
  assert.equal(isValidUrl('http://[::1]'), false);
  assert.equal(isValidUrl('http://[::1]:8080/path'), false);
  assert.equal(isValidUrl('http://[fe80::1]'), false);
  assert.equal(isValidUrl('http://[fc00::1]'), false);
  assert.equal(isValidUrl('http://[fd00::1]'), false);
  // IPv4-mapped IPv6 referencing loopback
  assert.equal(isValidUrl('http://[::ffff:127.0.0.1]'), false);
  // Public IPv6 should pass
  assert.equal(isValidUrl('http://[2606:4700:4700::1111]'), true);
});

test('isValidUrl rejects malformed input', () => {
  assert.equal(isValidUrl('not a url'), false);
  assert.equal(isValidUrl(''), false);
  assert.equal(isValidUrl('http://'), false);
});
