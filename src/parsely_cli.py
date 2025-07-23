#!/usr/bin/env python
"""
Asynchronous CLI tool that fetches a recipe URL, extracts Schema.org JSON-LD,
and prints cookTime, prepTime, totalTime, recipeIngredient, recipeInstructions.
"""
import argparse
import asyncio
import json
import os
import os
import sys
import time

os.environ["TERM"] = "xterm-256color"

from typing import Any, Dict, List, Optional

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import AsyncOpenAI
from pyppeteer import launch
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.prompt import Prompt

# Load environment variables from .env.local
load_dotenv(dotenv_path=".env.local")

# ---------- Utility Helpers ------------------------------------------------- #
def iso_to_minutes(duration: str) -> int:
    """
    Convert ISO-8601 duration (e.g. PT45M, PT1H30M) to total minutes.
    """
    if not isinstance(duration, str) or not duration.startswith('PT'):
        return -1
    duration = duration[2:]
    hours = 0
    minutes = 0
    try:
        if 'H' in duration:
            parts = duration.split('H')
            hours = int(parts[0])
            duration = parts[1]
        if 'M' in duration:
            minutes = int(duration.replace('M', ''))
        return hours * 60 + minutes
    except (ValueError, IndexError):
        return -1

def find_recipe_json(scripts: List[str]) -> Optional[Dict[str, Any]]:
    """
    Iterate over <script type='application/ld+json'> blocks and return
    the first JSON-LD object whose @type is Recipe (or list containing it).
    """
    for raw in scripts:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        candidates = data if isinstance(data, list) else [data]
        for obj in candidates:
            if "@graph" in obj:
                graph_objs = obj["@graph"]
                graph_candidates = graph_objs if isinstance(graph_objs, list) else [graph_objs]
                candidates.extend(graph_candidates)
            recipe_type = obj.get("@type")
            if recipe_type == "Recipe" or (isinstance(recipe_type, list) and "Recipe" in recipe_type):
                return obj
    return None

def display_recipe(recipe: Dict[str, Any], console: Console, source: str) -> None:
    """
    Formats and displays the recipe data in a rich panel.
    """
    title = f"[bold magenta]Recipe Extract ({source})[/bold magenta]"
    output = ""
    if prep := recipe.get("prepTime"):
        output += f"[bold green]Prep Time[/bold green]: {prep} ({iso_to_minutes(prep)} minutes)\n"
    if cook := recipe.get("cookTime"):
        output += f"[bold green]Cook Time[/bold green]: {cook} ({iso_to_minutes(cook)} minutes)\n"
    if total := recipe.get("totalTime"):
        output += f"[bold green]Total Time[/bold green]: {total} ({iso_to_minutes(total)} minutes)\n"

    if ingredients := recipe.get("recipeIngredient"):
        output += "\n[bold yellow]Ingredients:[/bold yellow]\n"
        for item in ingredients:
            output += f" - {item}\n"

    instructions_raw = recipe.get("recipeInstructions", [])
    instructions: List[str] = []
    if isinstance(instructions_raw, list):
        for step in instructions_raw:
            if isinstance(step, dict):
                if "text" in step:
                    instructions.append(step["text"])
                elif "itemListElement" in step:
                    for sub_step in step.get("itemListElement", []):
                        instructions.append(sub_step.get("text", str(sub_step)))
            else:
                instructions.append(str(step))
    else:
        instructions.append(str(instructions_raw))

    if instructions:
        output += "\n[bold cyan]Instructions:[/bold cyan]\n"
        for idx, step in enumerate(instructions, 1):
            output += f"{idx}. {step}\n"

    # Ensure a newline before the panel so it starts on its own line
    console.print()
    console.print(Panel(output, title=title, expand=False))


async def scrape_with_ai(url: str, console: Console) -> None:
    """
    Fallback to OpenAI's GPT-4o-mini model to scrape the recipe.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        console.print("[bold red]Error: OpenAI API key not found. Please set it in .env.local[/bold red]")
        sys.exit(1)

    async with httpx.AsyncClient() as httpx_client:
        client = AsyncOpenAI(api_key=api_key, http_client=httpx_client)
        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a recipe scraper. Extract cookTime, prepTime, totalTime, recipeIngredient, and recipeInstructions from the provided URL. Return the data in a valid JSON object.",
                    },
                    {"role": "user", "content": f"Scrape this recipe: {url}"},
                ],
                response_format={"type": "json_object"},
            )
            recipe = json.loads(response.choices[0].message.content)
            display_recipe(recipe, console, source="AI Fallback")
        except Exception as e:
            console.print(f"[bold red]Error: AI scraping failed: {e}[/bold red]")
            sys.exit(1)


async def scrape(url: str, console: Console) -> None:
    """
    Main scraping logic with Pyppeteer and AI fallback.
    """
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        task_id = progress.add_task(description="Scraping recipe...", total=None)
        html = None
        try:
            browser = await launch(headless=True, args=['--no-sandbox'])
            page = await browser.newPage()
            await page.goto(url, {"waitUntil": "networkidle2", "timeout": 5000})
            html = await page.content()
            await browser.close()
        except Exception:
            console.print("[bold yellow]Pyppeteer failed, falling back to AI scraper...[/bold yellow]")
            progress.update(task_id, description="Scraping with AI...")
            await scrape_with_ai(url, console)
            return

        progress.update(task_id, description="Parsing recipe...")
        soup = BeautifulSoup(html, "html.parser")
        json_scripts = [tag.string for tag in soup.find_all("script", {"type": "application/ld+json"}) if tag.string]
        recipe = find_recipe_json(json_scripts)

        if recipe:
            display_recipe(recipe, console, source="JSON-LD")
        else:
            console.print("[bold yellow]No JSON-LD found, falling back to AI scraper...[/bold yellow]")
            progress.update(task_id, description="Scraping with AI...")
            await scrape_with_ai(url, console)

def main() -> None:
    parser = argparse.ArgumentParser(
        description="CLI tool that extracts recipe data from JSON-LD Schema.org blocks."
    )
    parser.add_argument("url", nargs='?', default=None, help="Absolute URL of a recipe page")
    args = parser.parse_args()

    console = Console(force_terminal=True)

    # Add the Parsely CLI heading
    console.print("""
[bold lime]
██████╗  █████╗ ██████╗ ███████╗███████╗██╗     ██╗   ██╗      ██████╗██╗     ██╗
██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔════╝██║     ╚██╗ ██╔╝     ██╔════╝██║     ██║
██████╔╝███████║██████╔╝███████╗█████╗  ██║      ╚████╔╝█████╗██║     ██║     ██║
██╔═══╝ ██╔══██║██╔══██╗╚════██║██╔══╝  ██║       ╚██╔╝ ╚════╝██║     ██║     ██║
██║     ██║  ██║██║  ██║███████║███████╗███████╗   ██║        ╚██████╗███████╗██║
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝   ╚═╝         ╚═════╝╚══════╝╚═╝
[/bold lime]

""")
    time.sleep(1) # Add a 1-second delay

    try:
        # Loop to allow multiple recipes until user exits with Ctrl+C
        while True:
            if args.url:
                url = args.url
                # Clear after first use so subsequent iterations are interactive
                args.url = None
            else:
                url = Prompt.ask("[bold]Please enter the recipe URL[/bold]")

            asyncio.get_event_loop().run_until_complete(scrape(url, console))
            console.print("\n[bold green]Recipe parsed successfully![/bold green]\n")
            # Prompt for another run; if user presses Ctrl+C, we'll exit
            # Otherwise, the loop continues and will ask for URL again
    except KeyboardInterrupt:
        console.print("\n[bold red]Exiting parsely-cli. Goodbye![/bold red]")
        sys.exit(0)


if __name__ == "__main__":
    main()