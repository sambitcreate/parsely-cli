import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { theme } from '../theme.js';
import type { ScrapeStatus } from '../services/scraper.js';

interface ScrapingStatusProps {
  status: ScrapeStatus;
}

const phaseLabel: Record<string, string> = {
  browser: 'Browser Scraping',
  parsing: 'Parsing HTML',
  ai: 'AI Extraction',
  done: 'Complete',
  error: 'Error',
};

export function ScrapingStatus({ status }: ScrapingStatusProps) {
  const isActive = status.phase !== 'done' && status.phase !== 'error';
  const label = phaseLabel[status.phase] ?? status.phase;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.border}
      paddingX={1}
      paddingY={1}
    >
      <Box gap={1}>
        {isActive && (
          <Text color={theme.colors.primary}>
            <Spinner type="dots" />
          </Text>
        )}
        <Text bold color={theme.colors.label}>
          {label}
        </Text>
      </Box>
      <Box marginTop={1} marginLeft={2}>
        <Text color={theme.colors.muted}>{status.message}</Text>
      </Box>
    </Box>
  );
}
