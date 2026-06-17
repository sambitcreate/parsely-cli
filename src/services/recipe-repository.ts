import type { Folder, RecipeListPage, RecipeView } from '../models/recipe.js';
import type { ApiRecipeOverride } from '../types/parsely-api.js';
import type { ParselyApiClient, RecipesListParams } from './parsely-api.js';
import { mapApiRecipeToView, mapFolder, mapRecipeListResponse } from './recipe-mapper.js';

export interface RecipeRepository {
  listRecipes(params?: RecipesListParams): Promise<RecipeListPage>;
  getRecipe(id: string): Promise<RecipeView>;
  importUrl(url: string): Promise<{ recipeId: string | null; recipe: RecipeView | null; warning?: string }>;
  updateRecipeState(
    id: string,
    input: { selectedServings?: number | null; recipeOverride?: ApiRecipeOverride | null },
  ): Promise<RecipeView>;
  removeRecipe(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<boolean>;
  togglePin(id: string): Promise<boolean>;
  moveRecipe(id: string, folderName: string): Promise<string>;
  removeFromFolder(id: string, folderName: string): Promise<void>;
  listFolders(): Promise<Folder[]>;
  createFolder(name: string): Promise<Folder>;
  renameFolder(id: string, name: string): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;
  generateShareToken(id: string, rotate?: boolean): Promise<string>;
  revokeShareToken(id: string): Promise<void>;
}

export class ParselyRecipeRepository implements RecipeRepository {
  constructor(private readonly api: ParselyApiClient) {}

  async listRecipes(params: RecipesListParams = {}): Promise<RecipeListPage> {
    return mapRecipeListResponse(await this.api.listRecipes(params));
  }

  async getRecipe(id: string): Promise<RecipeView> {
    return mapApiRecipeToView(await this.api.getRecipe(id));
  }

  async importUrl(url: string): Promise<{ recipeId: string | null; recipe: RecipeView | null; warning?: string }> {
    const result = await this.api.parseRecipe(url, true);
    return {
      recipeId: result.recipeId ?? null,
      recipe: result.recipe ? mapApiRecipeToView({ ...result.recipe, id: result.recipeId }) : null,
      warning: result.warning,
    };
  }

  async updateRecipeState(
    id: string,
    input: { selectedServings?: number | null; recipeOverride?: ApiRecipeOverride | null },
  ): Promise<RecipeView> {
    return mapApiRecipeToView(await this.api.patchRecipe(id, input));
  }

  async removeRecipe(id: string): Promise<void> {
    await this.api.deleteRecipe(id);
  }

  async toggleFavorite(id: string): Promise<boolean> {
    const result = await this.api.toggleFavorite(id);
    return result.isFavorite;
  }

  async togglePin(id: string): Promise<boolean> {
    const result = await this.api.togglePin(id);
    return result.isPinned;
  }

  async moveRecipe(id: string, folderName: string): Promise<string> {
    const result = await this.api.moveRecipe(id, folderName);
    return result.folderId;
  }

  async removeFromFolder(id: string, folderName: string): Promise<void> {
    await this.api.removeFromFolder(id, folderName);
  }

  async listFolders(): Promise<Folder[]> {
    const result = await this.api.listFolders();
    return result.folders.map(mapFolder);
  }

  async createFolder(name: string): Promise<Folder> {
    const result = await this.api.createFolder(name);
    return mapFolder(result.folder);
  }

  async renameFolder(id: string, name: string): Promise<Folder> {
    const result = await this.api.renameFolder(id, name);
    return {
      id: result.folder.id,
      name: result.folder.name,
    };
  }

  async deleteFolder(id: string): Promise<void> {
    await this.api.deleteFolder(id);
  }

  async generateShareToken(id: string, rotate = false): Promise<string> {
    const result = await this.api.generateShareToken(id, rotate);
    return result.shareToken;
  }

  async revokeShareToken(id: string): Promise<void> {
    await this.api.revokeShareToken(id);
  }
}
