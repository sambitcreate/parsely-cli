import { useStdout } from 'ink';
import { useEffect, useState } from 'react';

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

  return viewport;
}
