import type { ApiNutritionInfo, ApiRecipeOverride } from '../types/parsely-api.js';

export interface RecipeIngredient {
  id: string;
  text: string;
  checked: boolean;
}

export interface RecipeInstruction {
  id: string;
  step: number;
  text: string;
}

export interface RecipeView {
  id: string;
  title: string;
  url?: string;
  imageUrl?: string | null;
  description?: string | null;
  prepTime: number | null;
  cookTime: number | null;
  totalTime: number | null;
  servings: number | null;
  selectedServings: number | null;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  nutrition: ApiNutritionInfo | null;
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  folderId: string | null;
  createdAt: string | null;
  recipeOverride: ApiRecipeOverride | null;
}

export interface Folder {
  id: string;
  name: string;
  createdAt?: string;
  virtual?: boolean;
}

export interface RecipeListPage {
  recipes: RecipeView[];
  nextCursor: string | null;
  hasMore: boolean;
}
