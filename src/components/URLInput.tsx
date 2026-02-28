import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { theme } from '../theme.js';
import { isValidUrl } from '../utils/helpers.js';

interface URLInputProps {
  onSubmit: (url: string) => void;
}

export function URLInput({ onSubmit }: URLInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Please enter a URL');
      return;
    }

    // Auto-prepend https:// if missing protocol
    const url = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;

    if (!isValidUrl(url)) {
      setError('Invalid URL. Please enter a valid recipe URL.');
      return;
    }

    setError('');
    setValue('');
    onSubmit(url);
  };

  const handleChange = (nextValue: string) => {
    const sanitized = nextValue.replace(/[\r\n]+/g, '');

    setValue(sanitized);
    if (error) setError('');

    if (sanitized !== nextValue && sanitized.trim()) {
      handleSubmit(sanitized);
    }
  };

  useInput((_input, key) => {
    if (key.return) {
      handleSubmit(value);
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.colors.muted}>
          Paste a recipe URL or type a hostname. Parsely will add `https://` when needed.
        </Text>
      </Box>
      <Box
        borderStyle="round"
        borderColor={theme.colors.borderFocus}
        paddingX={1}
        paddingY={0}
      >
        <Text color={theme.colors.primary} bold>
          URL
        </Text>
        <Text color={theme.colors.muted}> </Text>
        <TextInput
          value={value}
          focus={true}
          onChange={handleChange}
          placeholder="Enter recipe URL..."
        />
      </Box>
      <Box marginTop={1}>
        <Text color={theme.colors.muted}>
          Press enter to scrape. Try a specific recipe page, not a site homepage.
        </Text>
      </Box>
      {error && (
        <Box marginLeft={2} marginTop={0}>
          <Text color={theme.colors.error}>
            {theme.symbols.cross} {error}
          </Text>
        </Box>
      )}
    </Box>
  );
}
