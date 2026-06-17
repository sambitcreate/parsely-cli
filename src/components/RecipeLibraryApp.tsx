import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
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
  folderListCapacity,
  formatRecipeFlags,
  formatRecipeMeta,
  recipeListCapacity,
  recipeHost,
  type LibraryMode,
  visibleWindow,
} from '../utils/library-layout.js';
import { normalizeRecipeUrl, sanitizeSingleLineInput, sanitizeTerminalText } from '../utils/helpers.js';

type LibraryPhase = 'booting' | 'auth' | 'loading' | 'ready' | 'error';
type TextPromptKind = 'import' | 'move' | 'create-folder' | 'rename-folder';
type ConfirmPromptKind = 'delete-recipe' | 'remove-from-folder' | 'delete-folder';
const RECIPE_PAGE_LIMIT = 100;

interface TextPromptState {
  type: 'text';
  kind: TextPromptKind;
  title: string;
  label: string;
  value: string;
  error: string;
}

interface ConfirmPromptState {
  type: 'confirm';
  kind: ConfirmPromptKind;
  title: string;
  message: string;
}

type PromptState = TextPromptState | ConfirmPromptState;

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
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreRecipes, setHasMoreRecipes] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<LibraryMode>('list');
  const [detailScroll, setDetailScroll] = useState(0);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [busyMessage, setBusyMessage] = useState('');
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [repositoryRefreshKey, setRepositoryRefreshKey] = useState(0);
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
  const folderCapacity = folderListCapacity(bodyHeight);
  const visibleFolders = visibleWindow(foldersForDisplay, folderIndex, folderCapacity);
  const listCapacity = recipeListCapacity(bodyHeight, visibleFolders.items.length);
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
  }, [createRepository, injectedRepository, repositoryRefreshKey]);

  useEffect(() => {
    if (!repository) {
      return;
    }

    const sequence = ++loadSequence.current;
    setPhase('loading');
    setError('');

    void Promise.all([
      repository.listFolders(),
      repository.listRecipes({ folder: currentFolderName, limit: RECIPE_PAGE_LIMIT }),
    ]).then(([nextFolders, page]) => {
      if (sequence !== loadSequence.current) {
        return;
      }

      setFolders(nextFolders);
      setRecipes(page.recipes);
      setNextCursor(page.nextCursor);
      setHasMoreRecipes(page.hasMore);
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

  const refreshLibrary = useCallback(() => {
    if (injectedRepository) {
      setReloadKey((current) => current + 1);
      return;
    }

    setRepository(null);
    setRepositoryRefreshKey((current) => current + 1);
  }, [injectedRepository]);

  const loadMoreRecipes = useCallback(async () => {
    if (!repository || !hasMoreRecipes || !nextCursor || busyMessage) {
      return;
    }

    setBusyMessage('Loading more recipes...');
    setError('');

    try {
      const page = await repository.listRecipes({
        folder: currentFolderName,
        limit: RECIPE_PAGE_LIMIT,
        cursor: nextCursor,
      });
      setRecipes((current) => [...current, ...page.recipes]);
      setNextCursor(page.nextCursor);
      setHasMoreRecipes(page.hasMore);
      setStatusMessage(page.hasMore ? 'Loaded more recipes.' : 'Loaded all recipes.');
    } catch (caught) {
      setError(caught instanceof Error ? sanitizeTerminalText(caught.message) : 'Could not load more recipes');
    } finally {
      setBusyMessage('');
    }
  }, [busyMessage, currentFolderName, hasMoreRecipes, nextCursor, repository]);

  const patchSelectedRecipe = useCallback((id: string, patch: Partial<RecipeView>) => {
    setRecipes((current) => current.map((recipe) => (
      recipe.id === id ? { ...recipe, ...patch } : recipe
    )));
  }, []);

  const runLibraryMutation = useCallback(async (
    busyCopy: string,
    successCopy: string,
    operation: () => Promise<void>,
    refreshAfter = true,
  ) => {
    if (!repository) {
      return;
    }

    setBusyMessage(busyCopy);
    setStatusMessage('');
    setError('');

    try {
      await operation();
      setStatusMessage(successCopy);
      if (refreshAfter) {
        refreshLibrary();
      }
    } catch (caught) {
      setStatusMessage('');
      setError(caught instanceof Error ? sanitizeTerminalText(caught.message) : 'Action failed');
    } finally {
      setBusyMessage('');
    }
  }, [refreshLibrary, repository]);

  const openTextPrompt = useCallback((kind: TextPromptKind) => {
    if (kind === 'import') {
      setPrompt({
        type: 'text',
        kind,
        title: 'Import Recipe',
        label: 'URL',
        value: '',
        error: '',
      });
      return;
    }

    if (kind === 'create-folder') {
      setPrompt({
        type: 'text',
        kind,
        title: 'Create Folder',
        label: 'Name',
        value: '',
        error: '',
      });
      return;
    }

    if (kind === 'move') {
      setPrompt({
        type: 'text',
        kind,
        title: 'Move Recipe',
        label: 'Folder',
        value: currentFolderName === 'All Recipes' ? '' : currentFolderName,
        error: '',
      });
      return;
    }

    if (!currentFolder || currentFolder.virtual) {
      setStatusMessage('Choose a custom folder before renaming.');
      return;
    }

    setPrompt({
      type: 'text',
      kind,
      title: 'Rename Folder',
      label: 'Name',
      value: currentFolder.name,
      error: '',
    });
  }, [currentFolder, currentFolderName]);

  const closePrompt = useCallback(() => {
    setPrompt(null);
  }, []);

  const updatePromptValue = useCallback((value: string) => {
    setPrompt((current) => current?.type === 'text'
      ? { ...current, value: sanitizeSingleLineInput(value), error: '' }
      : current);
  }, []);

  const submitTextPrompt = useCallback((value: string) => {
    if (!prompt || prompt.type !== 'text' || !repository) {
      return;
    }

    const trimmed = sanitizeSingleLineInput(value).trim();
    if (!trimmed) {
      setPrompt({ ...prompt, error: `${prompt.label} is required.` });
      return;
    }

    if (prompt.kind === 'import') {
      const url = normalizeRecipeUrl(trimmed);
      if (!url) {
        setPrompt({ ...prompt, error: 'Enter a valid public recipe URL.' });
        return;
      }

      closePrompt();
      void runLibraryMutation(
        'Importing recipe...',
        'Recipe imported.',
        async () => {
          await repository.importUrl(url);
        },
      );
      return;
    }

    if (prompt.kind === 'move') {
      if (!selectedRecipe) {
        closePrompt();
        return;
      }

      const recipeId = selectedRecipe.id;
      closePrompt();
      void runLibraryMutation(
        'Moving recipe...',
        `Moved to ${trimmed}.`,
        async () => {
          await repository.moveRecipe(recipeId, trimmed);
        },
      );
      return;
    }

    if (prompt.kind === 'create-folder') {
      closePrompt();
      void runLibraryMutation(
        'Creating folder...',
        `Created ${trimmed}.`,
        async () => {
          await repository.createFolder(trimmed);
        },
      );
      return;
    }

    if (!currentFolder || currentFolder.virtual) {
      closePrompt();
      return;
    }

    const folderId = currentFolder.id;
    closePrompt();
    void runLibraryMutation(
      'Renaming folder...',
      `Renamed folder to ${trimmed}.`,
      async () => {
        await repository.renameFolder(folderId, trimmed);
      },
    );
  }, [closePrompt, currentFolder, prompt, repository, runLibraryMutation, selectedRecipe]);

  const confirmPrompt = useCallback(() => {
    if (!prompt || prompt.type !== 'confirm' || !repository) {
      return;
    }

    if (prompt.kind === 'delete-recipe' && selectedRecipe) {
      const recipeId = selectedRecipe.id;
      closePrompt();
      void runLibraryMutation(
        'Deleting recipe...',
        'Recipe removed from your cookbook.',
        async () => {
          await repository.removeRecipe(recipeId);
          setRecipes((current) => current.filter((recipe) => recipe.id !== recipeId));
        },
      );
      return;
    }

    if (prompt.kind === 'remove-from-folder' && selectedRecipe) {
      const recipeId = selectedRecipe.id;
      closePrompt();
      void runLibraryMutation(
        'Removing from folder...',
        'Recipe removed from this folder.',
        async () => {
          await repository.removeFromFolder(recipeId, currentFolderName);
        },
      );
      return;
    }

    if (prompt.kind === 'delete-folder' && currentFolder && !currentFolder.virtual) {
      const folderId = currentFolder.id;
      closePrompt();
      void runLibraryMutation(
        'Deleting folder...',
        `Deleted ${currentFolder.name}.`,
        async () => {
          await repository.deleteFolder(folderId);
          setFolderIndex(0);
        },
      );
    }
  }, [closePrompt, currentFolder, currentFolderName, prompt, repository, runLibraryMutation, selectedRecipe]);

  useInput((input, key) => {
    if (isCtrlShortcut(input, key, 'c')) {
      exit();
      return;
    }

    if (isThemeToggleShortcut(input, key)) {
      handleToggleTheme();
      return;
    }

    if (prompt?.type === 'text') {
      if (key.escape) {
        closePrompt();
      }
      return;
    }

    if (prompt?.type === 'confirm') {
      if (input.toLowerCase() === 'y' || key.return) {
        confirmPrompt();
        return;
      }

      if (input.toLowerCase() === 'n' || key.escape) {
        closePrompt();
      }
      return;
    }

    if (busyMessage) {
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
        refreshLibrary();
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
      refreshLibrary();
      return;
    }

    if (input === '+' && hasMoreRecipes) {
      void loadMoreRecipes();
      return;
    }

    if (input.toLowerCase() === 'i') {
      openTextPrompt('import');
      return;
    }

    if (input.toLowerCase() === 'c') {
      openTextPrompt('create-folder');
      return;
    }

    if (input.toLowerCase() === 'e') {
      openTextPrompt('rename-folder');
      return;
    }

    if (input === 'D') {
      if (!currentFolder || currentFolder.virtual) {
        setStatusMessage('Choose a custom folder before deleting it.');
        return;
      }

      setPrompt({
        type: 'confirm',
        kind: 'delete-folder',
        title: 'Delete Folder',
        message: `Delete "${currentFolder.name}"? Recipes will move back to All Recipes.`,
      });
      return;
    }

    if (selectedRecipe && input.toLowerCase() === 'f') {
      const recipeId = selectedRecipe.id;
      const nextFavorite = !(selectedRecipe.isFavorite ?? false);
      void runLibraryMutation(
        nextFavorite ? 'Saving favorite...' : 'Removing favorite...',
        nextFavorite ? 'Marked as favorite.' : 'Removed from favorites.',
        async () => {
          const isFavorite = await repository!.setFavorite(recipeId, nextFavorite);
          patchSelectedRecipe(recipeId, { isFavorite });
        },
        false,
      );
      return;
    }

    if (selectedRecipe && input.toLowerCase() === 'p') {
      const recipeId = selectedRecipe.id;
      const nextPin = !(selectedRecipe.isPinned ?? false);
      void runLibraryMutation(
        nextPin ? 'Pinning recipe...' : 'Unpinning recipe...',
        nextPin ? 'Pinned recipe.' : 'Unpinned recipe.',
        async () => {
          const isPinned = await repository!.setPin(recipeId, nextPin);
          patchSelectedRecipe(recipeId, { isPinned });
        },
        false,
      );
      return;
    }

    if (selectedRecipe && input.toLowerCase() === 'm') {
      openTextPrompt('move');
      return;
    }

    if (selectedRecipe && input.toLowerCase() === 'u') {
      if (currentFolderName === 'All Recipes') {
        setStatusMessage('Choose Saved or a custom folder before removing from a folder.');
        return;
      }

      setPrompt({
        type: 'confirm',
        kind: 'remove-from-folder',
        title: 'Remove From Folder',
        message: `Remove "${selectedRecipe.title}" from ${currentFolderName}?`,
      });
      return;
    }

    if (selectedRecipe && input.toLowerCase() === 'd') {
      setPrompt({
        type: 'confirm',
        kind: 'delete-recipe',
        title: 'Delete Recipe',
        message: `Remove "${selectedRecipe.title}" from your cookbook?`,
      });
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
        if (selectedIndex >= recipes.length - 1 && hasMoreRecipes) {
          void loadMoreRecipes();
          return;
        }

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
        {currentFolderName}  |  {recipes.length}{hasMoreRecipes ? '+' : ''} recipes loaded
      </Text>
      {busyMessage && (
        <Text color={theme.colors.secondary}>
          {busyMessage}
        </Text>
      )}
      {!busyMessage && statusMessage && (
        <Text color={theme.colors.success}>
          {statusMessage}
        </Text>
      )}
      {phase === 'ready' && error && (
        <Text color={theme.colors.error}>
          {error}
        </Text>
      )}
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
      {visibleFolders.start > 0 && (
        <Text color={theme.colors.recipeSubtle}>
          ... {visibleFolders.start} folders above
        </Text>
      )}
      {visibleFolders.items.map((folder, offset) => {
        const index = visibleFolders.start + offset;
        return (
          <Text
            key={folder.id}
            color={index === folderIndex ? theme.colors.recipeText : theme.colors.recipeMuted}
            bold={index === folderIndex}
          >
            {folderLabel(folder, index, index === folderIndex)}
          </Text>
        );
      })}
      {visibleFolders.end < foldersForDisplay.length && (
        <Text color={theme.colors.recipeSubtle}>
          ... {foldersForDisplay.length - visibleFolders.end} more folders
        </Text>
      )}
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
      {recipes.length <= visibleRecipes.end && hasMoreRecipes && (
        <Text color={theme.colors.recipeSubtle}>
          More recipes available. Press down or + to load.
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

  const renderPrompt = () => {
    if (!prompt) {
      return null;
    }

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={theme.colors.secondary} paddingX={1} marginTop={1}>
        <Text color={theme.colors.secondary} bold>
          {prompt.title}
        </Text>
        {prompt.type === 'confirm' ? (
          <>
            <Text color={theme.colors.recipeMuted} wrap="wrap">
              {prompt.message}
            </Text>
            <Text color={theme.colors.recipeText}>
              y confirm  |  n cancel
            </Text>
          </>
        ) : (
          <>
            <Box>
              <Text color={theme.colors.recipeText} bold>
                {prompt.label}: 
              </Text>
              <TextInput
                value={prompt.value}
                focus={true}
                onChange={updatePromptValue}
                onSubmit={submitTextPrompt}
              />
            </Box>
            {prompt.error && (
              <Text color={theme.colors.error}>
                {prompt.error}
              </Text>
            )}
            <Text color={theme.colors.recipeSubtle}>
              enter submit  |  esc cancel
            </Text>
          </>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" width="100%" height={renderHeight} paddingX={1}>
      {renderHeader()}

      <Box flexDirection="column" flexGrow={1}>
        {phase === 'auth' && renderAuth()}
        {(phase === 'booting' || phase === 'loading') && renderLoading()}
        {phase === 'error' && renderError()}
        {phase === 'ready' && renderReady()}
      </Box>

      {renderPrompt()}

      <Box marginTop={1}>
        <Text color={theme.colors.recipeMuted}>
          {buildLibraryFooter({
            mode,
            width,
            hasRecipes: recipes.length > 0,
            hasMoreRecipes,
            detailScroll,
            maxDetailScroll,
          })}
        </Text>
      </Box>
    </Box>
  );
}
