# Build Process for the Python CLI parsely-cli

This document outlines the development process of the recipe scraper application, including the challenges faced and the solutions implemented.

## 1. Initial Scaffolding

The application was initially built based on the provided markdown file, `Python CLI parsely-cli Using Pyppeteer.md`. The initial scaffolding involved creating the following file structure:

```
/parsely-cli
├── src
│   ├── __init__.py
│   └── recipe_scraper.py
├── requirements.txt
└── run.sh
```

## 2. Fixing the `TypeError`

The first issue encountered was a `TypeError` caused by an attempt to create a set with a list inside it. This was fixed by updating the logic to correctly check the recipe type.

## 3. Fixing the `iso_to_minutes` Function

The script was initially using `dateutil.parser.isoparse` to parse ISO 8601 durations, which was not suitable for this task and resulted in incorrect time calculations. This was fixed by implementing a manual parser that correctly handles durations like `PT10M`.

## 4. Enhancing the CLI

To improve the user experience, the CLI was enhanced with the following features:

*   **Interactive URL Prompt:** If no URL is provided, the script now prompts the user to enter one.
*   **Loading Spinner:** A loading spinner is displayed while the script is scraping the recipe.
*   **Colorful Output:** The recipe output is now formatted with colors and presented in a clean, easy-to-read panel.

These enhancements were implemented using the `rich` library.

## 5. Implementing the AI Fallback

To make the scraper more robust, an AI fallback was implemented using OpenAI's `gpt-4o-mini` model. This fallback is triggered if the initial scraping attempt with Pyppeteer fails or if no JSON-LD data is found.

This involved:

*   Creating a `.env.local` file for the OpenAI API key.
*   Adding the `openai` and `python-dotenv` libraries to `requirements.txt`.
*   Refactoring `recipe_scraper.py` to include the AI fallback logic.

## 6. Fixing the `TypeError` with the OpenAI Client

When implementing the AI fallback, a `TypeError` occurred because an unexpected `proxies` argument was being passed to the OpenAI client. This was resolved by explicitly creating a custom `httpx` client that ignores system-wide proxy settings.

## 7. Fixing the `LiveError`

A `LiveError` occurred because the script was trying to run a loading spinner inside another one. This was fixed by refactoring the code to ensure only one spinner is active at a time and by creating a dedicated function to display the recipe output.

## 8. Final Application

The final application is a robust, user-friendly, and visually appealing recipe scraper that can handle both standard and difficult-to-scrape websites automatically. It provides a seamless user experience with its interactive prompt, loading spinner, and colorful output.
