import type { Folder, RecipeIngredient, RecipeInstruction, RecipeListPage, RecipeView } from '../models/recipe.js';
import type { ApiRecipe, ApiRecipeData, FolderResponse, RecipesListResponse } from '../types/parsely-api.js';

export function mapRecipeListResponse(response: RecipesListResponse): RecipeListPage {
  return {
    recipes: response.recipes.map(mapApiRecipeToView),
    nextCursor: response.nextCursor,
    hasMore: response.hasMore,
  };
}

export function mapApiRecipeToView(recipe: ApiRecipe): RecipeView {
  const data = recipe.data ?? {};
  const id = recipe.id ?? recipe.recipeId ?? recipe._id;
  if (!id) {
    throw new Error('Recipe payload is missing an id');
  }

  return {
    id,
    title: pickString(recipe.title, recipe.name) ?? 'Untitled recipe',
    url: pickString(recipe.url) ?? undefined,
    imageUrl: pickString(recipe.imageUrl, recipe.image) ?? null,
    description: pickString(recipe.description, data.description) ?? null,
    prepTime: pickNumber(recipe.prepTime, data.prepTime),
    cookTime: pickNumber(recipe.cookTime, data.cookTime),
    totalTime: pickNumber(recipe.totalTime, data.totalTime),
    servings: pickNumber(recipe.servings, data.servings),
    selectedServings: pickNumber(recipe.selectedServings, recipe.selected_servings),
    ingredients: mapIngredients(recipe.ingredients ?? data.ingredients ?? []),
    instructions: mapInstructions(recipe.instructions ?? data.instructions ?? []),
    nutrition: recipe.nutrition ?? data.nutrition ?? null,
    tags: normalizeTags(recipe.tags ?? data.tags),
    isFavorite: typeof recipe.isFavorite === 'boolean' ? recipe.isFavorite : null,
    isPinned: typeof recipe.isPinned === 'boolean' ? recipe.isPinned : null,
    folderId: pickString(recipe.folderId) ?? null,
    createdAt: normalizeCreatedAt(recipe.createdAt),
    recipeOverride: recipe.recipeOverride ?? recipe.recipe_override ?? null,
  };
}

export function mapFolder(folder: FolderResponse): Folder {
  return {
    id: folder.id,
    name: folder.name,
    createdAt: folder.createdAt,
  };
}

function mapIngredients(raw: NonNullable<ApiRecipeData['ingredients']> | NonNullable<ApiRecipe['ingredients']>): RecipeIngredient[] {
  return raw.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `ing-${index + 1}`,
        text: item,
        checked: false,
      };
    }

    return {
      id: item.id ?? `ing-${index + 1}`,
      text: item.text,
      checked: item.checked ?? false,
    };
  }).filter((item) => item.text.trim().length > 0);
}

function mapInstructions(
  raw: NonNullable<ApiRecipeData['instructions']> | NonNullable<ApiRecipe['instructions']>,
): RecipeInstruction[] {
  return raw.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `step-${index + 1}`,
        step: index + 1,
        text: item,
      };
    }

    return {
      id: item.id ?? `step-${index + 1}`,
      step: item.step ?? index + 1,
      text: item.text,
    };
  }).filter((item) => item.text.trim().length > 0);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    .map((tag) => tag.trim());
}

function normalizeCreatedAt(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return null;
}
