import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInitialThemeMode, toggleThemeMode } from '../src/theme.js';

test('resolveInitialThemeMode honors explicit theme overrides', () => {
  assert.equal(resolveInitialThemeMode({ PARSELY_THEME: 'dark' } as NodeJS.ProcessEnv), 'dark');
  assert.equal(resolveInitialThemeMode({ PARSELY_THEME: 'light' } as NodeJS.ProcessEnv), 'light');
});

test('resolveInitialThemeMode infers terminal darkness from COLORFGBG', () => {
  assert.equal(resolveInitialThemeMode({ COLORFGBG: '15;0' } as NodeJS.ProcessEnv), 'dark');
  assert.equal(resolveInitialThemeMode({ COLORFGBG: '0;15' } as NodeJS.ProcessEnv), 'light');
});

test('toggleThemeMode switches between light and dark', () => {
  assert.equal(toggleThemeMode('light'), 'dark');
  assert.equal(toggleThemeMode('dark'), 'light');
});
