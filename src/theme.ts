import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ThemeMode = 'light' | 'dark';

const symbols = {
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
} as const;

const themes = {
  light: {
    mode: 'light' as const,
    colors: {
      brand: '#009c3f',
      primary: '#0aa043',
      secondary: '#ffbf69',
      accent: '#ff7f50',
      text: '#17311d',
      muted: '#5f7564',
      subtle: '#7a8b7a',
      error: '#c24141',
      success: '#0aa043',
      warning: '#b7791f',
      info: '#2563eb',
      banner: '#009c3f',
      border: '#b7cbb3',
      borderFocus: '#0aa043',
      label: '#b7791f',
      chip: '#e4efe0',
      recipePaper: '#FDFFF7',
      recipeText: '#0aa043',
      recipeMuted: '#5f7564',
      recipeSubtle: '#43684b',
      recipeBorder: '#0aa043',
      recipeSoft: '#dcead5',
      recipePanel: '#f7fbef',
    },
    symbols,
  },
  dark: {
    mode: 'dark' as const,
    colors: {
      brand: '#009c3f',
      primary: '#86c06c',
      secondary: '#ffbf69',
      accent: '#ff7f50',
      text: '#e7eef8',
      muted: '#97a3b0',
      subtle: '#64748b',
      error: '#ff7b7b',
      success: '#7bd389',
      warning: '#ffd166',
      info: '#6ec5ff',
      banner: '#e7eef8',
      border: '#2c394d',
      borderFocus: '#86c06c',
      label: '#ffbf69',
      chip: '#192132',
      recipePaper: '#0F1729',
      recipeText: '#8de58b',
      recipeMuted: '#b7c2d4',
      recipeSubtle: '#8b99ad',
      recipeBorder: '#009c3f',
      recipeSoft: '#2b3c34',
      recipePanel: '#111b30',
    },
    symbols,
  },
} as const;

export type Theme = (typeof themes)[ThemeMode];

function inferThemeModeFromColorEnv(env: NodeJS.ProcessEnv): ThemeMode | null {
  const colorfgbg = env['COLORFGBG'];
  if (!colorfgbg) {
    return null;
  }

  const backgroundCode = Number.parseInt(colorfgbg.split(';').at(-1) ?? '', 10);
  if (!Number.isFinite(backgroundCode)) {
    return null;
  }

  return backgroundCode <= 6 || backgroundCode === 8 ? 'dark' : 'light';
}

export function resolveInitialThemeMode(env: NodeJS.ProcessEnv = process.env): ThemeMode {
  const override = env['PARSELY_THEME'];
  if (override === 'light' || override === 'dark') {
    return override;
  }

  return inferThemeModeFromColorEnv(env) ?? 'light';
}

export async function detectPreferredThemeMode(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ThemeMode> {
  const initial = resolveInitialThemeMode(env);

  if (env['PARSELY_THEME'] === 'light' || env['PARSELY_THEME'] === 'dark' || env['COLORFGBG']) {
    return initial;
  }

  if (process.platform !== 'darwin') {
    return initial;
  }

  try {
    const { stdout } = await execFileAsync('defaults', ['read', '-g', 'AppleInterfaceStyle']);
    return stdout.trim() === 'Dark' ? 'dark' : 'light';
  } catch {
    return initial;
  }
}

let activeTheme: Theme = themes[resolveInitialThemeMode()];

export function getTheme(mode: ThemeMode): Theme {
  return themes[mode];
}

export function setActiveTheme(mode: ThemeMode): Theme {
  activeTheme = themes[mode];
  return activeTheme;
}

export function toggleThemeMode(mode: ThemeMode): ThemeMode {
  return mode === 'dark' ? 'light' : 'dark';
}

export const theme = new Proxy({} as Theme, {
  get(_target, property) {
    return activeTheme[property as keyof Theme];
  },
}) as Theme;
