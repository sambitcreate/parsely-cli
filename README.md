# parsely-cli

This project provides a robust and user-friendly command-line interface (CLI) tool for extracting recipe information from various websites. It leverages Pyppeteer for efficient web scraping and includes an intelligent AI fallback mechanism using OpenAI's `gpt-4o-mini` model for sites that are difficult to scrape directly.

## Features

*   **Pyppeteer-based Scraping:** Utilizes headless Chrome for fast and accurate extraction of Schema.org JSON-LD data.
*   **AI Fallback:** Automatically switches to OpenAI's `gpt-4o-mini` for recipe extraction if direct scraping fails or JSON-LD is not found.
*   **Interactive CLI:** Provides a colorful and animated command-line experience with loading indicators and prompts for user input.
*   **Structured Output:** Extracts key recipe details including `cookTime`, `prepTime`, `totalTime`, `recipeIngredient`, and `recipeInstructions`.

## Project Structure

```
parsely-cli/
├── .env.local          # Configuration for API keys (e.g., OpenAI)
├── README.md           # Project overview and instructions
├── requirements.txt    # Python dependencies
├── run.sh              # Helper script to set up environment and run the app
└── src/
    ├── __init__.py
    └── recipe_scraper.py # Main application logic
```

## Setup and Installation

To get started with the recipe extractor, follow these steps:

1.  **Clone the Repository (if applicable):**

    ```bash
    git clone <your-repository-url>
    cd parsely-cli
    ```

2.  **Create `.env.local` for API Keys:**

    Create a file named `.env.local` in the `parsely-cli/` directory and add your OpenAI API key:

    ```
    OPENAI_API_KEY="YOUR_API_KEY_HERE"
    ```

    **Important:** Replace `"YOUR_API_KEY_HERE"` with your actual OpenAI API key. Without this, the AI fallback will not function.

3.  **Run the Setup Script:**

    The `run.sh` script will set up a Python virtual environment, install all necessary dependencies, and prepare the application for use. Navigate to the `parsely-cli` directory and run:

    ```bash
    ./run.sh
    ```

    The first time you run this, it will download Chromium for Pyppeteer (approx. 150 MB) and install all Python packages. This might take a few moments.

## Usage

Once set up, you can use the CLI tool in two ways:

### 1. With a URL Argument

Provide the recipe URL directly as an argument to the `run.sh` script:

```bash
./run.sh https://www.simplyrecipes.com/recipes/perfect_guacamole/
```

### 2. Interactive Mode

If you run `run.sh` without a URL, the CLI will enter an interactive mode and prompt you to enter the recipe URL:

```bash
./run.sh
```

Follow the on-screen prompts to enter the URL. The CLI will display a loading spinner and colorful output as it processes the recipe.

## How it Works

1.  **Initial Scraping (Pyppeteer):** The tool first attempts to scrape the recipe using Pyppeteer, which renders the web page and looks for Schema.org JSON-LD data. This is the fastest and most accurate method when available.
2.  **AI Fallback (OpenAI GPT-4o-mini):** If Pyppeteer fails to fetch the page (e.g., due to timeouts) or if no JSON-LD is found on the page, the tool automatically falls back to using OpenAI's `gpt-4o-mini` model. It sends the URL to the AI, which then extracts the relevant recipe information.
3.  **Unified Output:** Regardless of the scraping method, the extracted recipe data is normalized and presented in a consistent, easy-to-read, and colorful format in your terminal.

## Troubleshooting

*   **`EOFError: EOF when reading a line`:** This error typically occurs in non-interactive environments (like some IDE terminals or automated scripts) when the `Prompt.ask()` function is used. To avoid this, always provide the URL as a command-line argument in such environments.
*   **`TypeError: Invalid http_client argument`:** Ensure your `httpx` and `openai` library versions are compatible. The provided `requirements.txt` should handle this. If you encounter this, ensure you've run `./run.sh` to install/update dependencies.
*   **`Error: OpenAI API key not found`:** Make sure you have created the `.env.local` file in the `parsely-cli/` directory and replaced `"YOUR_API_KEY_HERE"` with your actual OpenAI API key.