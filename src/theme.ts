/**
 * Parsely CLI theme - color palette and symbols for the TUI.
 * Inspired by OpenCode's semantic theming approach.
 */

export const theme = {
  colors: {
    primary: '#00d4aa',
    secondary: '#ff6b9d',
    accent: '#ffd93d',
    text: '#e0e0e0',
    muted: '#6272a4',
    error: '#ff5555',
    success: '#50fa7b',
    warning: '#f1fa8c',
    info: '#8be9fd',
    banner: '#50fa7b',
    border: '#6272a4',
    borderFocus: '#00d4aa',
    label: '#bd93f9',
  },
  symbols: {
    bullet: '\u2022',
    arrow: '\u2192',
    check: '\u2713',
    cross: '\u2717',
    dot: '\u00B7',
    ellipsis: '\u2026',
    line: '\u2500',
  },
} as const;

export type Theme = typeof theme;
