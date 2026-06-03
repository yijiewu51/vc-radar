"""
Scrape YC companies via Algolia API.
Credentials are embedded in the public YC website HTML.

Usage:
    python scripts/scrape_yc.py
"""

import json
import re
import time
import requests

OUT = "extension/data/yc_companies.json"

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def get_algolia_creds() -> tuple[str, str]:
    """Fetch live Algolia credentials from YC's public page."""
    r = requests.get("https://www.ycombinator.com/companies", headers=HEADERS, timeout=15)
    r.raise_for_status()
    m = re.search(r'window\.AlgoliaOpts\s*=\s*(\{.*?\})', r.text)
    if not m:
        raise RuntimeError("Could not find AlgoliaOpts in YC page")
    opts = json.loads(m.group(1))
    return opts["app"], opts["key"]


def fetch_page(app_id: str, api_key: str, index: str, page: int, hits_per_page: int = 100) -> dict:
    url = f"https://{app_id.lower()}-dsn.algolia.net/1/indexes/{index}/query"
    headers = {
        "X-Algolia-Application-Id": app_id,
        "X-Algolia-API-Key": api_key,
        "Content-Type": "application/json",
    }
    payload = {"hitsPerPage": hits_per_page, "page": page}
    resp = requests.post(url, headers=headers, json=payload, timeout=15)
    resp.raise_for_status()
    return resp.json()


def normalize(hit: dict) -> dict:
    industries = hit.get("industries") or []
    regions = hit.get("regions") or []
    batch = hit.get("batch") or ""
    return {
        "name": hit.get("name", "").strip(),
        "aliases": [],
        "description": hit.get("one_liner") or hit.get("long_description") or "",
        "categories": industries,
        "stage": f"YC {batch}" if batch else "YC",
        "investors": ["Y Combinator"],
        "regions": regions,
        "tags": industries,
        "website": hit.get("website") or "",
        "source": "yc",
    }


def main():
    print("Fetching Algolia credentials from YC website...")
    app_id, api_key = get_algolia_creds()
    index = "YCCompany_production"
    print(f"  App ID: {app_id}")

    first = fetch_page(app_id, api_key, index, 0)
    nb_pages = first.get("nbPages", 1)
    nb_hits = first.get("nbHits", "?")
    print(f"  Total: {nb_hits} companies, {nb_pages} pages")

    all_hits = list(first.get("hits", []))

    for page in range(1, nb_pages):
        print(f"  Fetching page {page + 1}/{nb_pages}...", end="\r")
        data = fetch_page(app_id, api_key, index, page)
        all_hits.extend(data.get("hits", []))
        time.sleep(0.1)

    companies = [normalize(h) for h in all_hits if h.get("name")]

    seen = set()
    unique = []
    for c in companies:
        k = c["name"].lower()
        if k not in seen:
            seen.add(k)
            unique.append(c)

    print(f"\nSaving {len(unique)} companies to {OUT}")
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(unique, f, ensure_ascii=False, indent=2)
    print("Done.")


if __name__ == "__main__":
    main()
