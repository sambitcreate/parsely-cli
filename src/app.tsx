import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Banner } from './components/Banner.js';
import { URLInput } from './components/URLInput.js';
import { RecipeCard } from './components/RecipeCard.js';
import { ScrapingStatus } from './components/ScrapingStatus.js';
import { Footer, type AppPhase } from './components/Footer.js';
import { Welcome } from './components/Welcome.js';
import { ErrorDisplay } from './components/ErrorDisplay.js';
import { Panel } from './components/Panel.js';
import { PhaseRail } from './components/PhaseRail.js';
import { scrapeRecipe, type Recipe, type ScrapeStatus } from './services/scraper.js';
import { useTerminalViewport } from './hooks/useTerminalViewport.js';
import { theme } from './theme.js';

interface AppProps {
  initialUrl?: string;
}

export function App({ initialUrl }: AppProps) {
  const { exit } = useApp();
  const { width, height } = useTerminalViewport();
  const [phase, setPhase] = useState<AppPhase>(initialUrl ? 'scraping' : 'idle');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [error, setError] = useState('');
  const [currentUrl, setCurrentUrl] = useState(initialUrl ?? '');

  const wide = width >= 112;
  const roomy = width >= 86;

  const handleScrape = useCallback(async (url: string) => {
    setCurrentUrl(url);
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
    setCurrentUrl('');
  }, []);

  useEffect(() => {
    if (initialUrl) {
      handleScrape(initialUrl);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useInput((input, key) => {
    if (phase === 'display') {
      if (input === 'n') handleNewRecipe();
      if (input === 'q') exit();
    }

    if (key.escape && phase === 'display') {
      exit();
    }
  });

  const renderIdle = () => (
    <Box flexDirection={wide ? 'row' : 'column'} gap={1} flexGrow={1}>
      <Box flexDirection="column" width={wide ? '58%' : undefined}>
        <Welcome compact={!roomy} />
        <Panel title="Paste a recipe URL" eyebrow="Ready" accentColor={theme.colors.primary} marginTop={1}>
          <URLInput onSubmit={handleScrape} />
        </Panel>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        <Panel title="Parsing pipeline" eyebrow="Browser first" accentColor={theme.colors.secondary}>
          <PhaseRail phase={phase} />
        </Panel>
        <Panel title="Best targets" eyebrow="Tips" accentColor={theme.colors.info} marginTop={1}>
          <Text color={theme.colors.text}>
            {theme.symbols.bullet} Dedicated recipe pages with ingredient lists and cook times.
          </Text>
          <Text color={theme.colors.text}>
            {theme.symbols.bullet} Sites that publish Schema.org Recipe metadata.
          </Text>
          <Text color={theme.colors.text}>
            {theme.symbols.bullet} Pages that work in a normal browser without a login wall.
          </Text>
        </Panel>
      </Box>
    </Box>
  );

  const renderScraping = () => (
    <Box flexDirection={wide ? 'row' : 'column'} gap={1} flexGrow={1}>
      {scrapeStatus && (
        <ScrapingStatus status={scrapeStatus} width={width} />
      )}

      <Box flexDirection="column" width={wide ? '36%' : undefined}>
        <Panel title="Pipeline" eyebrow="Live view" accentColor={theme.colors.secondary}>
          <PhaseRail phase={phase} status={scrapeStatus} recipe={recipe} />
        </Panel>
        <Panel title="Fallback policy" eyebrow="Cost control" accentColor={theme.colors.info} marginTop={1}>
          <Text color={theme.colors.text}>
            Parsely keeps the fast path cheap: it only spends tokens when the page does not expose
            enough usable recipe structure.
          </Text>
        </Panel>
      </Box>
    </Box>
  );

  const renderDisplay = () => (
    <Box flexDirection="column" flexGrow={1}>
      {recipe && (
        <RecipeCard recipe={recipe} width={width} sourceUrl={currentUrl} />
      )}
    </Box>
  );

  const renderError = () => (
    <Box flexDirection={wide ? 'row' : 'column'} gap={1} flexGrow={1}>
      <Box flexDirection="column" width={wide ? '58%' : undefined}>
        <ErrorDisplay message={error} />
        <Panel title="Try another URL" eyebrow="Retry" accentColor={theme.colors.primary}>
          <URLInput onSubmit={handleScrape} />
        </Panel>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        <Panel title="Pipeline" eyebrow="What happened" accentColor={theme.colors.secondary}>
          <PhaseRail phase={phase} status={scrapeStatus} recipe={recipe} />
        </Panel>
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" width="100%" height={height}>
      <Banner phase={phase} currentUrl={currentUrl} width={width} />

      <Box flexDirection="column" flexGrow={1}>
        {phase === 'idle' && renderIdle()}
        {phase === 'scraping' && renderScraping()}
        {phase === 'display' && renderDisplay()}
        {phase === 'error' && renderError()}
      </Box>

      <Footer phase={phase} width={width} />
    </Box>
  );
}
