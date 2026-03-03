import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Banner } from './components/Banner.js';
import { URLInput } from './components/URLInput.js';
import { RecipeCard } from './components/RecipeCard.js';
import { Footer, type AppPhase } from './components/Footer.js';
import { ErrorDisplay } from './components/ErrorDisplay.js';
import { Panel } from './components/Panel.js';
import { PhaseRail } from './components/PhaseRail.js';
import { scrapeRecipe, type Recipe, type ScrapeStatus } from './services/scraper.js';
import { useTerminalViewport } from './hooks/useTerminalViewport.js';
import { theme } from './theme.js';
import { sanitizeTerminalText } from './utils/helpers.js';
import { getRenderableHeight } from './utils/terminal.js';
import { LandingScreen } from './components/LandingScreen.js';
import { LoadingScreen } from './components/LoadingScreen.js';

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
  const initialScrapeStarted = useRef(false);

  const wide = width >= 112;
  const shortViewport = renderHeight < 30;

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

      setError(err instanceof Error ? sanitizeTerminalText(err.message) : 'Failed to scrape recipe');
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
    if (!initialUrl || initialScrapeStarted.current) {
      return;
    }

    initialScrapeStarted.current = true;
    void handleScrape(initialUrl);
  }, [handleScrape, initialUrl]);

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
    if (phase === 'display' && input === 'q') exit();
    if (phase === 'display' && key.escape) handleNewRecipe();
  }, { isActive: phase === 'display' || phase === 'scraping' || phase === 'idle' || phase === 'error' });

  const renderIdle = () => (
    <LandingScreen width={width} height={renderHeight} onSubmit={handleScrape} />
  );

  const renderScraping = () => (
    <LoadingScreen status={scrapeStatus} />
  );

  const renderDisplay = () => (
    <Box flexDirection="column" flexGrow={1}>
      {recipe && (
        <RecipeCard recipe={recipe} width={width} height={renderHeight} sourceUrl={currentUrl} />
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

  if (phase === 'display') {
    return (
      <Box flexDirection="column" width="100%" height={renderHeight}>
        {renderDisplay()}
      </Box>
    );
  }

  if (phase === 'idle') {
    return (
      <Box flexDirection="column" width="100%" height={renderHeight}>
        {renderIdle()}
      </Box>
    );
  }

  if (phase === 'scraping') {
    return (
      <Box flexDirection="column" width="100%" height={renderHeight}>
        {renderScraping()}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" height={renderHeight}>
      <Banner phase={phase} currentUrl={currentUrl} width={width} height={renderHeight} />

      <Box flexDirection="column" flexGrow={1}>
        {phase === 'error' && renderError()}
      </Box>

      <Footer phase={phase} width={width} />
    </Box>
  );
}
