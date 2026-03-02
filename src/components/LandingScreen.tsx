import React from 'react';
import { Box, Text } from 'ink';
import CFonts from 'cfonts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { URLInput } from './URLInput.js';
import { theme } from '../theme.js';
import { useDisplayPalette } from '../hooks/useDisplayPalette.js';

interface LandingScreenProps {
  width: number;
  height: number;
  onSubmit: (url: string) => void;
}

interface LandingArt {
  lines: string[];
  width: number;
}

const logoSvg = readFileSync(
  fileURLToPath(new URL('../../public/parsely-logo.svg', import.meta.url)),
  'utf8',
);

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

export function LandingScreen({ width, height, onSubmit }: LandingScreenProps) {
  useDisplayPalette(theme.colors.recipePaper);

  const art = width >= primaryLandingArt.width + 8 ? primaryLandingArt : compactLandingArt;
  const inputWidth = width >= 120 ? 54 : width >= 84 ? 46 : Math.max(28, width - 16);
  const controlsWidth = inputWidth + 8;
  const contentWidth = Math.min(width - 6, Math.max(controlsWidth, art.width));

  return (
    <Box flexDirection="column" width="100%" height="100%" paddingX={2} paddingY={1}>
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Box flexDirection="column" alignItems="center" width={contentWidth}>
          <Box width="100%" justifyContent="center" marginBottom={2}>
            <Box flexDirection="column" width={art.width}>
              {art.lines.map((line, index) => (
                <Text key={index} color={logoColor} bold>
                  {line}
                </Text>
              ))}
            </Box>
          </Box>

          <Box width={controlsWidth} justifyContent="center">
            <URLInput onSubmit={onSubmit} mode="landing" width={inputWidth} />
          </Box>
        </Box>
      </Box>

      <Box height={1} />
    </Box>
  );
}
