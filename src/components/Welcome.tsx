import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

export function Welcome() {
  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Text color={theme.colors.text}>
        Paste a recipe URL below to extract ingredients and instructions.
      </Text>
      <Text color={theme.colors.muted}>
        Uses browser scraping with AI fallback for best results.
      </Text>
    </Box>
  );
}
