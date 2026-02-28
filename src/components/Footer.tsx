import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

export type AppPhase = 'idle' | 'scraping' | 'display' | 'error';

interface FooterProps {
  phase: AppPhase;
  width: number;
}

interface KeyHint {
  key: string;
  label: string;
}

const keybinds: Record<AppPhase, KeyHint[]> = {
  idle: [
    { key: 'enter', label: 'scrape' },
    { key: 'ctrl+c', label: 'exit' },
  ],
  scraping: [
    { key: 'ctrl+c', label: 'exit' },
  ],
  display: [
    { key: 'n', label: 'new recipe' },
    { key: 'q', label: 'quit' },
    { key: 'esc', label: 'quit' },
  ],
  error: [
    { key: 'enter', label: 'retry' },
    { key: 'ctrl+c', label: 'exit' },
  ],
};

function getStatusCopy(phase: AppPhase): string {
  switch (phase) {
    case 'scraping':
      return 'Scanning the page and preparing a clean recipe deck.';
    case 'display':
      return 'Recipe plated. Press n to scrape another page.';
    case 'error':
      return 'The scrape failed. Adjust the URL or enable the AI fallback.';
    default:
      return 'Ready for a recipe URL.';
  }
}

export function Footer({ phase, width }: FooterProps) {
  const hints = keybinds[phase];
  const compact = width < 92;

  return (
    <Box
      flexDirection={compact ? 'column' : 'row'}
      justifyContent="space-between"
      borderStyle="round"
      borderColor={theme.colors.border}
      paddingX={1}
      paddingY={0}
      marginTop={1}
    >
      <Text color={theme.colors.muted}>
        {getStatusCopy(phase)}
      </Text>

      <Box marginTop={compact ? 1 : 0}>
        {hints.map((hint, index) => (
          <React.Fragment key={hint.key}>
            {index > 0 && <Text color={theme.colors.muted}> {theme.symbols.dot} </Text>}
            <Text>
              <Text color={theme.colors.primary} bold>
                {hint.key}
              </Text>
              <Text color={theme.colors.muted}> {hint.label}</Text>
            </Text>
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}
