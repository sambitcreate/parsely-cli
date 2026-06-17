import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDetailLines,
  buildLibraryFolders,
  buildLibraryFooter,
  clampIndex,
  formatRecipeFlags,
  formatRecipeMeta,
  visibleWindow,
} from '../src/utils/library-layout.js';
import type { RecipeView } from '../src/models/recipe.js';

const recipe: RecipeView = {
  id: 'recipe-1',
  title: 'Tomato Soup',
  url: 'https://example.com/soup',
  imageUrl: null,
  description: 'A bright pantry soup with a short ingredient list.',
  prepTime: 10,
  cookTime: 30,
  totalTime: 40,
  servings: 4,
  selectedServings: null,
  ingredients: [
    { id: 'ing-1', text: '2 cans tomatoes', checked: false },
    { id: 'ing-2', text: '1 cup stock', checked: false },
  ],
  instructions: [
    { id: 'step-1', step: 1, text: 'Simmer everything until fragrant.' },
    { id: 'step-2', step: 2, text: 'Blend until smooth.' },
  ],
  nutrition: null,
  tags: [],
  isFavorite: true,
  isPinned: false,
  folderId: 'folder-1',
  createdAt: null,
  recipeOverride: null,
};

test('buildLibraryFolders prepends virtual folders and removes duplicates', () => {
  assert.deepEqual(
    buildLibraryFolders([
      { id: 'custom-1', name: 'Weeknight' },
      { id: 'duplicate', name: 'Saved' },
    ]).map((folder) => [folder.id, folder.name, folder.virtual ?? false]),
    [
      ['all', 'All Recipes', true],
      ['saved', 'Saved', true],
      ['custom-1', 'Weeknight', false],
    ],
  );
});

test('visibleWindow keeps the selected item inside a bounded slice', () => {
  const window = visibleWindow(['a', 'b', 'c', 'd', 'e'], 3, 3);

  assert.deepEqual(window, {
    start: 2,
    end: 5,
    items: ['c', 'd', 'e'],
  });
});

test('clampIndex handles empty and out-of-range lists', () => {
  assert.equal(clampIndex(10, 0), 0);
  assert.equal(clampIndex(-2, 3), 0);
  assert.equal(clampIndex(9, 3), 2);
});

test('recipe metadata and flags stay compact for list rows', () => {
  assert.equal(formatRecipeMeta(recipe), '40 min  |  4 servings  |  2 ingredients  |  2 steps');
  assert.equal(formatRecipeFlags(recipe), 'FAV');
  assert.equal(formatRecipeFlags({ ...recipe, isFavorite: null, isPinned: null }), '');
});

test('buildDetailLines includes title, source, ingredients, and instructions', () => {
  const lines = buildDetailLines(recipe, 32);
  const text = lines.map((line) => line.text);

  assert.equal(text[0], 'Tomato Soup');
  assert.equal(text[1], 'example.com');
  assert.ok(text.includes('Ingredients'));
  assert.ok(text.includes('- 2 cans tomatoes'));
  assert.ok(text.includes('Instructions'));
  assert.ok(text.includes('01 Simmer everything until'));
});

test('buildLibraryFooter adapts to empty, list, and detail states', () => {
  assert.equal(
    buildLibraryFooter({ mode: 'list', width: 100, hasRecipes: false, detailScroll: 0, maxDetailScroll: 0 }),
    'r refresh  |  [ ] folders  |  q quit',
  );
  assert.match(
    buildLibraryFooter({ mode: 'list', width: 100, hasRecipes: true, detailScroll: 0, maxDetailScroll: 0 }),
    /enter detail/,
  );
  assert.match(
    buildLibraryFooter({ mode: 'detail', width: 60, hasRecipes: true, detailScroll: 2, maxDetailScroll: 5 }),
    /detail 3\/6/,
  );
});
