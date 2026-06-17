import type { Folder, RecipeView } from '../models/recipe.js';
import { formatMinutes, getUrlHost } from './helpers.js';
import { wrapText } from './text-layout.js';

export type LibraryMode = 'list' | 'detail';

export interface VisibleWindow<T> {
  start: number;
  end: number;
  items: T[];
}

export interface DetailLine {
  text: string;
  kind: 'heading' | 'muted' | 'body' | 'accent' | 'empty';
}

const RECIPE_LIST_ROW_HEIGHT = 4;

const VIRTUAL_FOLDERS: Folder[] = [
  { id: 'all', name: 'All Recipes', virtual: true },
  { id: 'saved', name: 'Saved', virtual: true },
];

export function buildLibraryFolders(customFolders: Folder[]): Folder[] {
  return [
    ...VIRTUAL_FOLDERS,
    ...customFolders.filter((folder) => folder.name !== 'All Recipes' && folder.name !== 'Saved'),
  ];
}

export function clampIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(index, itemCount - 1));
}

export function visibleWindow<T>(items: T[], selectedIndex: number, capacity: number): VisibleWindow<T> {
  const safeCapacity = Math.max(1, capacity);
  const clampedIndex = clampIndex(selectedIndex, items.length);
  const half = Math.floor(safeCapacity / 2);
  const start = Math.max(0, Math.min(
    clampedIndex - half,
    Math.max(0, items.length - safeCapacity),
  ));
  const end = Math.min(items.length, start + safeCapacity);

  return {
    start,
    end,
    items: items.slice(start, end),
  };
}

export function folderListCapacity(availableRows: number): number {
  return Math.max(2, Math.min(6, Math.floor(Math.max(8, availableRows) / 4)));
}

export function recipeListCapacity(availableRows: number, visibleFolderRows: number): number {
  const nonRecipeRows = 4 + visibleFolderRows;
  const recipeRows = Math.max(1, availableRows - nonRecipeRows);
  return Math.max(1, Math.floor(recipeRows / RECIPE_LIST_ROW_HEIGHT));
}

export function formatRecipeTime(recipe: RecipeView): string {
  const minutes = recipe.totalTime ?? recipe.cookTime ?? recipe.prepTime;
  return minutes === null ? 'time unknown' : formatMinutes(minutes);
}

export function formatRecipeMeta(recipe: RecipeView): string {
  const parts = [
    formatRecipeTime(recipe),
    recipe.servings ? `${recipe.servings} servings` : null,
    `${recipe.ingredients.length} ingredients`,
    `${recipe.instructions.length} steps`,
  ].filter((part): part is string => Boolean(part));

  return parts.join('  |  ');
}

export function formatRecipeFlags(recipe: RecipeView): string {
  const flags: string[] = [];
  if (recipe.isPinned) flags.push('PIN');
  if (recipe.isFavorite) flags.push('FAV');
  return flags.join(' ');
}

export function recipeHost(recipe: RecipeView): string {
  return getUrlHost(recipe.url) || 'source unknown';
}

export function buildDetailLines(recipe: RecipeView, width: number): DetailLine[] {
  const contentWidth = Math.max(20, width);
  const lines: DetailLine[] = [];

  lines.push(...wrapText(recipe.title, contentWidth).map((text) => ({ text, kind: 'heading' as const })));
  lines.push({ text: recipeHost(recipe), kind: 'muted' });
  lines.push({ text: formatRecipeMeta(recipe), kind: 'accent' });

  const flags = formatRecipeFlags(recipe);
  if (flags) {
    lines.push({ text: flags, kind: 'accent' });
  }

  if (recipe.description) {
    lines.push({ text: '', kind: 'empty' });
    lines.push(...wrapText(recipe.description, contentWidth).map((text) => ({ text, kind: 'body' as const })));
  }

  lines.push({ text: '', kind: 'empty' });
  lines.push({ text: 'Ingredients', kind: 'heading' });
  if (recipe.ingredients.length === 0) {
    lines.push({ text: 'No ingredients saved for this recipe.', kind: 'muted' });
  } else {
    for (const ingredient of recipe.ingredients) {
      lines.push(...wrapText(ingredient.text, contentWidth, '- ', '  ').map((text) => ({
        text,
        kind: 'body' as const,
      })));
    }
  }

  lines.push({ text: '', kind: 'empty' });
  lines.push({ text: 'Instructions', kind: 'heading' });
  if (recipe.instructions.length === 0) {
    lines.push({ text: 'No instructions saved for this recipe.', kind: 'muted' });
  } else {
    recipe.instructions.forEach((instruction, index) => {
      const prefix = `${String(index + 1).padStart(2, '0')} `;
      lines.push(...wrapText(instruction.text, contentWidth, prefix, '   ').map((text) => ({
        text,
        kind: 'body' as const,
      })));
    });
  }

  return lines;
}

export function buildLibraryFooter({
  mode,
  width,
  hasRecipes,
  hasMoreRecipes = false,
  detailScroll,
  maxDetailScroll,
}: {
  mode: LibraryMode;
  width: number;
  hasRecipes: boolean;
  hasMoreRecipes?: boolean;
  detailScroll: number;
  maxDetailScroll: number;
}): string {
  if (!hasRecipes) {
    return 'i import  |  c folder  |  r refresh  |  [ ] folders  |  q quit';
  }

  const scroll = maxDetailScroll > 0 ? `  |  detail ${detailScroll + 1}/${maxDetailScroll + 1}` : '';

  const loadMore = hasMoreRecipes ? '  |  + more' : '';

  if (width < 72) {
    return mode === 'detail'
      ? `up/down scroll  |  left back  |  q quit${scroll}`
      : `up/down choose  |  enter detail  |  f/p  |  q quit${loadMore}`;
  }

  return mode === 'detail'
    ? `up/down scroll  |  left back  |  f fav  |  p pin  |  m move  |  d delete  |  q quit${scroll}`
    : `up/down choose  |  enter detail  |  f fav  |  p pin  |  i import  |  m move  |  c/e/D folders  |  q quit${loadMore}`;
}
