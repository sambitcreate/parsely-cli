import React from 'react';
import { Box, Text } from 'ink';
import CFonts from 'cfonts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { URLInput } from './URLInput.js';
import { theme } from '../theme.js';
import { buildOccurrenceKeys } from '../utils/helpers.js';

interface LandingScreenProps {
  width: number;
  height: number;
  onSubmit: (url: string) => void;
  onToggleTheme?: () => void;
}

interface LandingArt {
  lines: string[];
  width: number;
}

function readLogoSvg(): string {
  try {
    return readFileSync(
      fileURLToPath(new URL('../../public/parsely-logo.svg', import.meta.url)),
      'utf8',
    );
  } catch {
    return '';
  }
}

const logoSvg = readLogoSvg();

const logoColor = logoSvg.match(/fill="(#[0-9a-fA-F]{6})"/)?.[1] ?? theme.colors.brand;

const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;
const RENDER_BOUNDS = { width: 240, height: 80 };

function getLineWidth(line: string) {
  return Array.from(line).length;
}

function trimBlankLines(lines: string[]) {
  const trimmed = [...lines];

  while (trimmed[0]?.trim() === '') {
    trimmed.shift();
  }

  while (trimmed.at(-1)?.trim() === '') {
    trimmed.pop();
  }

  return trimmed;
}

function stripCommonIndent(lines: string[]) {
  const nonEmpty = lines.filter((line) => line.trim());
  if (nonEmpty.length === 0) {
    return lines;
  }

  const indent = Math.min(
    ...nonEmpty.map((line) => line.match(/^\s*/u)?.[0].length ?? 0),
  );

  if (indent === 0) {
    return lines;
  }

  return lines.map((line) => line.slice(indent));
}

function buildLandingArt(): LandingArt {
  const rendered = CFonts.render(
    'Parsely',
    {
      font: 'block',
      align: 'left',
      colors: ['system'],
      letterSpacing: 0,
      lineHeight: 0,
      space: true,
      maxLength: 0,
    },
    false,
    0,
    RENDER_BOUNDS,
  );

  if (!rendered) {
    return {
      lines: ['PARSLEY'],
      width: 'PARSLEY'.length,
    };
  }

  const lines = stripCommonIndent(
    trimBlankLines(
      rendered.string
        .replace(ANSI_PATTERN, '')
        .split('\n')
        .map((line: string) => line.replace(/\s+$/u, '')),
    ),
  );

  return {
    lines,
    width: Math.max(...lines.map(getLineWidth)),
  };
}

const primaryLandingArt = buildLandingArt();
const compactLandingArt: LandingArt = {
  lines: ['PARSLEY'],
  width: 'PARSLEY'.length,
};

export function getLandingLayout(width: number, artWidth: number) {
  const availableWidth = Math.max(12, width - 6);
  const preferredInputWidth = width >= 120 ? 54 : width >= 84 ? 46 : Math.max(18, width - 16);
  const showActionBadge = availableWidth >= 38;
  const actionWidth = showActionBadge ? 8 : 0;
  const inputWidth = Math.max(12, Math.min(preferredInputWidth, availableWidth - actionWidth));
  const controlsWidth = inputWidth + actionWidth;
  const contentWidth = Math.min(availableWidth, Math.max(controlsWidth, Math.min(artWidth, availableWidth)));

  return {
    inputWidth,
    controlsWidth,
    contentWidth,
    showActionBadge,
  };
}

export function LandingScreen({ width, height, onSubmit, onToggleTheme }: LandingScreenProps) {
  const art = width >= primaryLandingArt.width + 8 ? primaryLandingArt : compactLandingArt;
  const artKeys = buildOccurrenceKeys(art.lines);
  const {
    inputWidth,
    controlsWidth,
    contentWidth,
    showActionBadge,
  } = getLandingLayout(width, art.width);

  return (
    <Box flexDirection="column" width="100%" height="100%" paddingX={2} paddingY={1}>
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Box flexDirection="column" alignItems="center" width={contentWidth}>
          <Box width="100%" justifyContent="center" marginBottom={2}>
            <Box flexDirection="column" width={art.width}>
              {art.lines.map((line, index) => (
                <Text key={artKeys[index]} color={logoColor} bold>
                  {line}
                </Text>
              ))}
            </Box>
          </Box>

          <Box width={controlsWidth} justifyContent="center">
            <URLInput
              onSubmit={onSubmit}
              onToggleTheme={onToggleTheme}
              mode="landing"
              width={inputWidth}
              showActionBadge={showActionBadge}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
