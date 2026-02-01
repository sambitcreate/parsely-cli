import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Banner } from './components/Banner.js';
import { URLInput } from './components/URLInput.js';
import { RecipeCard } from './components/RecipeCard.js';
import { ScrapingStatus } from './components/ScrapingStatus.js';
import { Footer, type AppPhase } from './components/Footer.js';
import { Welcome } from './components/Welcome.js';
import { ErrorDisplay } from './components/ErrorDisplay.js';
import { scrapeRecipe, type Recipe, type ScrapeStatus } from './services/scraper.js';
import { theme } from './theme.js';

interface AppProps {
  initialUrl?: string;
}

export function App({ initialUrl }: AppProps) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<AppPhase>(initialUrl ? 'scraping' : 'idle');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [error, setError] = useState('');

  const handleScrape = useCallback(async (url: string) => {
    setPhase('scraping');
    setError('');
    setScrapeStatus({ phase: 'browser', message: 'Starting\u2026' });

    try {
      const result = await scrapeRecipe(url, (status) => {
        setScrapeStatus(status);
      });
      setRecipe(result);
      setPhase('display');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scrape recipe');
      setPhase('error');
    }
  }, []);

  const handleNewRecipe = useCallback(() => {
    setPhase('idle');
    setRecipe(null);
    setError('');
    setScrapeStatus(null);
  }, []);

  // Scrape the initial URL if provided via CLI argument
  useEffect(() => {
    if (initialUrl) {
      handleScrape(initialUrl);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Global keybinds – only active during the display phase so they
  // do not interfere with the text input in idle/error phases.
  useInput((input, key) => {
    if (phase === 'display') {
      if (input === 'n') handleNewRecipe();
      if (input === 'q') exit();
    }
    // Ctrl+C is handled by Ink automatically
    if (key.escape) {
      if (phase === 'display') exit();
    }
  });

  return (
    <Box flexDirection="column">
      <Banner />

      <Box flexDirection="column" paddingX={1}>
        {phase === 'idle' && (
          <>
            <Welcome />
            <URLInput onSubmit={handleScrape} />
          </>
        )}

        {phase === 'scraping' && scrapeStatus && (
          <ScrapingStatus status={scrapeStatus} />
        )}

        {phase === 'display' && recipe && (
          <>
            <RecipeCard recipe={recipe} />
            <Box marginTop={1} marginLeft={1}>
              <Text bold color={theme.colors.success}>
                {theme.symbols.check} Recipe parsed successfully!
              </Text>
            </Box>
          </>
        )}

        {phase === 'error' && (
          <>
            <ErrorDisplay message={error} />
            <URLInput onSubmit={handleScrape} />
          </>
        )}
      </Box>

      <Footer phase={phase} />
    </Box>
  );
}
