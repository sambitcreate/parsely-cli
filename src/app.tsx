import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { getRenderableHeight } from './utils/terminal.js';

interface AppProps {
  initialUrl?: string;
}

export function App({ initialUrl }: AppProps) {
  const { exit } = useApp();
  const { width, height } = useTerminalViewport();
  const renderHeight = getRenderableHeight(height);
  const [phase, setPhase] = useState<AppPhase>(initialUrl ? 'scraping' : 'idle');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [error, setError] = useState('');
  const [currentUrl, setCurrentUrl] = useState(initialUrl ?? '');
  const activeScrapeController = useRef<AbortController | null>(null);

  const wide = width >= 112;
  const roomy = width >= 86;
  const shortViewport = renderHeight < 30;
  const tightViewport = renderHeight < 24;

  const cancelActiveScrape = useCallback(() => {
    activeScrapeController.current?.abort();
    activeScrapeController.current = null;
  }, []);

  const handleScrape = useCallback(async (url: string) => {
    cancelActiveScrape();
    const controller = new AbortController();
    activeScrapeController.current = controller;

    setCurrentUrl(url);
    setPhase('scraping');
    setError('');
    setScrapeStatus({ phase: 'browser', message: 'Starting\u2026' });

    try {
      const result = await scrapeRecipe(url, (status) => {
        setScrapeStatus(status);
      }, controller.signal);

      if (controller.signal.aborted || activeScrapeController.current !== controller) {
        return;
      }

      setRecipe(result);
      setPhase('display');
    } catch (err) {
      if (controller.signal.aborted || activeScrapeController.current !== controller) {
        return;
      }

      setError(err instanceof Error ? err.message : 'Failed to scrape recipe');
      setPhase('error');
    } finally {
      if (activeScrapeController.current === controller) {
        activeScrapeController.current = null;
      }
    }
  }, [cancelActiveScrape]);

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

  useEffect(() => {
    return () => {
      cancelActiveScrape();
    };
  }, [cancelActiveScrape]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      cancelActiveScrape();
      exit();
      return;
    }

    if (phase === 'display' && input === 'n') handleNewRecipe();
    if (phase === 'display' && (input === 'q' || key.escape)) exit();
  }, { isActive: phase === 'display' || phase === 'scraping' || phase === 'idle' || phase === 'error' });

  const renderIdle = () => (
    <Box flexDirection={wide && !shortViewport ? 'row' : 'column'} gap={1} flexGrow={1}>
      <Box flexDirection="column" width={wide && !shortViewport ? '58%' : undefined}>
        {!tightViewport && (
          <Welcome compact={!roomy || shortViewport} minimal={shortViewport} />
        )}
        <Panel
          title="Paste a recipe URL"
          eyebrow="Ready"
          accentColor={theme.colors.primary}
          marginTop={tightViewport ? 0 : 1}
        >
          <URLInput onSubmit={handleScrape} />
        </Panel>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        <Panel title="Parsing pipeline" eyebrow="Browser first" accentColor={theme.colors.secondary}>
          <PhaseRail phase={phase} />
        </Panel>
        {!shortViewport && (
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
        )}
      </Box>
    </Box>
  );

  const renderScraping = () => (
    <Box flexDirection={wide && !shortViewport ? 'row' : 'column'} gap={1} flexGrow={1}>
      {scrapeStatus && (
        <ScrapingStatus status={scrapeStatus} width={width} />
      )}

      <Box flexDirection="column" width={wide && !shortViewport ? '36%' : undefined}>
        <Panel title="Pipeline" eyebrow="Live view" accentColor={theme.colors.secondary}>
          <PhaseRail phase={phase} status={scrapeStatus} recipe={recipe} />
        </Panel>
        {!shortViewport && (
          <Panel title="Fallback policy" eyebrow="Cost control" accentColor={theme.colors.info} marginTop={1}>
            <Text color={theme.colors.text}>
              Parsely keeps the fast path cheap: it only spends tokens when the page does not expose
              enough usable recipe structure.
            </Text>
          </Panel>
        )}
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
    <Box flexDirection={wide && !shortViewport ? 'row' : 'column'} gap={1} flexGrow={1}>
      <Box flexDirection="column" width={wide && !shortViewport ? '58%' : undefined}>
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
    <Box flexDirection="column" width="100%" height={renderHeight}>
      <Banner phase={phase} currentUrl={currentUrl} width={width} height={renderHeight} />

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
