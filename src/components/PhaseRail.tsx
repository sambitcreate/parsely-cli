import React from 'react';
import { Box, Text } from 'ink';
import type { Recipe, ScrapeStatus } from '../services/scraper.js';
import { theme } from '../theme.js';

type AppPhase = 'idle' | 'scraping' | 'display' | 'error';
type StepState = 'pending' | 'active' | 'complete' | 'skipped';

interface PhaseRailProps {
  phase: AppPhase;
  status?: ScrapeStatus | null;
  recipe?: Recipe | null;
}

interface Step {
  key: 'browser' | 'parsing' | 'ai';
  label: string;
  detail: string;
}

const steps: Step[] = [
  {
    key: 'browser',
    label: 'Fetch page',
    detail: 'Launch Chrome or Chromium and load the recipe page.',
  },
  {
    key: 'parsing',
    label: 'Read schema',
    detail: 'Look for JSON-LD recipe data and normalize the shape.',
  },
  {
    key: 'ai',
    label: 'AI rescue',
    detail: 'Call gpt-4o-mini only when the page is missing usable recipe data.',
  },
];

function getStepState(
  step: Step['key'],
  phase: AppPhase,
  status?: ScrapeStatus | null,
  recipe?: Recipe | null,
): StepState {
  if (phase === 'idle') return 'pending';

  if (phase === 'display' && recipe?.source === 'browser') {
    if (step === 'ai') return 'skipped';
    return 'complete';
  }

  if (phase === 'display' && recipe?.source === 'ai') {
    return 'complete';
  }

  const activePhase = status?.phase;

  if (step === 'browser') {
    if (activePhase === 'browser') return 'active';
    if (activePhase === 'parsing' || activePhase === 'ai' || activePhase === 'done' || activePhase === 'error') {
      return 'complete';
    }
  }

  if (step === 'parsing') {
    if (activePhase === 'parsing') return 'active';
    if (activePhase === 'ai' || activePhase === 'done' || activePhase === 'error') {
      return 'complete';
    }
  }

  if (step === 'ai') {
    if (activePhase === 'ai') return 'active';
    if (recipe?.source === 'browser' && phase === 'display') return 'skipped';
    if (activePhase === 'done' || activePhase === 'error') {
      return recipe?.source === 'browser' ? 'skipped' : 'complete';
    }
  }

  return 'pending';
}

function getStepColor(state: StepState): string {
  switch (state) {
    case 'active':
      return theme.colors.secondary;
    case 'complete':
      return theme.colors.success;
    case 'skipped':
      return theme.colors.subtle;
    default:
      return theme.colors.muted;
  }
}

function getStepSymbol(state: StepState): string {
  switch (state) {
    case 'active':
      return theme.symbols.active;
    case 'complete':
      return theme.symbols.check;
    case 'skipped':
      return theme.symbols.skip;
    default:
      return theme.symbols.pending;
  }
}

export function PhaseRail({ phase, status, recipe }: PhaseRailProps) {
  return (
    <Box flexDirection="column">
      {steps.map((step, index) => {
        const state = getStepState(step.key, phase, status, recipe);
        const color = getStepColor(state);

        return (
          <Box key={step.key} flexDirection="column" marginBottom={index === steps.length - 1 ? 0 : 1}>
            <Box gap={1}>
              <Text color={color} bold>
                {getStepSymbol(state)}
              </Text>
              <Text color={state === 'pending' ? theme.colors.text : color} bold={state !== 'pending'}>
                {step.label}
              </Text>
            </Box>
            <Box marginLeft={2}>
              <Text color={theme.colors.muted}>
                {step.detail}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
