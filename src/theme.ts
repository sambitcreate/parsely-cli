/**
 * Parsely CLI theme - color palette and symbols for the TUI.
 * Tuned for a warm, food-forward terminal UI.
 */

export const theme = {
  colors: {
    primary: '#86c06c',
    secondary: '#ffbf69',
    accent: '#ff7f50',
    text: '#f6f2ea',
    muted: '#97a3b0',
    subtle: '#536170',
    error: '#ff6b6b',
    success: '#7bd389',
    warning: '#ffd166',
    info: '#6ec5ff',
    banner: '#f6f2ea',
    border: '#3a4654',
    borderFocus: '#86c06c',
    label: '#ffbf69',
    chip: '#24303b',
  },
  symbols: {
    bullet: '\u2022',
    arrow: '\u2192',
    check: '\u2713',
    cross: '\u2717',
    dot: '\u00B7',
    ellipsis: '\u2026',
    line: '\u2500',
    active: '\u25c9',
    pending: '\u25cb',
    skip: '\u2212',
  },
} as const;

export type Theme = typeof theme;
