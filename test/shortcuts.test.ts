import test from 'node:test';
import assert from 'node:assert/strict';
import { isCtrlShortcut, isDisplayQuitShortcut, isThemeToggleShortcut } from '../src/utils/shortcuts.js';

test('isCtrlShortcut matches ctrl metadata form', () => {
  assert.equal(isCtrlShortcut('t', { ctrl: true }, 't'), true);
  assert.equal(isCtrlShortcut('c', { ctrl: true }, 'c'), true);
});

test('isCtrlShortcut matches raw control characters', () => {
  assert.equal(isCtrlShortcut('\u0014', {}, 't'), true);
  assert.equal(isCtrlShortcut('\u0003', {}, 'c'), true);
});

test('isThemeToggleShortcut recognizes both ctrl+t forms and rejects plain text', () => {
  assert.equal(isThemeToggleShortcut('t', { ctrl: true }), true);
  assert.equal(isThemeToggleShortcut('\u0014', {}), true);
  assert.equal(isThemeToggleShortcut('t', { ctrl: false }), false);
  assert.equal(isThemeToggleShortcut('x', { ctrl: true }), false);
});

test('isDisplayQuitShortcut recognizes both q and escape', () => {
  assert.equal(isDisplayQuitShortcut('q', {}), true);
  assert.equal(isDisplayQuitShortcut('Q', {}), true);
  assert.equal(isDisplayQuitShortcut('', { escape: true }), true);
  assert.equal(isDisplayQuitShortcut('n', {}), false);
});
