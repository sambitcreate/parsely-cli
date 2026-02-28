import React from 'react';
import { Box, Text } from 'ink';
import { Panel } from './Panel.js';
import { theme } from '../theme.js';
import { getUrlHost, isoToMinutes, formatMinutes } from '../utils/helpers.js';
import type { Recipe } from '../services/scraper.js';

interface RecipeCardProps {
  recipe: Recipe;
  width: number;
  sourceUrl?: string;
}

function extractInstructions(recipe: Recipe): string[] {
  const raw = recipe.recipeInstructions;
  if (!raw) return [];

  const steps: string[] = [];
  if (Array.isArray(raw)) {
    for (const step of raw) {
      if (typeof step === 'string') {
        steps.push(step);
      } else if (typeof step === 'object' && step !== null) {
        if ('text' in step && step.text) {
          steps.push(step.text);
        } else if ('itemListElement' in step && Array.isArray(step.itemListElement)) {
          for (const sub of step.itemListElement) {
            if (sub.text) steps.push(sub.text);
          }
        }
      }
    }
  } else {
    steps.push(String(raw));
  }

  return steps;
}

function buildOccurrenceKeys(items: string[]): string[] {
  const counts = new Map<string, number>();

  return items.map((item) => {
    const count = (counts.get(item) ?? 0) + 1;
    counts.set(item, count);
    return `${item}-${count}`;
  });
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <Box justifyContent="space-between">
      <Text color={theme.colors.muted}>{label}</Text>
      <Text color={theme.colors.text} bold>
        {value}
      </Text>
    </Box>
  );
}

function TimeField({ label, iso }: { label: string; iso?: string }) {
  if (!iso) return null;
  const mins = isoToMinutes(iso);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.colors.muted}>{label}</Text>
      <Text color={theme.colors.text} bold>
        {formatMinutes(mins)}
      </Text>
      <Text color={theme.colors.subtle}>
        {iso}
      </Text>
    </Box>
  );
}

export function RecipeCard({ recipe, width, sourceUrl }: RecipeCardProps) {
  const instructions = extractInstructions(recipe);
  const ingredients = recipe.recipeIngredient ?? [];
  const ingredientKeys = buildOccurrenceKeys(ingredients);
  const instructionKeys = buildOccurrenceKeys(instructions);
  const sourceLabel = recipe.source === 'browser' ? 'Schema found on page' : 'Recovered with AI';
  const sourceColor = recipe.source === 'browser' ? theme.colors.primary : theme.colors.accent;
  const wide = width >= 108;

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Panel
        title={recipe.name ?? 'Untitled recipe'}
        eyebrow="Recipe deck"
        accentColor={sourceColor}
        marginBottom={1}
      >
        <Box flexDirection={wide ? 'row' : 'column'} justifyContent="space-between">
          <Box flexDirection="column">
            <Text color={sourceColor} bold>
              {sourceLabel}
            </Text>
            {sourceUrl && (
              <Text color={theme.colors.muted}>
                {getUrlHost(sourceUrl)}
              </Text>
            )}
          </Box>

          <Box marginTop={wide ? 0 : 1} flexDirection={wide ? 'row' : 'column'} gap={2}>
            <StatRow label="Ingredients" value={String(ingredients.length)} />
            <StatRow label="Steps" value={String(instructions.length)} />
          </Box>
        </Box>
      </Panel>

      <Box flexDirection={wide ? 'row' : 'column'} gap={1} flexGrow={1}>
        <Panel
          title="Ingredients and timing"
          eyebrow="Prep"
          accentColor={theme.colors.secondary}
          width={wide ? '36%' : undefined}
          flexGrow={wide ? 0 : 1}
        >
          <TimeField label="Prep time" iso={recipe.prepTime} />
          <TimeField label="Cook time" iso={recipe.cookTime} />
          <TimeField label="Total time" iso={recipe.totalTime} />

          {ingredients.length > 0 ? (
            <Box flexDirection="column">
              {ingredients.map((item, index) => (
                <Text key={ingredientKeys[index]} color={theme.colors.text} wrap="wrap">
                  {theme.symbols.bullet} {item}
                </Text>
              ))}
            </Box>
          ) : (
            <Text color={theme.colors.muted}>
              No ingredients were detected.
            </Text>
          )}
        </Panel>

        <Panel
          title="Method"
          eyebrow="Cook"
          accentColor={theme.colors.info}
          flexGrow={1}
        >
          {instructions.length > 0 ? (
            <Box flexDirection="column">
              {instructions.map((step, index) => (
                <Box key={instructionKeys[index]} marginBottom={1}>
                  <Text color={theme.colors.info} bold>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Text color={theme.colors.muted}>  </Text>
                  <Text color={theme.colors.text} wrap="wrap">
                    {step}
                  </Text>
                </Box>
              ))}
            </Box>
          ) : (
            <Text color={theme.colors.muted}>
              No instructions were detected.
            </Text>
          )}
        </Panel>
      </Box>
    </Box>
  );
}
