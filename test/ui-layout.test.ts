import test from 'node:test';
import assert from 'node:assert/strict';
import { getLandingLayout } from '../src/components/LandingScreen.js';
import {
  buildCompactFooter,
  shouldUseCompactRecipeLayout,
  splitTitle,
} from '../src/components/RecipeCard.js';
import { getLoadingCopy, getLoadingDetail } from '../src/components/LoadingScreen.js';
import type { Recipe } from '../src/services/scraper.js';

const baseRecipe: Recipe = {
  name: 'Weeknight Pasta',
  description: 'A quick dinner.',
  prepTime: 10,
  cookTime: 20,
  totalTime: 30,
  servings: 4,
  recipeIngredient: ['pasta', 'tomatoes'],
  recipeInstructions: ['Boil pasta.', 'Make sauce.'],
  source: 'browser',
};

test('landing layout never allocates controls wider than available width', () => {
  for (const width of [24, 30, 36, 44, 80, 120]) {
    const layout = getLandingLayout(width, 72);
    const availableWidth = Math.max(12, width - 6);

    assert.ok(layout.contentWidth <= availableWidth);
    assert.ok(layout.controlsWidth <= layout.contentWidth);
    assert.ok(layout.inputWidth >= 12);
  }
});

test('landing layout hides action badge on narrow terminals', () => {
  assert.equal(getLandingLayout(30, 7).showActionBadge, false);
  assert.equal(getLandingLayout(80, 7).showActionBadge, true);
});

test('splitTitle caps lines without returning oversized merged lines', () => {
  const lines = splitTitle(
    'Lemony Garlic Miso Chicken Pasta with Branzino Gochujang Matcha Butter Sauce and Extra Crunchy Shallots',
    18,
    3,
  );

  assert.equal(lines.length, 3);
  for (const line of lines) {
    assert.ok(Array.from(line).length <= 18);
  }
  assert.equal(lines.at(-1)?.endsWith('…'), true);
});

test('large display falls back to compact layout when recipe content exceeds height', () => {
  const longRecipe: Recipe = {
    ...baseRecipe,
    recipeIngredient: Array.from({ length: 24 }, (_, index) => `Ingredient ${index + 1} with a descriptive amount`),
    recipeInstructions: Array.from(
      { length: 18 },
      (_, index) => `Step ${index + 1} has enough detail to wrap across the instruction column on typical terminals.`,
    ),
  };

  assert.equal(
    shouldUseCompactRecipeLayout({
      width: 132,
      height: 40,
      recipe: longRecipe,
      ingredients: longRecipe.recipeIngredient ?? [],
      instructions: longRecipe.recipeInstructions as string[],
    }),
    true,
  );
});

test('large display can keep short recipes in full layout', () => {
  assert.equal(
    shouldUseCompactRecipeLayout({
      width: 132,
      height: 40,
      recipe: baseRecipe,
      ingredients: baseRecipe.recipeIngredient ?? [],
      instructions: baseRecipe.recipeInstructions as string[],
    }),
    false,
  );
});

test('medium-width display accounts for stacked sidebar height', () => {
  const recipeWithNutrition: Recipe = {
    ...baseRecipe,
    nutrition: {
      calories: '400 calories',
      fatContent: '12 g',
      proteinContent: '20 g',
      carbohydrateContent: '48 g',
      fiberContent: '6 g',
      sugarContent: '8 g',
      sodiumContent: '500 mg',
    },
  };

  assert.equal(
    shouldUseCompactRecipeLayout({
      width: 118,
      height: 34,
      recipe: recipeWithNutrition,
      ingredients: recipeWithNutrition.recipeIngredient ?? [],
      instructions: recipeWithNutrition.recipeInstructions as string[],
    }),
    true,
  );
});

test('compact footer preserves scroll affordance at very narrow widths', () => {
  assert.match(buildCompactFooter(42, 2, 7), /^3\/8/);
  assert.match(buildCompactFooter(42, 2, 7), /↑↓/u);
});

test('loading copy includes phase label and raw status detail', () => {
  const status = { phase: 'ai' as const, message: 'Asking AI fallback to recover recipe data.' };

  assert.equal(getLoadingCopy(status), 'Recovering recipe...');
  assert.equal(getLoadingDetail(status), 'Asking AI fallback to recover recipe data.');
  assert.equal(getLoadingDetail(null), '');
});
