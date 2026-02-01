import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import { isoToMinutes, formatMinutes } from '../utils/helpers.js';
import type { Recipe } from '../services/scraper.js';

interface RecipeCardProps {
  recipe: Recipe;
}

/**
 * Extract instruction text from the various formats recipes use.
 */
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

function TimeField({ label, iso }: { label: string; iso?: string }) {
  if (!iso) return null;
  const mins = isoToMinutes(iso);
  return (
    <Box gap={1}>
      <Text color={theme.colors.success} bold>
        {label}
      </Text>
      <Text color={theme.colors.text}>
        {formatMinutes(mins)}
      </Text>
      <Text color={theme.colors.muted} dimColor>
        ({iso})
      </Text>
    </Box>
  );
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const instructions = extractInstructions(recipe);
  const sourceLabel = recipe.source === 'browser' ? 'JSON-LD' : 'AI Fallback';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.secondary}
      paddingX={1}
      paddingY={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={theme.colors.secondary}>
          Recipe Extract
        </Text>
        <Text color={theme.colors.muted}>
          {' '}({sourceLabel})
        </Text>
      </Box>

      {/* Recipe name */}
      {recipe.name && (
        <Box marginBottom={1}>
          <Text bold color={theme.colors.text}>
            {recipe.name}
          </Text>
        </Box>
      )}

      {/* Times */}
      {(recipe.prepTime || recipe.cookTime || recipe.totalTime) && (
        <Box flexDirection="column" marginBottom={1}>
          <TimeField label="Prep Time " iso={recipe.prepTime} />
          <TimeField label="Cook Time " iso={recipe.cookTime} />
          <TimeField label="Total Time" iso={recipe.totalTime} />
        </Box>
      )}

      {/* Ingredients */}
      {recipe.recipeIngredient && recipe.recipeIngredient.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={theme.colors.accent}>
            Ingredients
          </Text>
          {recipe.recipeIngredient.map((item, i) => (
            <Text key={i} color={theme.colors.text}>
              {'  '}{theme.symbols.bullet} {item}
            </Text>
          ))}
        </Box>
      )}

      {/* Instructions */}
      {instructions.length > 0 && (
        <Box flexDirection="column">
          <Text bold color={theme.colors.info}>
            Instructions
          </Text>
          {instructions.map((step, i) => (
            <Text key={i} color={theme.colors.text} wrap="wrap">
              {'  '}{i + 1}. {step}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
