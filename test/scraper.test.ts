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
    prepTime: 'PT15M',
    cookTime: undefined,
    totalTime: undefined,
    recipeIngredient: ['1 onion', '2 tbsp oil'],
    recipeInstructions: [{ itemListElement: [{ text: 'Saute the onion.' }, { text: 'Add the spices.' }] }],
    source: 'ai',
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
