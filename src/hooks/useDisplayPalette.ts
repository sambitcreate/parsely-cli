import { useStdout } from 'ink';
import { useEffect } from 'react';
import {
  resetDefaultTerminalBackground,
  setDefaultTerminalBackground,
  shouldUseDisplayPalette,
} from '../utils/terminal.js';

export function useDisplayPalette(color: string) {
  const { stdout, write } = useStdout();

  useEffect(() => {
    if (!stdout.isTTY || !shouldUseDisplayPalette()) {
      return;
    }

    write(setDefaultTerminalBackground(color));

    return () => {
      write(resetDefaultTerminalBackground());
    };
  }, [color, stdout, write]);
}
