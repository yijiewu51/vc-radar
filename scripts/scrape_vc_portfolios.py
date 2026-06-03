"""
多个 VC 投资组合爬虫（静态/半静态页面）
- Accel
- Bessemer Venture Partners
- Founders Fund
- General Catalyst
- Lightspeed
- Tiger Global (Crunchbase 开放数据)
"""
import json, re, urllib.request, asyncio, time
from playwright.async_api import async_playwright

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

async def scrape_page(url, investor_name, name_sel, desc_sel=None, scroll=5):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.set_extra_http_headers(HEADERS)
        try:
            await page.goto(url, timeout=60000, wait_until="networkidle")
            await page.wait_for_timeout(2000)
            for _ in range(scroll):
                await page.evaluate("window.scrollBy(0, 2000)")
                await page.wait_for_timeout(600)

            results = await page.evaluate(f"""() => {{
                const out = [];
                const nameEls = document.querySelectorAll({json.dumps(name_sel)});
                nameEls.forEach(el => {{
                    const name = el.textContent.trim();
                    if (!name || name.length > 80 || name.length < 2) return;
                    out.push(name);
                }});
                return out;
            }}""")
        except Exception as e:
            print(f"  ⚠ {investor_name}: {e}")
            results = []
        await browser.close()
        return results

SOURCES = [
    {
        "investor": "Accel",
        "url": "https://www.accel.com/companies",
        "sel": "h3, h2, [class*='company-name'], [class*='CompanyName']",
        "scroll": 8,
    },
    {
        "investor": "Bessemer Venture Partners",
        "url": "https://www.bvp.com/portfolio",
        "sel": "h3, h2, [class*='company'], [class*='name']",
        "scroll": 6,
    },
    {
        "investor": "General Catalyst",
        "url": "https://www.generalcatalyst.com/portfolio",
        "sel": "h3, h2, [class*='company'], [class*='name']",
        "scroll": 6,
    },
    {
        "investor": "Lightspeed",
        "url": "https://lsvp.com/portfolio/",
        "sel": "h3, h2, [class*='company'], [class*='name']",
        "scroll": 6,
    },
    {
        "investor": "HongShan",
        "url": "https://www.hongshan.com/en/portfolio/",
        "sel": "h3, h2, [class*='company'], [class*='name'], [class*='title']",
        "scroll": 8,
    },
    {
        "investor": "GGV Capital",
        "url": "https://www.notablecapital.com/portfolio",
        "sel": "h3, h2, [class*='company'], [class*='name']",
        "scroll": 6,
    },
    {
        "investor": "500 Global",
        "url": "https://500.co/companies",
        "sel": "h3, h2, [class*='company'], [class*='name']",
        "scroll": 8,
    },
]

JUNK = {
    "portfolio", "companies", "our", "team", "about", "contact", "home",
    "investments", "founders", "news", "blog", "learn more", "view all",
    "read more", "", "see all",
}

async def run_all():
    all_companies = []
    for src in SOURCES:
        print(f"Scraping {src['investor']}...")
        names = await scrape_page(src["url"], src["investor"], src["sel"], scroll=src.get("scroll", 5))
        seen = set()
        count = 0
        for name in names:
            name = name.strip()
            if name.lower() in JUNK or name in seen or len(name) < 2:
                continue
            seen.add(name)
            all_companies.append({
                "name": name,
                "stage": "Series A+",
                "investors": [src["investor"]],
                "description": "",
                "tags": [],
                "regions": [],
                "source": src["investor"].lower().replace(" ", "_"),
            })
            count += 1
        print(f"  → {count} companies")
    return all_companies

if __name__ == "__main__":
    companies = asyncio.run(run_all())
    out = "extension/data/vc_portfolio_companies.json"
    with open(out, "w") as f:
        json.dump(companies, f, ensure_ascii=False, indent=2)
    print(f"\n✓ Total {len(companies)} companies → {out}")
