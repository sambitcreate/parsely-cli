import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ScrapeStatus } from '../services/scraper.js';
import { theme } from '../theme.js';
import { useDisplayPalette } from '../hooks/useDisplayPalette.js';

interface LoadingScreenProps {
  status?: ScrapeStatus | null;
}

function getLoadingCopy(status?: ScrapeStatus | null): string {
  switch (status?.phase) {
    case 'parsing':
      return 'Preparing recipe...';
    case 'ai':
      return 'Recovering recipe...';
    case 'error':
      return 'Recipe failed to load.';
    default:
      return 'Loading recipe...';
  }
}

export function LoadingScreen({ status }: LoadingScreenProps) {
  useDisplayPalette(theme.colors.recipePaper);

  return (
    <Box width="100%" height="100%" justifyContent="center" alignItems="center">
      <Box flexDirection="column" alignItems="center">
        <Text color={theme.colors.recipeText}>
          <Spinner type="dots" />
        </Text>
        <Box marginTop={1}>
          <Text color={theme.colors.recipeText} bold>
            {getLoadingCopy(status)}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
