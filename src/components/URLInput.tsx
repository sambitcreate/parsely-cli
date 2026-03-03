import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { theme } from '../theme.js';
import { normalizeRecipeUrl, sanitizeSingleLineInput } from '../utils/helpers.js';

interface URLInputProps {
  onSubmit: (url: string) => void;
  mode?: 'default' | 'landing';
  width?: number;
}

export function URLInput({ onSubmit, mode = 'default', width }: URLInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
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
    const sanitized = sanitizeSingleLineInput(nextValue);

    setValue(sanitized);
    if (error) setError('');
  };

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
          <TextInput
            value={value}
            focus={true}
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder={landing ? 'Paste recipe link here' : 'Enter recipe URL...'}
          />
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
