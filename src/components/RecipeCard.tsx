import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import BigText from 'ink-big-text';
import { theme } from '../theme.js';
import { buildOccurrenceKeys, formatMinutes, getUrlHost } from '../utils/helpers.js';
import { wrapText } from '../utils/text-layout.js';
import type { Recipe } from '../services/scraper.js';

interface RecipeCardProps {
  recipe: Recipe;
  width: number;
  height: number;
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

function formatTimeValue(minutes: number): string {
  if (minutes <= 0) return 'Not listed';
  return formatMinutes(minutes);
}

function buildRule(width: number, maxWidth: number): string {
  const length = Math.max(18, Math.min(width, maxWidth));
  return theme.symbols.line.repeat(length);
}

function splitTitle(title: string, maxChars: number, maxLines = 3): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return ['Untitled recipe'];
  }

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      lines.push(current);
      current = word;
      continue;
    }

    current = next;
  }

  if (current) {
    lines.push(current);
  }

  while (lines.length > maxLines) {
    const last = lines.pop();
    const prev = lines.pop();

    if (!last || !prev) {
      break;
    }

    lines.push(`${prev} ${last}`);
  }

  return lines;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box flexDirection="column" width={18} marginRight={2} marginBottom={1}>
      <Text color={theme.colors.recipeMuted} bold>
        {label}
      </Text>
      <Text color={theme.colors.recipeText} bold>
        {value}
      </Text>
    </Box>
  );
}

function SidebarCard({
  title,
  children,
}: React.PropsWithChildren<{ title: string }>) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.recipeBorder}
      paddingX={1}
      paddingY={0}
      marginBottom={1}
    >
      <Text color={theme.colors.recipeBorder} bold>
        {title}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {children}
      </Box>
    </Box>
  );
}

function DetailStack({ label, value }: { label: string; value: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.colors.recipeMuted} bold>
        {label}
      </Text>
      <Text color={theme.colors.recipeText} wrap="wrap">
        {value}
      </Text>
    </Box>
  );
}

function buildCompactHeaderLines(
  recipe: Recipe,
  sourceHost: string,
  contentWidth: number,
): string[] {
  const lines: string[] = [
    ...wrapText(recipe.name ?? 'Untitled recipe', contentWidth),
    sourceHost,
    '',
    `Prep Time  ${formatTimeValue(recipe.prepTime)}`,
    `Cook Time  ${formatTimeValue(recipe.cookTime)}`,
    `Total Time ${formatTimeValue(recipe.totalTime)}`,
  ];

  if (recipe.description) {
    lines.push('');
    lines.push(...wrapText(recipe.description, contentWidth));
  }

  lines.push('');
  return lines;
}

function buildCompactBodyLines(
  sourceHost: string,
  sourceLabel: string,
  contentWidth: number,
  ingredients: string[],
  instructions: string[],
): string[] {
  const lines: string[] = [];

  lines.push('Ingredients');
  lines.push(buildRule(contentWidth, contentWidth));
  lines.push('');

  if (ingredients.length === 0) {
    lines.push('No ingredients were detected.');
  } else {
    for (const ingredient of ingredients) {
      lines.push(...wrapText(ingredient, contentWidth, '□ ', '  '));
      lines.push('');
    }
  }

  lines.push('Instructions');
  lines.push(buildRule(contentWidth, contentWidth));
  lines.push('');

  if (instructions.length === 0) {
    lines.push('No instructions were detected.');
  } else {
    instructions.forEach((step, index) => {
      const marker = `${String(index + 1).padStart(2, '0')} `;
      lines.push(...wrapText(step, contentWidth, marker, '   '));
      lines.push('');
    });
  }

  lines.push('');
  lines.push(...wrapText(`${sourceLabel}  ${theme.symbols.dot}  ${sourceHost}`, contentWidth));
  lines.push(...wrapText('View original recipe', contentWidth));

  return lines;
}

function buildCompactFooter(width: number, scrollOffset: number, maxScroll: number): string {
  const location = maxScroll > 0 ? `${scrollOffset + 1}/${maxScroll + 1}` : '1/1';

  if (width >= 96) {
    return `${location}  ${theme.symbols.dot}  ↑↓ scroll  ${theme.symbols.dot}  pgup/pgdn jump  ${theme.symbols.dot}  ctrl+t theme  ${theme.symbols.dot}  esc back  ${theme.symbols.dot}  n new  ${theme.symbols.dot}  q quit`;
  }

  if (width >= 58) {
    return `${location}  ${theme.symbols.dot}  ↑↓ scroll  ${theme.symbols.dot}  ctrl+t theme  ${theme.symbols.dot}  esc back`;
  }

  return `ctrl+t theme  ${theme.symbols.dot}  esc back`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function RecipeCard({ recipe, width, height, sourceUrl }: RecipeCardProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const instructions = extractInstructions(recipe);
  const ingredients = recipe.recipeIngredient ?? [];
  const ingredientKeys = buildOccurrenceKeys(ingredients);
  const instructionKeys = buildOccurrenceKeys(instructions);
  const sourceHost = getUrlHost(sourceUrl) || 'original page';
  const sourceLabel = recipe.source === 'browser' ? 'Page schema' : 'AI rescue';
  const constrained = width < 110 || height < 34;

  const compactContentWidth = Math.max(24, width - 4);
  const compactHeaderLines = buildCompactHeaderLines(recipe, sourceHost, compactContentWidth);
  const compactBodyLines = buildCompactBodyLines(
    sourceHost,
    sourceLabel,
    compactContentWidth,
    ingredients,
    instructions,
  );
  const compactBodyHeight = Math.max(4, height - compactHeaderLines.length - 2);
  const maxScroll = Math.max(0, compactBodyLines.length - compactBodyHeight);
  const visibleBodyLines = compactBodyLines.slice(scrollOffset, scrollOffset + compactBodyHeight);
  const compactHeaderKeys = buildOccurrenceKeys(compactHeaderLines);
  const compactBodyKeys = buildOccurrenceKeys(compactBodyLines);

  useEffect(() => {
    setScrollOffset((current) => clamp(current, 0, maxScroll));
  }, [maxScroll]);

  useInput((input, key) => {
    if (!constrained) {
      return;
    }

    if (key.upArrow || input === 'k') {
      setScrollOffset((current) => clamp(current - 1, 0, maxScroll));
      return;
    }

    if (key.downArrow || input === 'j') {
      setScrollOffset((current) => clamp(current + 1, 0, maxScroll));
      return;
    }

    if (key.pageUp) {
      setScrollOffset((current) => clamp(current - compactBodyHeight, 0, maxScroll));
      return;
    }

    if (key.pageDown || input === ' ') {
      setScrollOffset((current) => clamp(current + compactBodyHeight, 0, maxScroll));
    }
  }, { isActive: constrained });

  const compactTitleLineCount = wrapText(recipe.name ?? 'Untitled recipe', compactContentWidth).length;
  const sourceHostLineIndex = compactTitleLineCount;

  if (constrained) {
    return (
      <Box flexDirection="column" width="100%" height="100%" paddingX={1}>
        <Box flexDirection="column">
          {compactHeaderLines.map((line, index) => {
            if (line === '') {
              return <Text key={compactHeaderKeys[index]}> </Text>;
            }

            if (index < sourceHostLineIndex) {
              return (
                <Text key={compactHeaderKeys[index]} color={theme.colors.recipeText} bold wrap="wrap">
                  {line}
                </Text>
              );
            }

            if (index === sourceHostLineIndex) {
              return (
                <Text key={compactHeaderKeys[index]} color={theme.colors.recipeSubtle}>
                  {line}
                </Text>
              );
            }

            if (line.includes('Time')) {
              return (
                <Text key={compactHeaderKeys[index]} color={theme.colors.recipeText} bold>
                  {line}
                </Text>
              );
            }

            return (
              <Text key={compactHeaderKeys[index]} color={theme.colors.recipeMuted} wrap="wrap">
                {line}
              </Text>
            );
          })}
        </Box>

        <Box flexDirection="column" flexGrow={1}>
          {visibleBodyLines.map((line, index) => {
            const bodyKey = compactBodyKeys[scrollOffset + index];
            const trimmed = line.trim();

            if (!trimmed) {
              return <Text key={bodyKey}> </Text>;
            }

            const heading = trimmed === 'Ingredients' || trimmed === 'Instructions';
            const rule = trimmed === buildRule(compactContentWidth, compactContentWidth);

            return (
              <Text
                key={bodyKey}
                color={
                  heading
                    ? theme.colors.recipeBorder
                    : rule
                      ? theme.colors.recipeSoft
                      : line.startsWith('□ ') || /^\d{2}\s/u.test(line)
                        ? theme.colors.recipeText
                        : theme.colors.recipeSubtle
                }
                bold={heading || line.startsWith('□ ') || /^\d{2}\s/u.test(line)}
              >
                {line}
              </Text>
            );
          })}
        </Box>

        <Box justifyContent="space-between">
          <Text color={theme.colors.recipeMuted}>
            {buildCompactFooter(width, scrollOffset, maxScroll)}
          </Text>
          <Text color={theme.colors.recipePaper}> </Text>
        </Box>
      </Box>
    );
  }

  const wide = width >= 124;
  const splitContent = width >= 96;
  const compact = width < 82;
  const titleLineCount = width >= 132 ? 2 : 3;
  const titleChars = Math.max(16, Math.ceil((recipe.name ?? 'Untitled recipe').length / titleLineCount) + 4);
  const titleLines = splitTitle(recipe.name ?? 'Untitled recipe', titleChars, titleLineCount);
  const heroRule = buildRule(Math.floor(width * (wide ? 0.46 : 0.7)), 62);
  const sectionRule = buildRule(Math.floor(width * (wide ? 0.5 : 0.82)), 58);
  const sidebarWidth = wide ? 30 : '100%';
  const mainWidth = wide ? '68%' : '100%';
  const showBigTitle = width >= 110 && height >= 38;

  return (
    <Box
      flexDirection="column"
      width="100%"
      height="100%"
      paddingX={compact ? 1 : 2}
      paddingY={1}
    >
      <Box flexDirection="column" flexGrow={1}>
        {showBigTitle ? (
          <Box flexDirection="column">
            {titleLines.map((line) => (
              <BigText
                key={line}
                text={line}
                font="tiny"
                colors={[theme.colors.recipeText]}
                lineHeight={0}
              />
            ))}
          </Box>
        ) : (
          <Box flexDirection="column">
            <Text color={theme.colors.recipeText} bold wrap="wrap">
              {recipe.name ?? 'Untitled recipe'}
            </Text>
          </Box>
        )}

        <Text color={theme.colors.recipeSubtle}>
          {sourceHost}
        </Text>

        <Box marginTop={1}>
          <Text color={theme.colors.recipeBorder}>{heroRule}</Text>
        </Box>

        <Box flexDirection={compact ? 'column' : 'row'} marginTop={1} marginBottom={recipe.description ? 1 : 2}>
          <Metric label="Prep Time" value={formatTimeValue(recipe.prepTime)} />
          <Metric label="Cook Time" value={formatTimeValue(recipe.cookTime)} />
          <Metric label="Total Time" value={formatTimeValue(recipe.totalTime)} />
        </Box>

        {recipe.description && (
          <Box marginBottom={2}>
            <Text color={theme.colors.recipeMuted} wrap="wrap">
              {recipe.description}
            </Text>
          </Box>
        )}

        <Box flexDirection={wide ? 'row' : 'column'} gap={3} flexGrow={1}>
          <Box flexDirection="column" flexGrow={1} width={mainWidth}>
            <Box flexDirection={splitContent ? 'row' : 'column'} gap={3} alignItems="flex-end">
              <Box width={splitContent ? '38%' : '100%'}>
                <Text color={theme.colors.recipeBorder} bold>
                  Ingredients
                </Text>
                <Text color={theme.colors.recipeBorder}>
                  {buildRule(16, 16)}
                </Text>
              </Box>
              <Box width={splitContent ? '62%' : '100%'}>
                <Text color={theme.colors.recipeMuted} bold>
                  Instructions
                </Text>
                <Text color={theme.colors.recipeSoft}>
                  {buildRule(22, 22)}
                </Text>
              </Box>
            </Box>
            <Text color={theme.colors.recipeBorder}>{sectionRule}</Text>

            <Box flexDirection={splitContent ? 'row' : 'column'} gap={4} marginTop={1} flexGrow={1}>
              <Box flexDirection="column" width={splitContent ? '38%' : '100%'}>
                {ingredients.length > 0 ? (
                  ingredients.map((item, index) => (
                    <Box key={ingredientKeys[index]} marginBottom={1}>
                      <Text color={theme.colors.recipeBorder} bold>
                        □
                      </Text>
                      <Text color={theme.colors.recipeText}> </Text>
                      <Text color={theme.colors.recipeText} bold wrap="wrap">
                        {item}
                      </Text>
                    </Box>
                  ))
                ) : (
                  <Text color={theme.colors.recipeMuted}>
                    No ingredients were detected.
                  </Text>
                )}
              </Box>

              <Box flexDirection="column" width={splitContent ? '62%' : '100%'}>
                {instructions.length > 0 ? (
                  instructions.map((step, index) => (
                    <Box key={instructionKeys[index]} marginBottom={1} flexDirection="row">
                      <Box width={4}>
                        <Text color={theme.colors.recipeBorder} bold>
                          {String(index + 1).padStart(2, '0')}
                        </Text>
                      </Box>
                      <Text color={theme.colors.recipeSubtle} wrap="wrap">
                        {step}
                      </Text>
                    </Box>
                  ))
                ) : (
                  <Text color={theme.colors.recipeMuted}>
                    No instructions were detected.
                  </Text>
                )}
              </Box>
            </Box>
          </Box>

          <Box flexDirection="column" width={sidebarWidth} minWidth={wide ? 30 : undefined} marginTop={wide ? 2 : 0}>
            <SidebarCard title="Servings">
              <Text color={theme.colors.recipeText} bold>
                {recipe.servings}
              </Text>
            </SidebarCard>

            {recipe.nutrition && (
              <SidebarCard title="Nutrition">
                {recipe.nutrition.calories && <DetailStack label="Calories" value={recipe.nutrition.calories} />}
                {recipe.nutrition.fatContent && <DetailStack label="Fat" value={recipe.nutrition.fatContent} />}
                {recipe.nutrition.proteinContent && <DetailStack label="Protein" value={recipe.nutrition.proteinContent} />}
                {recipe.nutrition.carbohydrateContent && <DetailStack label="Carbs" value={recipe.nutrition.carbohydrateContent} />}
                {recipe.nutrition.fiberContent && <DetailStack label="Fiber" value={recipe.nutrition.fiberContent} />}
                {recipe.nutrition.sugarContent && <DetailStack label="Sugar" value={recipe.nutrition.sugarContent} />}
                {recipe.nutrition.sodiumContent && <DetailStack label="Sodium" value={recipe.nutrition.sodiumContent} />}
              </SidebarCard>
            )}

            <SidebarCard title="Kitchen rhythm">
              <DetailStack label="Ingredients" value={String(ingredients.length)} />
              <DetailStack label="Steps" value={String(instructions.length)} />
              <DetailStack label="Timeline" value={formatTimeValue(recipe.totalTime)} />
            </SidebarCard>

            <SidebarCard title="Next actions">
              <Text color={theme.colors.recipeText} bold>
                n
                <Text color={theme.colors.recipeMuted}> new recipe</Text>
              </Text>
              <Text color={theme.colors.recipeText} bold>
                ctrl+t
                <Text color={theme.colors.recipeMuted}> toggle theme</Text>
              </Text>
              <Text color={theme.colors.recipeText} bold>
                q
                <Text color={theme.colors.recipeMuted}> quit</Text>
              </Text>
              <Text color={theme.colors.recipeText} bold>
                esc
                <Text color={theme.colors.recipeMuted}> back</Text>
              </Text>
            </SidebarCard>

            <Box marginTop={1}>
              <Text color={theme.colors.recipeSubtle}>
                {theme.symbols.arrow} View original recipe {theme.symbols.dot} {sourceHost}
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
