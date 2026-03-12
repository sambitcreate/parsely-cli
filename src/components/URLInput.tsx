import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { theme } from '../theme.js';
import { normalizeRecipeUrl, sanitizeSingleLineInput } from '../utils/helpers.js';

interface URLInputProps {
  onSubmit: (url: string) => void;
  onToggleTheme?: () => void;
  mode?: 'default' | 'landing';
  width?: number;
}

export function URLInput({ onSubmit, onToggleTheme, mode = 'default', width }: URLInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const ignoreNextChange = useRef(false);
  const { stdin } = useStdin();
  const landing = mode === 'landing';
  const landingButtonLabel = '  Go  ';
  const shortcutCopy = width && width < 40
    ? 'ctrl+c exit'
    : 'ctrl+c exit  ·  ctrl+t theme';

  const handleSubmit = (input: string) => {
    const url = normalizeRecipeUrl(input);
    if (!url) {
      if (!input.trim()) {
        setError('Please enter a URL');
        return;
      }

      setError('Invalid URL. Please enter a valid recipe URL.');
      return;
    }

    setError('');
    setValue('');
    onSubmit(url);
  };

  const handleChange = (nextValue: string) => {
    if (ignoreNextChange.current) {
      ignoreNextChange.current = false;
      return;
    }

    const sanitized = sanitizeSingleLineInput(nextValue);

    setValue(sanitized);
    if (error) setError('');
  };

  useEffect(() => {
    if (!onToggleTheme) {
      return;
    }

    const handleData = (data: Buffer | string) => {
      const chunk = typeof data === 'string' ? data : data.toString('utf8');

      if (!chunk.includes('\u0014')) {
        return;
      }

      ignoreNextChange.current = true;
      onToggleTheme();
    };

    stdin.on('data', handleData);

    return () => {
      stdin.off('data', handleData);
    };
  }, [onToggleTheme, stdin]);

  return (
    <Box flexDirection="column">
      {!landing && (
        <Box marginBottom={1}>
          <Text color={theme.colors.muted}>
            Paste a recipe URL or type a hostname. Parsely will add `https://` when needed.
          </Text>
        </Box>
      )}

      <Box alignItems="center">
        <Box
          borderStyle="round"
          borderColor={landing ? theme.colors.brand : theme.colors.borderFocus}
          width={width}
          paddingX={1}
          paddingY={0}
        >
          {!landing && (
            <>
              <Text color={theme.colors.primary} bold>
                URL
              </Text>
              <Text color={theme.colors.muted}> </Text>
            </>
          )}
          <Text color={theme.colors.text}>
            <TextInput
              value={value}
              focus={true}
              onChange={handleChange}
              onSubmit={handleSubmit}
              placeholder={landing ? 'Paste recipe link here' : 'Enter recipe URL...'}
            />
          </Text>
        </Box>

        {landing && (
          <Box marginLeft={1}>
            <Text backgroundColor={theme.colors.brand} color={theme.colors.recipePaper} bold>
              {landingButtonLabel}
            </Text>
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {!landing && (
          <Text color={theme.colors.muted}>
            Press enter to scrape. Try a specific recipe page, not a site homepage.
          </Text>
        )}
        <Box justifyContent={landing ? 'center' : 'flex-end'}>
          <Text color={theme.colors.muted}>
            {shortcutCopy}
          </Text>
        </Box>
      </Box>

      {error && (
        <Box marginLeft={landing ? 0 : 2} marginTop={1} justifyContent={landing ? 'center' : undefined}>
          <Text color={theme.colors.error}>
            {theme.symbols.cross} {error}
          </Text>
        </Box>
      )}
    </Box>
  );
}
