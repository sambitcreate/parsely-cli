import test from 'node:test';
import assert from 'node:assert/strict';
import { ParselyApiClient, ParselyApiError } from '../src/services/parsely-api.js';

interface FetchCall {
  input: RequestInfo | URL;
  init?: RequestInit;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function createFetchStub(responseBody: unknown, init: ResponseInit = {}) {
  const calls: FetchCall[] = [];
  const fetchFn: typeof fetch = async (input, requestInit) => {
    calls.push({ input, init: requestInit });
    return jsonResponse(responseBody, init);
  };

  return { calls, fetchFn };
}

test('listRecipes sends bearer auth and encoded filters', async () => {
  const { calls, fetchFn } = createFetchStub({
    recipes: [],
    nextCursor: 'next',
    hasMore: true,
  });
  const api = new ParselyApiClient({
    apiBaseUrl: 'http://localhost:3000',
    getAccessToken: () => 'token-123',
    fetchFn,
  });

  const result = await api.listRecipes({
    folder: 'All Recipes',
    search: 'pie crust',
    limit: 25,
    tags: ['dessert', 'quick'],
    minRating: 4,
    maxTime: 45,
    showPinnedOnly: true,
  });

  assert.deepEqual(result, { recipes: [], nextCursor: 'next', hasMore: true });
  assert.equal(calls.length, 1);

  const url = calls[0].input as URL;
  assert.equal(url.origin, 'http://localhost:3000');
  assert.equal(url.pathname, '/api/recipes');
  assert.equal(url.searchParams.get('folder'), 'All Recipes');
  assert.equal(url.searchParams.get('search'), 'pie crust');
  assert.equal(url.searchParams.get('limit'), '25');
  assert.equal(url.searchParams.get('tags'), 'dessert,quick');
  assert.equal(url.searchParams.get('minRating'), '4');
  assert.equal(url.searchParams.get('maxTime'), '45');
  assert.equal(url.searchParams.get('showPinnedOnly'), 'true');

  const headers = calls[0].init?.headers as Headers;
  assert.equal(headers.get('Authorization'), 'Bearer token-123');
  assert.equal(calls[0].init?.method, 'GET');
});

test('parseRecipe posts JSON to the parse endpoint', async () => {
  const { calls, fetchFn } = createFetchStub({
    success: true,
    recipeId: 'recipe-1',
    recipe: { id: 'recipe-1', title: 'Soup' },
  });
  const api = new ParselyApiClient({
    apiBaseUrl: 'https://parsely.us/',
    fetchFn,
  });

  await api.parseRecipe('https://example.com/soup', true);

  assert.equal((calls[0].input as URL).href, 'https://parsely.us/api/parse');
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal((calls[0].init?.headers as Headers).get('Content-Type'), 'application/json');
  assert.equal(calls[0].init?.body, JSON.stringify({
    url: 'https://example.com/soup',
    returnData: true,
  }));
});

test('move and remove use the current REST folderName contract', async () => {
  const { calls, fetchFn } = createFetchStub({ success: true, folderId: 'folder-1' });
  const api = new ParselyApiClient({
    apiBaseUrl: 'https://parsely.us',
    fetchFn,
  });

  await api.moveRecipe('user-recipe-1', 'Weeknight');
  await api.removeFromFolder('user-recipe-1', 'Weeknight');

  assert.equal((calls[0].input as URL).pathname, '/api/recipes/move');
  assert.equal(calls[0].init?.body, JSON.stringify({
    recipeId: 'user-recipe-1',
    folderName: 'Weeknight',
  }));
  assert.equal((calls[1].input as URL).pathname, '/api/recipes/remove');
  assert.equal(calls[1].init?.body, JSON.stringify({
    recipeId: 'user-recipe-1',
    folderName: 'Weeknight',
  }));
});

test('errors include status and response body', async () => {
  const { fetchFn } = createFetchStub({ error: 'Unauthorized' }, { status: 401 });
  const api = new ParselyApiClient({
    apiBaseUrl: 'https://parsely.us',
    fetchFn,
  });

  await assert.rejects(
    api.getRecipe('recipe-1'),
    (error) => {
      assert.equal(error instanceof ParselyApiError, true);
      assert.equal((error as ParselyApiError).status, 401);
      assert.deepEqual((error as ParselyApiError).body, { error: 'Unauthorized' });
      assert.equal((error as ParselyApiError).message, 'Unauthorized');
      return true;
    },
  );
});

test('auth tokens are not sent to untrusted API hosts', async () => {
  const { calls, fetchFn } = createFetchStub({ recipes: [], nextCursor: null, hasMore: false });
  const api = new ParselyApiClient({
    apiBaseUrl: 'https://evil.example',
    getAccessToken: () => 'secret-token',
    fetchFn,
  });

  await assert.rejects(api.listRecipes(), /Refusing to send an auth token/);
  assert.equal(calls.length, 0);
});
