import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { useTerminalViewport } from '../hooks/useTerminalViewport.js';
import { useDisplayPalette } from '../hooks/useDisplayPalette.js';
import { detectPreferredThemeMode, resolveInitialThemeMode, setActiveTheme, theme, toggleThemeMode, type ThemeMode } from '../theme.js';
import { isCtrlShortcut, isThemeToggleShortcut } from '../utils/shortcuts.js';
import { getRenderableHeight } from '../utils/terminal.js';
import type { Folder, RecipeView } from '../models/recipe.js';
import type { RecipeRepository } from '../services/recipe-repository.js';
import { createRecipeRepositoryFromEnv } from '../services/recipe-repository-factory.js';
import {
  buildDetailLines,
  buildLibraryFolders,
  buildLibraryFooter,
  clampIndex,
  formatRecipeFlags,
  formatRecipeMeta,
  recipeHost,
  type LibraryMode,
  visibleWindow,
} from '../utils/library-layout.js';
import { sanitizeTerminalText } from '../utils/helpers.js';

type LibraryPhase = 'booting' | 'auth' | 'loading' | 'ready' | 'error';

export interface RecipeLibraryAppProps {
  repository?: RecipeRepository;
  createRepository?: () => Promise<RecipeRepository | null>;
}

function lineColor(kind: ReturnType<typeof buildDetailLines>[number]['kind']): string {
  switch (kind) {
    case 'heading':
      return theme.colors.recipeText;
    case 'accent':
      return theme.colors.secondary;
    case 'muted':
      return theme.colors.recipeMuted;
    default:
      return theme.colors.recipeSubtle;
  }
}

function folderLabel(folder: Folder, index: number, selected: boolean): string {
  const prefix = selected ? '>' : ' ';
  const name = folder.virtual ? folder.name : `${index + 1}. ${folder.name}`;
  return `${prefix} ${name}`;
}

export function RecipeLibraryApp({
  repository: injectedRepository,
  createRepository = createRecipeRepositoryFromEnv,
}: RecipeLibraryAppProps) {
  const { exit } = useApp();
  const { width, height } = useTerminalViewport();
  const renderHeight = getRenderableHeight(height);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => resolveInitialThemeMode());
  const [repository, setRepository] = useState<RecipeRepository | null>(injectedRepository ?? null);
  const [phase, setPhase] = useState<LibraryPhase>(injectedRepository ? 'loading' : 'booting');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderIndex, setFolderIndex] = useState(0);
  const [recipes, setRecipes] = useState<RecipeView[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<LibraryMode>('list');
  const [detailScroll, setDetailScroll] = useState(0);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const hasManualThemeOverride = useRef(false);
  const loadSequence = useRef(0);

  useDisplayPalette(theme.colors.recipePaper);

  const foldersForDisplay = useMemo(() => buildLibraryFolders(folders), [folders]);
  const currentFolder = foldersForDisplay[clampIndex(folderIndex, foldersForDisplay.length)] ?? foldersForDisplay[0];
  const currentFolderName = currentFolder?.name ?? 'All Recipes';
  const wide = width >= 104;
  const bodyHeight = Math.max(8, renderHeight - 5);
  const listWidth = wide ? Math.min(46, Math.max(34, Math.floor(width * 0.36))) : width - 2;
  const detailWidth = wide ? Math.max(30, width - listWidth - 6) : Math.max(20, width - 4);
  const listCapacity = Math.max(3, bodyHeight - 6);
  const detailCapacity = Math.max(4, bodyHeight - 6);
  const selectedRecipe = recipes[clampIndex(selectedIndex, recipes.length)] ?? null;
  const detailLines = selectedRecipe ? buildDetailLines(selectedRecipe, detailWidth - 4) : [];
  const maxDetailScroll = Math.max(0, detailLines.length - detailCapacity);
  const visibleRecipes = visibleWindow(recipes, selectedIndex, listCapacity);
  const visibleDetailLines = detailLines.slice(detailScroll, detailScroll + detailCapacity);
  const showList = wide || mode === 'list';
  const showDetail = wide || mode === 'detail';

  const applyThemeMode = useCallback((nextMode: ThemeMode) => {
    setActiveTheme(nextMode);
    setThemeMode(nextMode);
  }, []);

  const handleToggleTheme = useCallback(() => {
    hasManualThemeOverride.current = true;
    applyThemeMode(toggleThemeMode(themeMode));
  }, [applyThemeMode, themeMode]);

  useEffect(() => {
    let cancelled = false;

    void detectPreferredThemeMode().then((detectedMode) => {
      if (cancelled || hasManualThemeOverride.current || detectedMode === themeMode) {
        return;
      }

      applyThemeMode(detectedMode);
    });

    return () => {
      cancelled = true;
    };
  }, [applyThemeMode, themeMode]);

  useEffect(() => {
    if (injectedRepository) {
      setRepository(injectedRepository);
      return;
    }

    let cancelled = false;
    setPhase('booting');

    void createRepository().then((createdRepository) => {
      if (cancelled) return;

      if (!createdRepository) {
        setPhase('auth');
        return;
      }

      setRepository(createdRepository);
    }).catch((caught) => {
      if (cancelled) return;
      setError(caught instanceof Error ? sanitizeTerminalText(caught.message) : 'Could not open Parsely session');
      setPhase('error');
    });

    return () => {
      cancelled = true;
    };
  }, [createRepository, injectedRepository]);

  useEffect(() => {
    if (!repository) {
      return;
    }

    const sequence = ++loadSequence.current;
    setPhase('loading');
    setError('');

    void Promise.all([
      repository.listFolders(),
      repository.listRecipes({ folder: currentFolderName, limit: 100 }),
    ]).then(([nextFolders, page]) => {
      if (sequence !== loadSequence.current) {
        return;
      }

      setFolders(nextFolders);
      setRecipes(page.recipes);
      setSelectedIndex((current) => clampIndex(current, page.recipes.length));
      setDetailScroll(0);
      setPhase('ready');
    }).catch((caught) => {
      if (sequence !== loadSequence.current) {
        return;
      }

      setError(caught instanceof Error ? sanitizeTerminalText(caught.message) : 'Could not load recipes');
      setPhase('error');
    });
  }, [currentFolderName, reloadKey, repository]);

  useEffect(() => {
    setSelectedIndex((current) => clampIndex(current, recipes.length));
  }, [recipes.length]);

  useEffect(() => {
    setDetailScroll((current) => clampIndex(current, maxDetailScroll + 1));
  }, [maxDetailScroll]);

  const changeFolder = useCallback((direction: number) => {
    setFolderIndex((current) => clampIndex(current + direction, foldersForDisplay.length));
    setSelectedIndex(0);
    setDetailScroll(0);
    setMode('list');
  }, [foldersForDisplay.length]);

  useInput((input, key) => {
    if (isCtrlShortcut(input, key, 'c')) {
      exit();
      return;
    }

    if (isThemeToggleShortcut(input, key)) {
      handleToggleTheme();
      return;
    }

    if (phase === 'auth') {
      if (input.toLowerCase() === 'q' || key.escape) {
        exit();
      }
      return;
    }

    if (phase === 'error') {
      if (input.toLowerCase() === 'r') {
        setReloadKey((current) => current + 1);
        return;
      }

      if (input.toLowerCase() === 'q' || key.escape) {
        exit();
      }
      return;
    }

    if (phase !== 'ready') {
      if (input.toLowerCase() === 'q' || key.escape) {
        exit();
      }
      return;
    }

    if (input.toLowerCase() === 'q') {
      exit();
      return;
    }

    if (key.escape) {
      if (mode === 'detail' && !wide) {
        setMode('list');
      } else {
        exit();
      }
      return;
    }

    if (input === '[') {
      changeFolder(-1);
      return;
    }

    if (input === ']') {
      changeFolder(1);
      return;
    }

    if (input.toLowerCase() === 'r') {
      setReloadKey((current) => current + 1);
      return;
    }

    if ((key.leftArrow || input.toLowerCase() === 'h') && mode === 'detail') {
      setMode('list');
      return;
    }

    if ((key.rightArrow || key.return || input.toLowerCase() === 'l') && selectedRecipe) {
      setMode('detail');
      return;
    }

    const movingDetail = mode === 'detail';
    if (key.upArrow || input.toLowerCase() === 'k') {
      if (movingDetail) {
        setDetailScroll((current) => Math.max(0, current - 1));
      } else {
        setSelectedIndex((current) => clampIndex(current - 1, recipes.length));
      }
      return;
    }

    if (key.downArrow || input.toLowerCase() === 'j') {
      if (movingDetail) {
        setDetailScroll((current) => Math.min(maxDetailScroll, current + 1));
      } else {
        setSelectedIndex((current) => clampIndex(current + 1, recipes.length));
      }
      return;
    }

    if (key.pageUp && movingDetail) {
      setDetailScroll((current) => Math.max(0, current - detailCapacity));
      return;
    }

    if ((key.pageDown || input === ' ') && movingDetail) {
      setDetailScroll((current) => Math.min(maxDetailScroll, current + detailCapacity));
    }
  });

  const renderHeader = () => (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.colors.recipeText} bold>
        Parsely Library
      </Text>
      <Text color={theme.colors.recipeMuted}>
        {currentFolderName}  |  {recipes.length} recipes
      </Text>
    </Box>
  );

  const renderAuth = () => (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.colors.warning} paddingX={1} paddingY={1}>
      <Text color={theme.colors.warning} bold>
        Sign in required
      </Text>
      <Text color={theme.colors.recipeMuted}>
        Set PARSELY_AUTH_TOKEN, run `parsely login`, then reopen `parsely recipes`.
      </Text>
    </Box>
  );

  const renderLoading = () => (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.colors.border} paddingX={1} paddingY={1}>
      <Text color={theme.colors.recipeText} bold>
        Loading cookbook
      </Text>
      <Text color={theme.colors.recipeMuted}>
        Fetching recipes and folders from Parsely...
      </Text>
    </Box>
  );

  const renderError = () => (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.colors.error} paddingX={1} paddingY={1}>
      <Text color={theme.colors.error} bold>
        Could not load library
      </Text>
      <Text color={theme.colors.recipeMuted} wrap="wrap">
        {error}
      </Text>
      <Text color={theme.colors.recipeSubtle}>
        r retry  |  q quit
      </Text>
    </Box>
  );

  const renderFolders = () => (
    <Box flexDirection="column" marginBottom={1}>
      {foldersForDisplay.map((folder, index) => (
        <Text
          key={folder.id}
          color={index === folderIndex ? theme.colors.recipeText : theme.colors.recipeMuted}
          bold={index === folderIndex}
        >
          {folderLabel(folder, index, index === folderIndex)}
        </Text>
      ))}
    </Box>
  );

  const renderRecipeList = () => (
    <Box flexDirection="column" width={wide ? listWidth : '100%'} borderStyle="round" borderColor={theme.colors.recipeBorder} paddingX={1}>
      <Text color={theme.colors.recipeText} bold>
        Recipes
      </Text>
      {renderFolders()}
      {recipes.length === 0 ? (
        <Text color={theme.colors.recipeMuted}>
          No recipes in this folder.
        </Text>
      ) : (
        visibleRecipes.items.map((recipe, offset) => {
          const index = visibleRecipes.start + offset;
          const selected = index === selectedIndex;
          const flags = formatRecipeFlags(recipe);

          return (
            <Box key={recipe.id} flexDirection="column" marginBottom={1}>
              <Text color={selected ? theme.colors.recipeText : theme.colors.recipeMuted} bold={selected}>
                {selected ? '>' : ' '} {recipe.title}
              </Text>
              <Text color={selected ? theme.colors.secondary : theme.colors.recipeSubtle}>
                {formatRecipeMeta(recipe)}{flags ? `  |  ${flags}` : ''}
              </Text>
              <Text color={theme.colors.recipeSubtle}>
                {recipeHost(recipe)}
              </Text>
            </Box>
          );
        })
      )}
      {recipes.length > visibleRecipes.end && (
        <Text color={theme.colors.recipeSubtle}>
          +{recipes.length - visibleRecipes.end} more
        </Text>
      )}
    </Box>
  );

  const renderRecipeDetail = () => (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={mode === 'detail' ? theme.colors.secondary : theme.colors.border} paddingX={1}>
      <Text color={theme.colors.recipeText} bold>
        Detail
      </Text>
      {!selectedRecipe ? (
        <Text color={theme.colors.recipeMuted}>
          Choose a recipe to see details.
        </Text>
      ) : (
        visibleDetailLines.map((line, index) => (
          <Text
            key={`${detailScroll}-${index}-${line.text}`}
            color={line.kind === 'empty' ? theme.colors.recipePanel : lineColor(line.kind)}
            bold={line.kind === 'heading'}
            wrap="wrap"
          >
            {line.text || ' '}
          </Text>
        ))
      )}
    </Box>
  );

  const renderReady = () => (
    <Box flexDirection={wide ? 'row' : 'column'} gap={1} flexGrow={1}>
      {showList && renderRecipeList()}
      {showDetail && renderRecipeDetail()}
    </Box>
  );

  return (
    <Box flexDirection="column" width="100%" height={renderHeight} paddingX={1}>
      {renderHeader()}

      <Box flexDirection="column" flexGrow={1}>
        {phase === 'auth' && renderAuth()}
        {(phase === 'booting' || phase === 'loading') && renderLoading()}
        {phase === 'error' && renderError()}
        {phase === 'ready' && renderReady()}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.colors.recipeMuted}>
          {buildLibraryFooter({
            mode,
            width,
            hasRecipes: recipes.length > 0,
            detailScroll,
            maxDetailScroll,
          })}
        </Text>
      </Box>
    </Box>
  );
}
