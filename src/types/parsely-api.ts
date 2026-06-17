export interface ApiNutritionInfo {
  calories?: string | null;
  fatContent?: string | null;
  proteinContent?: string | null;
  carbohydrateContent?: string | null;
  fiberContent?: string | null;
  sugarContent?: string | null;
  sodiumContent?: string | null;
}

export interface ApiRecipeIngredient {
  id?: string;
  text: string;
  checked?: boolean;
}

export interface ApiRecipeInstruction {
  id?: string;
  step?: number;
  text: string;
}

export interface ApiRecipeOverride {
  description?: string | null;
  servings?: number | null;
  ingredients?: ApiRecipeIngredient[];
  instructions?: ApiRecipeInstruction[];
}

export interface ApiRecipeData {
  description?: string | null;
  prepTime?: number | string | null;
  cookTime?: number | string | null;
  totalTime?: number | string | null;
  servings?: number | string | null;
  ingredients?: Array<string | ApiRecipeIngredient> | null;
  instructions?: Array<string | ApiRecipeInstruction> | null;
  nutrition?: ApiNutritionInfo | null;
  tags?: string[] | null;
  rating?: number | null;
  parsedAt?: string | null;
}

export interface ApiRecipe {
  id?: string;
  _id?: string;
  recipeId?: string;
  url?: string | null;
  title?: string | null;
  name?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  data?: ApiRecipeData | null;
  prepTime?: number | null;
  cookTime?: number | null;
  totalTime?: number | null;
  servings?: number | null;
  selectedServings?: number | null;
  selected_servings?: number | null;
  recipeOverride?: ApiRecipeOverride | null;
  recipe_override?: ApiRecipeOverride | null;
  ingredients?: ApiRecipeIngredient[] | null;
  instructions?: ApiRecipeInstruction[] | null;
  nutrition?: ApiNutritionInfo | null;
  tags?: string[] | null;
  isFavorite?: boolean;
  isPinned?: boolean;
  folderId?: string | null;
  createdAt?: string | number | null;
}

export interface RecipesListResponse {
  recipes: ApiRecipe[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface FolderResponse {
  id: string;
  name: string;
  createdAt: string;
}

export interface FoldersListResponse {
  folders: FolderResponse[];
}

export interface ParseRecipeResponse {
  success: boolean;
  recipeId?: string;
  source?: string;
  cached?: boolean;
  warning?: string;
  recipe?: ApiRecipe;
}

export interface ApiSuccessResponse {
  success: boolean;
}
