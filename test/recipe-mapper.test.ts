import test from 'node:test';
import assert from 'node:assert/strict';
import { mapApiRecipeToView, mapRecipeListResponse } from '../src/services/recipe-mapper.js';

test('mapRecipeListResponse normalizes saved recipe fields', () => {
  const page = mapRecipeListResponse({
    recipes: [{
      id: 'user-recipe-1',
      title: '  Lemon Tart  ',
      url: 'https://example.com/tart',
      image: 'https://example.com/tart.jpg',
      data: {
        description: 'Bright dessert',
        prepTime: '20',
        cookTime: 35,
        totalTime: '55',
        servings: '8',
        ingredients: ['2 lemons', { text: '1 crust', checked: true }],
        instructions: ['Zest lemons', { text: 'Bake', step: 4 }],
        nutrition: { calories: '320' },
        tags: ['dessert', ' citrus ', ''],
      },
      selectedServings: 4,
      isFavorite: true,
      isPinned: true,
      folderId: 'folder-1',
      createdAt: 1700000000000,
    }],
    nextCursor: 'cursor-2',
    hasMore: true,
  });

  assert.equal(page.nextCursor, 'cursor-2');
  assert.equal(page.hasMore, true);
  assert.equal(page.recipes[0].id, 'user-recipe-1');
  assert.equal(page.recipes[0].title, 'Lemon Tart');
  assert.equal(page.recipes[0].imageUrl, 'https://example.com/tart.jpg');
  assert.equal(page.recipes[0].description, 'Bright dessert');
  assert.equal(page.recipes[0].prepTime, 20);
  assert.equal(page.recipes[0].cookTime, 35);
  assert.equal(page.recipes[0].totalTime, 55);
  assert.equal(page.recipes[0].servings, 8);
  assert.equal(page.recipes[0].selectedServings, 4);
  assert.deepEqual(page.recipes[0].ingredients, [
    { id: 'ing-1', text: '2 lemons', checked: false },
    { id: 'ing-2', text: '1 crust', checked: true },
  ]);
  assert.deepEqual(page.recipes[0].instructions, [
    { id: 'step-1', step: 1, text: 'Zest lemons' },
    { id: 'step-2', step: 4, text: 'Bake' },
  ]);
  assert.deepEqual(page.recipes[0].nutrition, { calories: '320' });
  assert.deepEqual(page.recipes[0].tags, ['dessert', 'citrus']);
  assert.equal(page.recipes[0].isFavorite, true);
  assert.equal(page.recipes[0].isPinned, true);
  assert.equal(page.recipes[0].folderId, 'folder-1');
  assert.equal(page.recipes[0].createdAt, '2023-11-14T22:13:20.000Z');
});

test('mapApiRecipeToView handles parse-result recipe data', () => {
  const recipe = mapApiRecipeToView({
    recipeId: 'parsed-1',
    name: 'Tomato Soup',
    data: {
      ingredients: ['tomatoes', 'stock'],
      instructions: ['Simmer', 'Blend'],
    },
  });

  assert.equal(recipe.id, 'parsed-1');
  assert.equal(recipe.title, 'Tomato Soup');
  assert.deepEqual(recipe.ingredients.map((ingredient) => ingredient.text), ['tomatoes', 'stock']);
  assert.deepEqual(recipe.instructions.map((instruction) => instruction.text), ['Simmer', 'Blend']);
  assert.equal(recipe.isFavorite, null);
  assert.equal(recipe.isPinned, null);
});

test('mapApiRecipeToView requires a recipe id', () => {
  assert.throws(
    () => mapApiRecipeToView({ title: 'Mystery recipe' }),
    /missing an id/,
  );
});
