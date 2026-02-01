import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

export type AppPhase = 'idle' | 'scraping' | 'display' | 'error';

interface FooterProps {
  phase: AppPhase;
}

interface KeyHint {
  key: string;
  label: string;
}

const keybinds: Record<AppPhase, KeyHint[]> = {
  idle: [
    { key: 'enter', label: 'submit' },
    { key: 'ctrl+c', label: 'exit' },
  ],
  scraping: [
    { key: 'ctrl+c', label: 'exit' },
  ],
  display: [
    { key: 'n', label: 'new recipe' },
    { key: 'q', label: 'quit' },
  ],
  error: [
    { key: 'enter', label: 'submit' },
    { key: 'ctrl+c', label: 'exit' },
  ],
};

export function Footer({ phase }: FooterProps) {
  const hints = keybinds[phase];

  return (
    <Box marginTop={1} paddingX={1} gap={1}>
      {hints.map((hint, i) => (
        <React.Fragment key={hint.key}>
          {i > 0 && <Text color={theme.colors.muted}>{theme.symbols.dot}</Text>}
          <Text>
            <Text color={theme.colors.primary} bold>
              {hint.key}
            </Text>
            <Text color={theme.colors.muted}> {hint.label}</Text>
          </Text>
        </React.Fragment>
      ))}
    </Box>
  );
}
