import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

const LOGO = `\
 ____   _    ____  ____  _____ _  __   __    ____ _     ___
|  _ \\ / \\  |  _ \\/ ___|| ____| | \\ \\ / /   / ___| |   |_ _|
| |_) / _ \\ | |_) \\___ \\|  _| | |  \\ V /   | |   | |    | |
|  __/ ___ \\|  _ < ___) | |___| |___| |    | |___| |___ | |
|_| /_/   \\_\\_| \\_\\____/|_____|_____|_|     \\____|_____|___|`;

export function Banner() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.colors.banner} bold>
        {LOGO}
      </Text>
      <Text color={theme.colors.muted}>
        {'  '}Smart recipe scraper {theme.symbols.dot} v2.0
      </Text>
    </Box>
  );
}
