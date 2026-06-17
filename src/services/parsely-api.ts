import { assertCanAttachToken } from './auth-session.js';
import type {
  ApiRecipe,
  ApiRecipeOverride,
  ApiSuccessResponse,
  FoldersListResponse,
  ParseRecipeResponse,
  RecipesListResponse,
} from '../types/parsely-api.js';

type FetchLike = typeof fetch;

export interface ParselyApiClientOptions {
  apiBaseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  fetchFn?: FetchLike;
  allowUnsafeTokenTarget?: boolean;
}

export interface RecipesListParams {
  folder?: string;
  folderId?: string;
  search?: string;
  limit?: number;
  cursor?: string;
  sort?: string;
  tags?: string[];
  minRating?: number;
  maxTime?: number;
  showPinnedOnly?: boolean;
}

export interface PatchRecipeInput {
  selectedServings?: number | null;
  recipeOverride?: ApiRecipeOverride | null;
}

export class ParselyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'ParselyApiError';
  }
}

export class ParselyApiClient {
  private readonly apiBaseUrl: string;
  private readonly fetchFn: FetchLike;
  private readonly getAccessToken?: () => string | null | Promise<string | null>;
  private readonly allowUnsafeTokenTarget: boolean;

  constructor(options: ParselyApiClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
    this.fetchFn = options.fetchFn ?? fetch;
    this.getAccessToken = options.getAccessToken;
    this.allowUnsafeTokenTarget = options.allowUnsafeTokenTarget ?? false;
  }

  async listRecipes(params: RecipesListParams = {}): Promise<RecipesListResponse> {
    return this.request('/api/recipes', { query: encodeRecipesListParams(params) });
  }

  async getRecipe(id: string): Promise<ApiRecipe> {
    return this.request(`/api/recipes/${encodeURIComponent(id)}`);
  }

  async patchRecipe(id: string, body: PatchRecipeInput): Promise<ApiRecipe> {
    return this.request(`/api/recipes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  async deleteRecipe(id: string): Promise<ApiSuccessResponse> {
    return this.request(`/api/recipes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async parseRecipe(url: string, returnData = true): Promise<ParseRecipeResponse> {
    return this.request('/api/parse', {
      method: 'POST',
      body: { url, returnData },
    });
  }

  async saveRecipe(id: string): Promise<ApiSuccessResponse> {
    return this.request(`/api/recipes/${encodeURIComponent(id)}/save`, {
      method: 'POST',
    });
  }

  async unsaveRecipe(id: string): Promise<ApiSuccessResponse> {
    return this.request(`/api/recipes/${encodeURIComponent(id)}/save`, {
      method: 'DELETE',
    });
  }

  async toggleFavorite(id: string): Promise<ApiSuccessResponse & { isFavorite: boolean }> {
    return this.request(`/api/recipes/${encodeURIComponent(id)}/favorite`, {
      method: 'POST',
    });
  }

  async togglePin(id: string): Promise<ApiSuccessResponse & { isPinned: boolean }> {
    return this.request(`/api/recipes/${encodeURIComponent(id)}/pin`, {
      method: 'POST',
    });
  }

  async moveRecipe(recipeId: string, folderName: string): Promise<ApiSuccessResponse & { folderId: string }> {
    return this.request('/api/recipes/move', {
      method: 'POST',
      body: { recipeId, folderName },
    });
  }

  async removeFromFolder(recipeId: string, folderName: string): Promise<ApiSuccessResponse> {
    return this.request('/api/recipes/remove', {
      method: 'POST',
      body: { recipeId, folderName },
    });
  }

  async generateShareToken(id: string, rotate = false): Promise<{ shareToken: string }> {
    return this.request(`/api/recipes/${encodeURIComponent(id)}/share`, {
      method: 'POST',
      body: rotate ? { rotate } : undefined,
    });
  }

  async revokeShareToken(id: string): Promise<ApiSuccessResponse> {
    return this.request(`/api/recipes/${encodeURIComponent(id)}/share`, {
      method: 'DELETE',
    });
  }

  async listFolders(): Promise<FoldersListResponse> {
    return this.request('/api/folders');
  }

  async createFolder(name: string): Promise<{ folder: { id: string; name: string; createdAt: string } }> {
    return this.request('/api/folders', {
      method: 'POST',
      body: { name },
    });
  }

  async renameFolder(id: string, name: string): Promise<{ folder: { id: string; name: string } }> {
    return this.request(`/api/folders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { name },
    });
  }

  async deleteFolder(id: string): Promise<{ folder: { id: string } }> {
    return this.request(`/api/folders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async getFilters(): Promise<{ tags: string[] }> {
    return this.request('/api/recipes/filters');
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      query?: URLSearchParams;
    } = {},
  ): Promise<T> {
    const url = new URL(path, `${this.apiBaseUrl}/`);
    if (options.query) {
      url.search = options.query.toString();
    }

    const headers = new Headers();
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    const token = await this.getAccessToken?.();
    if (token) {
      assertCanAttachToken(this.apiBaseUrl, this.allowUnsafeTokenTarget);
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await this.fetchFn(url, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const responseBody = await parseResponseBody(response);
    if (!response.ok) {
      throw new ParselyApiError(
        extractErrorMessage(responseBody) ?? `Parsely API request failed (${response.status})`,
        response.status,
        responseBody,
      );
    }

    return responseBody as T;
  }
}

function encodeRecipesListParams(params: RecipesListParams): URLSearchParams {
  const query = new URLSearchParams();
  if (params.folder) query.set('folder', params.folder);
  if (params.folderId) query.set('folderId', params.folderId);
  if (params.search) query.set('search', params.search);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.sort) query.set('sort', params.sort);
  if (params.tags?.length) query.set('tags', params.tags.join(','));
  if (params.minRating !== undefined) query.set('minRating', String(params.minRating));
  if (params.maxTime !== undefined) query.set('maxTime', String(params.maxTime));
  if (params.showPinnedOnly !== undefined) {
    query.set('showPinnedOnly', String(params.showPinnedOnly));
  }
  return query;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error?: unknown }).error;
    return typeof error === 'string' && error.trim() ? error : null;
  }
  return null;
}
