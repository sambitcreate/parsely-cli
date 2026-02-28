import { useStdout } from 'ink';
import { useEffect, useState } from 'react';

const ENTER_ALT_SCREEN = '\u001B[?1049h\u001B[2J\u001B[H\u001B[?25l';
const EXIT_ALT_SCREEN = '\u001B[?25h\u001B[?1049l';

interface Viewport {
  width: number;
  height: number;
}

function getViewport(stdout: NodeJS.WriteStream): Viewport {
  return {
    width: stdout.columns ?? 100,
    height: stdout.rows ?? 32,
  };
}

export function useTerminalViewport() {
  const { stdout } = useStdout();
  const [viewport, setViewport] = useState<Viewport>(() => getViewport(stdout));

  useEffect(() => {
    const onResize = () => {
      setViewport(getViewport(stdout));
    };

    onResize();
    stdout.on('resize', onResize);

    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  useEffect(() => {
    if (!stdout.isTTY) return;

    stdout.write(ENTER_ALT_SCREEN);

    return () => {
      stdout.write(EXIT_ALT_SCREEN);
    };
  }, [stdout]);

  return viewport;
}
