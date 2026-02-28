import React from 'react';
import { Box, Text } from 'ink';
import { Panel } from './Panel.js';
import { theme } from '../theme.js';

interface ErrorDisplayProps {
  message: string;
}

export function ErrorDisplay({ message }: ErrorDisplayProps) {
  return (
    <Panel
      title="Scrape failed"
      eyebrow="Recovery"
      accentColor={theme.colors.error}
      marginBottom={1}
    >
      <Text bold color={theme.colors.error}>
        {theme.symbols.cross} {message}
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.colors.text}>
          {theme.symbols.bullet} Double-check that the URL points to a specific recipe page.
        </Text>
        <Text color={theme.colors.text}>
          {theme.symbols.bullet} Install Chrome or Chromium for the browser-first path.
        </Text>
        <Text color={theme.colors.text}>
          {theme.symbols.bullet} Add `OPENAI_API_KEY` to `.env.local` if you want AI fallback enabled.
        </Text>
      </Box>
    </Panel>
  );
}
