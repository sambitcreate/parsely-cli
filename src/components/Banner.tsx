import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import { getUrlHost, type AppPhase } from '../utils/helpers.js';

interface BannerProps {
  phase: AppPhase;
  currentUrl?: string;
  width: number;
  height: number;
}

function getPhaseMeta(phase: AppPhase) {
  switch (phase) {
    case 'scraping':
      return { label: 'SCRAPING', color: theme.colors.secondary };
    case 'display':
      return { label: 'PLATED', color: theme.colors.success };
    case 'error':
      return { label: 'RETRY', color: theme.colors.error };
    default:
      return { label: 'READY', color: theme.colors.primary };
  }
}

export function Banner({ phase, currentUrl, width, height }: BannerProps) {
  const compact = width < 88 || height < 26;
  const phaseMeta = getPhaseMeta(phase);
  const host = getUrlHost(currentUrl);

  return (
    <Box
      flexDirection={compact ? 'column' : 'row'}
      justifyContent="space-between"
      borderStyle="round"
      borderColor={theme.colors.border}
      paddingX={1}
      paddingY={0}
      marginBottom={1}
    >
      <Box flexDirection="column">
        <Text bold color={theme.colors.banner}>
          PARSELY
        </Text>
        <Text color={theme.colors.text} bold>
          Recipe intelligence in the terminal
        </Text>
        {!compact && (
          <Text color={theme.colors.muted}>
            Browser-first extraction with an AI rescue path when recipe schema is missing.
          </Text>
        )}
      </Box>

      <Box flexDirection="column" alignItems={compact ? undefined : 'flex-end'} marginTop={compact ? 1 : 0}>
        <Text bold color={phaseMeta.color}>
          [{phaseMeta.label}]
        </Text>
        <Text color={theme.colors.muted}>
          {host || 'Paste a recipe URL to begin'}
        </Text>
      </Box>
    </Box>
  );
}
