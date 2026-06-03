"""
Sequoia Capital portfolio — sequoiacap.com/companies
使用 Playwright 渲染 JS 页面
"""
import json, asyncio, re
from playwright.async_api import async_playwright

URL = "https://www.sequoiacap.com/companies/"

async def scrape():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.set_extra_http_headers({"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"})
        print("Loading Sequoia portfolio...")
        await page.goto(URL, timeout=60000, wait_until="networkidle")
        await page.wait_for_timeout(3000)

        # Scroll to load all companies
        for _ in range(10):
            await page.evaluate("window.scrollBy(0, 1500)")
            await page.wait_for_timeout(800)

        companies = await page.evaluate("""() => {
            const results = [];
            // Try multiple selectors
            const cards = document.querySelectorAll(
                '.company-card, .portfolio-company, [class*="CompanyCard"], [class*="company-item"], ' +
                'article, [class*="portfolio-item"], [class*="PortfolioItem"]'
            );
            cards.forEach(card => {
                const nameEl = card.querySelector('h2, h3, h4, [class*="name"], [class*="title"]');
                const descEl = card.querySelector('p, [class*="desc"], [class*="description"]');
                const tagEls = card.querySelectorAll('[class*="tag"], [class*="sector"], [class*="category"]');
                if (!nameEl) return;
                const name = nameEl.textContent.trim();
                if (!name || name.length > 80) return;
                results.push({
                    name,
                    desc: descEl?.textContent?.trim() || '',
                    tags: [...tagEls].map(t => t.textContent.trim()).filter(Boolean),
                });
            });
            return results;
        }""")

        await browser.close()
        return companies

def build_entries(raw):
    out = []
    seen = set()
    for r in raw:
        name = r["name"]
        if name in seen or len(name) < 2:
            continue
        seen.add(name)
        out.append({
            "name": name,
            "stage": "Series A+",
            "investors": ["Sequoia Capital"],
            "description": r["desc"][:120] if r["desc"] else "",
            "tags": r["tags"][:3],
            "regions": [],
            "source": "sequoia",
        })
    return out

if __name__ == "__main__":
    raw = asyncio.run(scrape())
    companies = build_entries(raw)
    out = "extension/data/sequoia_companies.json"
    with open(out, "w") as f:
        json.dump(companies, f, ensure_ascii=False, indent=2)
    print(f"✓ {len(companies)} Sequoia companies → {out}")
