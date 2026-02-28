import React, { type PropsWithChildren } from 'react';
import { Box, Text, type BoxProps } from 'ink';
import { theme } from '../theme.js';

interface PanelProps extends PropsWithChildren, Omit<BoxProps, 'children'> {
  title?: string;
  eyebrow?: string;
  accentColor?: string;
}

export function Panel({
  title,
  eyebrow,
  accentColor = theme.colors.border,
  children,
  ...boxProps
}: PanelProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={accentColor}
      paddingX={1}
      paddingY={1}
      {...boxProps}
    >
      {(eyebrow || title) && (
        <Box flexDirection="column" marginBottom={1}>
          {eyebrow && (
            <Text color={theme.colors.muted}>
              {eyebrow.toUpperCase()}
            </Text>
          )}
          {title && (
            <Text bold color={accentColor}>
              {title}
            </Text>
          )}
        </Box>
      )}

      {children}
    </Box>
  );
}
