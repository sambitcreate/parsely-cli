import React, { useState } from 'react';
import { Box, Text } from 'ink';
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

  return (
    <Box flexDirection="column">
      <Box
        borderStyle="round"
        borderColor={theme.colors.borderFocus}
        paddingX={1}
      >
        <Text color={theme.colors.primary} bold>
          {'\u276F '}
        </Text>
        <TextInput
          value={value}
          onChange={(v) => {
            setValue(v);
            if (error) setError('');
          }}
          onSubmit={handleSubmit}
          placeholder="Enter recipe URL..."
        />
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
