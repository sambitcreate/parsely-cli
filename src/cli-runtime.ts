import React, { type ComponentType, type ReactElement } from 'react';
import { render } from 'ink';
import { App } from './app.js';
import {
  createSynchronizedWriteProxy,
  resetDefaultTerminalBackground,
  shouldUseDisplayPalette,
  shouldUseSynchronizedOutput,
} from './utils/terminal.js';

type EnvMap = Record<string, string | undefined>;

interface AppComponentProps {
  initialUrl?: string;
}

interface InkRenderOptions {
  exitOnCtrlC: boolean;
  stdout: NodeJS.WriteStream;
}

interface InkRenderInstance {
  waitUntilExit(): Promise<void>;
}

type InkRender = (tree: ReactElement, options: InkRenderOptions) => InkRenderInstance;

export interface CliRuntimeDependencies {
  AppComponent?: ComponentType<AppComponentProps>;
  createSynchronizedWriteProxy?: (stdout: NodeJS.WriteStream) => NodeJS.WriteStream;
  env?: EnvMap;
  renderApp?: InkRender;
  resetDefaultTerminalBackground?: () => string;
  shouldUseDisplayPalette?: (env?: EnvMap) => boolean;
  shouldUseSynchronizedOutput?: (env?: EnvMap) => boolean;
  stdout?: NodeJS.WriteStream;
}

export const ENTER_ALT_SCREEN = '\u001B[?1049h\u001B[2J\u001B[H';
export const EXIT_ALT_SCREEN = '\u001B[?1049l';

export async function runCli(
  initialUrl?: string,
  dependencies: CliRuntimeDependencies = {},
): Promise<void> {
  const stdout = dependencies.stdout ?? process.stdout;
  const env = dependencies.env ?? process.env;
  const useAltScreen = stdout.isTTY === true;
  const renderApp = dependencies.renderApp ?? render;
  const AppComponent = dependencies.AppComponent ?? App;
  const shouldUseSyncOutput = dependencies.shouldUseSynchronizedOutput ?? shouldUseSynchronizedOutput;
  const shouldUsePalette = dependencies.shouldUseDisplayPalette ?? shouldUseDisplayPalette;
  const wrapStdout = dependencies.createSynchronizedWriteProxy ?? createSynchronizedWriteProxy;
  const resetPalette = dependencies.resetDefaultTerminalBackground ?? resetDefaultTerminalBackground;
  const inkStdout = useAltScreen && shouldUseSyncOutput(env)
    ? wrapStdout(stdout)
    : stdout;

  if (useAltScreen) {
    stdout.write(ENTER_ALT_SCREEN);
  }

  try {
    const instance = renderApp(React.createElement(AppComponent, { initialUrl }), {
      exitOnCtrlC: false,
      stdout: inkStdout,
    });
    await instance.waitUntilExit();
  } finally {
    const paletteEnabled = useAltScreen && shouldUsePalette(env);

    if (paletteEnabled) {
      stdout.write(resetPalette());
    }

    if (useAltScreen) {
      stdout.write(EXIT_ALT_SCREEN);
    }

    if (paletteEnabled) {
      stdout.write(resetPalette());
    }
  }
}
