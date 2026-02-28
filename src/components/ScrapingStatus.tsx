import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { Panel } from './Panel.js';
import { theme } from '../theme.js';
import type { ScrapeStatus } from '../services/scraper.js';

interface ScrapingStatusProps {
  status: ScrapeStatus;
  width: number;
}

const phaseLabel: Record<string, string> = {
  browser: 'Fetching recipe page',
  parsing: 'Reading recipe schema',
  ai: 'Running AI rescue',
  done: 'Recipe ready',
  error: 'Scrape failed',
};

function getPhaseColor(phase: ScrapeStatus['phase']) {
  switch (phase) {
    case 'done':
      return theme.colors.success;
    case 'error':
      return theme.colors.error;
    case 'ai':
      return theme.colors.accent;
    case 'parsing':
      return theme.colors.secondary;
    default:
      return theme.colors.primary;
  }
}

export function ScrapingStatus({ status, width }: ScrapingStatusProps) {
  const isActive = status.phase !== 'done' && status.phase !== 'error';
  const phaseText = phaseLabel[status.phase] ?? status.phase;
  const accentColor = getPhaseColor(status.phase);
  const compact = width < 86;

  return (
    <Panel
      title={phaseText}
      eyebrow="Live status"
      accentColor={accentColor}
      flexGrow={1}
      marginBottom={compact ? 1 : 0}
    >
      <Box gap={1}>
        {isActive && (
          <Text color={accentColor}>
            <Spinner type="dots" />
          </Text>
        )}
        <Text bold color={theme.colors.text}>
          {status.message}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.colors.muted}>
          Browser mode is cheapest and fastest when the site publishes good recipe metadata.
        </Text>
        <Text color={theme.colors.muted}>
          The AI path stays in reserve until Parsely fails to recover enough structured data.
        </Text>
      </Box>
    </Panel>
  );
}
