"""
Merge all scraped company JSONs + the hand-curated companies.json into one file.
Deduplicates by name (case-insensitive). Hand-curated entries take priority.

Usage:
    python scripts/merge_companies.py
"""

import json
import glob
import os

SOURCES = [
    "extension/data/finance_companies.json",       # finance/IB/HF/PE (highest priority)
    "extension/data/big_companies.json",           # FAANG, big banks, Big Four, major quant firms
    "extension/data/curated_asia.json",            # hand-curated Asia/global tech companies
    "extension/data/companies.json",               # existing curated list
    "extension/data/yc_companies.json",
    "extension/data/a16z_companies.json",
    "extension/data/unicorn_companies.json",       # Wikipedia global unicorns
    "extension/data/sequoia_companies.json",       # Sequoia portfolio
    "extension/data/vc_portfolio_companies.json",  # Accel, Bessemer, GC, Lightspeed, HongShan...
]

OUT = "extension/data/companies.json"

def load(path: str) -> list[dict]:
    if not os.path.exists(path):
        print(f"  Skipping (not found): {path}")
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def main():
    seen: dict[str, dict] = {}  # lowercase name -> company

    for source in SOURCES:
        companies = load(source)
        print(f"  {source}: {len(companies)} entries")
        for c in companies:
            name = c.get("name", "").strip().lower()
            if not name:
                continue
            if name not in seen:
                seen[name] = c
            # else: already have it (hand-curated wins because it comes first)

    merged = sorted(seen.values(), key=lambda c: c["name"].lower())
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    print(f"\nMerged {len(merged)} companies -> {OUT}")

if __name__ == "__main__":
    main()
