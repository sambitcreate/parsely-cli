import React from 'react';
import { Box, Text } from 'ink';
import { Panel } from './Panel.js';
import { theme } from '../theme.js';

interface WelcomeProps {
  compact?: boolean;
  minimal?: boolean;
}

export function Welcome({ compact = false, minimal = false }: WelcomeProps) {
  return (
    <Box flexDirection="column">
      <Panel
        title={minimal ? 'Paste a recipe page to extract the cookable bits.' : 'Turn any recipe page into a clean cooking brief.'}
        eyebrow="Recipe deck"
        accentColor={theme.colors.primary}
      >
        <Text color={theme.colors.text}>
          {minimal
            ? 'Parsely pulls out timing, ingredients, and steps without the surrounding clutter.'
            : 'Parsely strips away popups, rambling intros, and clutter so you can focus on timing, ingredients, and steps.'}
        </Text>
      </Panel>

      {!minimal && (
        <Panel
          title="What happens next"
          eyebrow="Workflow"
          accentColor={theme.colors.secondary}
          marginTop={1}
        >
          <Text color={theme.colors.text}>
            {theme.symbols.bullet} Try JSON-LD and other structured recipe markup first.
          </Text>
          <Text color={theme.colors.text}>
            {theme.symbols.bullet} Fall back to AI only when the page needs rescue.
          </Text>
          <Text color={theme.colors.text}>
            {theme.symbols.bullet} Plate the result in a terminal-friendly cooking layout.
          </Text>

          {!compact && (
            <Box marginTop={1}>
              <Text color={theme.colors.muted}>
                Tip: most dedicated recipe sites work immediately if they publish Schema.org metadata.
              </Text>
            </Box>
          )}
        </Panel>
      )}
    </Box>
  );
}
