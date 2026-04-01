import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import type { AppPhase } from '../utils/helpers.js';

export type { AppPhase };

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
    { key: 'ctrl+t', label: 'theme' },
    { key: 'ctrl+c', label: 'exit' },
  ],
  scraping: [
    { key: 'ctrl+t', label: 'theme' },
    { key: 'ctrl+c', label: 'exit' },
  ],
  display: [
    { key: 'n', label: 'new recipe' },
    { key: 'ctrl+t', label: 'theme' },
    { key: 'q/esc', label: 'quit' },
  ],
  error: [
    { key: 'enter', label: 'retry' },
    { key: 'ctrl+t', label: 'theme' },
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
  const statusCopy = compact
    ? getStatusCopy(phase).replace('Scanning the page and preparing a clean recipe deck.', 'Scanning recipe page.')
        .replace('Recipe plated. Press n to scrape another page.', 'Recipe plated.')
        .replace('The scrape failed. Adjust the URL or enable the AI fallback.', 'Scrape failed.')
        .replace('Ready for a recipe URL.', 'Ready.')
    : getStatusCopy(phase);

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
        {statusCopy}
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
