import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

interface ErrorDisplayProps {
  message: string;
}

export function ErrorDisplay({ message }: ErrorDisplayProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.error}
      paddingX={1}
      paddingY={1}
      marginBottom={1}
    >
      <Text bold color={theme.colors.error}>
        {theme.symbols.cross} Scraping Failed
      </Text>
      <Box marginTop={1} marginLeft={2}>
        <Text color={theme.colors.text} wrap="wrap">
          {message}
        </Text>
      </Box>
      <Box marginTop={1} marginLeft={2}>
        <Text color={theme.colors.muted}>
          Check the URL and try again, or ensure your .env.local has a valid OPENAI_API_KEY.
        </Text>
      </Box>
    </Box>
  );
}
