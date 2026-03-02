import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapText } from '../src/utils/text-layout.js';

test('wrapText keeps wrapped title lines within width', () => {
  const lines = wrapText(
    'Lemony Garlic Miso Chicken Pasta with Branzino Gochujang Matcha Butter Sauce',
    28,
  );

  assert.ok(lines.length > 1);
  for (const line of lines) {
    assert.ok(Array.from(line).length <= 28);
  }
});

test('wrapText preserves hanging indentation for numbered steps', () => {
  const lines = wrapText(
    'Add the chopped onion, cilantro, black pepper, and chilis to the bowl and stir gently.',
    32,
    '01 ',
    '   ',
  );

  assert.equal(lines[0]?.startsWith('01 '), true);
  assert.equal(lines[1]?.startsWith('   '), true);
  for (const line of lines) {
    assert.ok(Array.from(line).length <= 32);
  }
});
