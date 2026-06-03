"""
Scrape a16z portfolio via Playwright (JS-rendered SPA).
Outputs data/a16z_companies.json in the shared schema.

Usage:
    pip install playwright
    playwright install chromium
    python scripts/scrape_a16z.py
"""

import asyncio
import json
import re
from playwright.async_api import async_playwright

URL = "https://a16z.com/portfolio/"

# a16z categorizes investments under these funds — we use them as tags
FUND_LABELS = {
    "a16z": "a16z",
    "a16z bio": "a16z Bio",
    "a16z crypto": "a16z Crypto",
    "a16z games": "a16z Games",
    "a16z growth": "a16z Growth",
    "american dynamism": "American Dynamism",
}

async def scrape() -> list[dict]:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        print(f"Loading {URL} ...")
        await page.goto(URL, wait_until="networkidle", timeout=60000)

        # Scroll to load lazy content
        for _ in range(8):
            await page.evaluate("window.scrollBy(0, window.innerHeight)")
            await asyncio.sleep(0.8)

        # Each portfolio company is a card/link
        # a16z renders them as <a> tags with company name + category
        companies = await page.evaluate("""() => {
            const results = [];
            // Primary selector: portfolio grid items
            const cards = document.querySelectorAll('[class*="portfolio"] a, [class*="company"] a');
            for (const card of cards) {
                const name = card.querySelector('h3, h4, [class*="name"], [class*="title"]')?.textContent?.trim()
                    || card.textContent?.trim();
                const category = card.closest('[class*="category"], [data-category]')
                    ?.getAttribute('data-category')
                    || card.closest('[class*="sector"]')?.textContent?.trim()
                    || '';
                const href = card.href || '';
                if (name && name.length < 80 && href.includes('a16z.com')) {
                    results.push({ name, category, href });
                }
            }
            return results;
        }""")

        if not companies:
            # Fallback: grab all visible text blocks that look like company names
            print("  Primary selectors found nothing, trying fallback...")
            companies = await page.evaluate("""() => {
                const results = [];
                const links = document.querySelectorAll('a[href]');
                for (const a of links) {
                    const text = a.textContent.trim();
                    // Skip navigation/footer noise
                    if (text.length > 1 && text.length < 60
                        && !text.includes('\\n')
                        && a.href.includes('/portfolio/')) {
                        results.push({ name: text, category: '', href: a.href });
                    }
                }
                return results;
            }""")

        await browser.close()
        return companies

def normalize(raw: dict) -> dict:
    name = raw.get("name", "").strip()
    category = raw.get("category", "").strip()
    href = raw.get("href", "")

    # Derive website from portfolio slug if possible
    slug_match = re.search(r'/portfolio/([^/]+)', href)
    website = f"https://{slug_match.group(1)}.com" if slug_match else ""

    tags = []
    for key, label in FUND_LABELS.items():
        if key in category.lower():
            tags.append(label)
    if not tags and category:
        tags = [category]

    return {
        "name": name,
        "aliases": [],
        "description": "",
        "categories": tags or ["Tech"],
        "stage": "a16z Portfolio",
        "investors": ["Andreessen Horowitz"],
        "regions": ["USA"],
        "tags": tags,
        "website": website,
        "source": "a16z",
    }

async def main():
    raw = await scrape()
    # Deduplicate by name
    seen = set()
    companies = []
    for r in raw:
        name = r.get("name", "").strip()
        if name and name.lower() not in seen:
            seen.add(name.lower())
            companies.append(normalize(r))

    print(f"Found {len(companies)} companies.")

    out_path = "extension/data/a16z_companies.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(companies, f, ensure_ascii=False, indent=2)
    print(f"Saved to {out_path}")

if __name__ == "__main__":
    asyncio.run(main())
