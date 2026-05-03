import test from 'node:test';
import assert from 'node:assert/strict';
import {
  containsBrowserChallenge,
  extractRecipeFromHtml,
  findRecipeJson,
  normalizeAiRecipe,
  scrapeRecipe,
} from '../src/services/scraper.js';

test('findRecipeJson returns a direct Recipe object', () => {
  const recipe = findRecipeJson([
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: 'Simple Soup',
    }),
  ]);

  assert.equal(recipe?.name, 'Simple Soup');
});

test('findRecipeJson finds a Recipe inside @graph', () => {
  const recipe = findRecipeJson([
    JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'Recipe page' },
        { '@type': 'Recipe', name: 'Graph Pasta', recipeIngredient: ['pasta'] },
      ],
    }),
  ]);

  assert.equal(recipe?.name, 'Graph Pasta');
});

test('findRecipeJson ignores invalid JSON blocks', () => {
  const recipe = findRecipeJson([
    '{"@type":"Recipe",',
    JSON.stringify({ '@type': 'Recipe', name: 'Valid Recipe' }),
  ]);

  assert.equal(recipe?.name, 'Valid Recipe');
});

test('findRecipeJson tolerates non-object JSON-LD and nested recipe nodes', () => {
  const recipe = findRecipeJson([
    JSON.stringify('not schema'),
    JSON.stringify({
      '@context': 'https://schema.org',
      mainEntity: {
        '@type': 'https://schema.org/Recipe',
        name: 'Nested Noodles',
      },
    }),
  ]);

  assert.equal(recipe?.name, 'Nested Noodles');
});

test('extractRecipeFromHtml returns a browser recipe when JSON-LD exists', () => {
  const recipe = extractRecipeFromHtml(`
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Roast Potatoes",
            "recipeIngredient": ["potatoes", "salt"]
          }
        </script>
      </head>
    </html>
  `);

  assert.equal(recipe?.name, 'Roast Potatoes');
  assert.equal(recipe?.source, 'browser');
  assert.deepEqual(recipe?.recipeIngredient, ['potatoes', 'salt']);
});

test('extractRecipeFromHtml accepts charset-qualified and commented JSON-LD blocks', () => {
  const recipe = extractRecipeFromHtml(`
    <html>
      <head>
        <script type="application/ld+json; charset=utf-8">
          <!--
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Commented Cake",
            "recipeIngredient": "1 cup flour",
            "recipeInstructions": "Bake until done."
          }
          -->
        </script>
      </head>
    </html>
  `);

  assert.equal(recipe?.name, 'Commented Cake');
  assert.deepEqual(recipe?.recipeIngredient, ['1 cup flour']);
  assert.deepEqual(recipe?.recipeInstructions, ['Bake until done.']);
});

test('extractRecipeFromHtml normalizes encoded schema text', () => {
  const recipe = extractRecipeFromHtml(`
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Best &amp; Bright Guac",
            "recipeIngredient": ["1 &amp; 1/2 avocados", "2 tbsp <strong>lime</strong> juice"],
            "recipeInstructions": [
              "Don&#39;t overmix the guacamole.",
              {
                "itemListElement": [
                  { "text": "Fold in <em>cilantro</em>." }
                ]
              }
            ]
          }
        </script>
      </head>
    </html>
  `);

  assert.equal(recipe?.name, 'Best & Bright Guac');
  assert.deepEqual(recipe?.recipeIngredient, ['1 & 1/2 avocados', '2 tbsp lime juice']);
  assert.deepEqual(recipe?.recipeInstructions, [
    "Don't overmix the guacamole.",
    { itemListElement: [{ text: 'Fold in cilantro.' }] },
  ]);
});

test('extractRecipeFromHtml strips terminal escape sequences from schema text', () => {
  const recipe = extractRecipeFromHtml(`
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "\\u001b]0;owned\\u0007Fresh Pasta",
            "recipeIngredient": ["\\u001b[31m2 cups flour\\u001b[0m"],
            "recipeInstructions": ["Mix until smooth\\u001b[2J"]
          }
        </script>
      </head>
    </html>
  `);

  assert.equal(recipe?.name, 'Fresh Pasta');
  assert.deepEqual(recipe?.recipeIngredient, ['2 cups flour']);
  assert.deepEqual(recipe?.recipeInstructions, ['Mix until smooth']);
});

test('extractRecipeFromHtml returns null when no recipe schema exists', () => {
  assert.equal(extractRecipeFromHtml('<html><body><h1>Hello</h1></body></html>'), null);
});

test('normalizeAiRecipe keeps only supported recipe fields', () => {
  const recipe = normalizeAiRecipe({
    name: ' Weeknight Curry ',
    prepTime: 'PT15M',
    recipeIngredient: [' 1 onion ', '<b>2 tbsp oil</b>'],
    recipeInstructions: {
      itemListElement: [
        { text: ' Saute the onion. ' },
        { text: '<em>Add</em> the spices.' },
      ],
    },
    source: 'browser',
    arbitrary: 'ignored',
  });

  assert.deepEqual(recipe, {
    name: 'Weeknight Curry',
    description: undefined,
    prepTime: 15,
    cookTime: 0,
    totalTime: 15,
    servings: 4,
    recipeIngredient: ['1 onion', '2 tbsp oil'],
    recipeInstructions: [{ itemListElement: [{ text: 'Saute the onion.' }, { text: 'Add the spices.' }] }],
    nutrition: null,
    source: 'ai',
  });
});

test('normalizeAiRecipe handles human-readable times and numeric nutrition', () => {
  const recipe = normalizeAiRecipe({
    name: 'Snack Plate',
    prepTime: '1 hour 15 minutes',
    cookTime: '90 seconds',
    nutrition: {
      calories: 250,
      proteinContent: { value: 12 },
    },
  });

  assert.equal(recipe.prepTime, 75);
  assert.equal(recipe.cookTime, 2);
  assert.equal(recipe.totalTime, 77);
  assert.deepEqual(recipe.nutrition, {
    calories: '250',
    fatContent: null,
    proteinContent: '12',
    carbohydrateContent: null,
    fiberContent: null,
    sugarContent: null,
    sodiumContent: null,
  });
});

test('containsBrowserChallenge detects Cloudflare challenge markup', () => {
  assert.equal(
    containsBrowserChallenge('<html><script>window._cf_chl_opt = {};</script></html>'),
    true,
  );
  assert.equal(containsBrowserChallenge('<html><body>recipe page</body></html>'), false);
});

test('scrapeRecipe rejects non-http urls before scraping starts', async () => {
  const statuses: string[] = [];

  await assert.rejects(
    scrapeRecipe('file:///etc/passwd', (status) => {
      statuses.push(status.message);
    }),
    /Invalid URL/,
  );

  assert.deepEqual(statuses, ['Invalid URL. Please enter a valid http or https recipe URL.']);
});
