"""
Wikipedia 全球独角兽公司列表 — 静态 HTML，无需 JS 渲染
覆盖：美国、中国、英国、印度、德国、韩国、新加坡、以色列等
"""
import json, re, urllib.request

URL = "https://en.wikipedia.org/wiki/List_of_unicorn_companies"

REGION_MAP = {
    "United States": "USA", "China": "China", "United Kingdom": "UK",
    "India": "India", "Germany": "Germany", "France": "France",
    "South Korea": "Korea", "Israel": "Israel", "Brazil": "Brazil",
    "Singapore": "Singapore", "Sweden": "Sweden", "Canada": "Canada",
    "Australia": "Australia", "Japan": "Japan", "Hong Kong": "HK",
    "Indonesia": "Southeast Asia", "Vietnam": "Southeast Asia",
    "Thailand": "Southeast Asia", "Philippines": "Southeast Asia",
}

TARGET_REGIONS = {"USA", "China", "UK", "HK", "Japan", "Singapore", "Southeast Asia", "Korea"}

def fetch():
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")

def clean(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'\[.*?\]', '', s)
    s = re.sub(r'&#160;', ' ', s)
    s = re.sub(r'&[a-z]+;', '', s)
    return ' '.join(s.split()).strip()

def parse(html):
    companies = []
    # Table 2 (index 2) is the main active unicorn list
    # Columns: Company | Valuation | Date | Industry | Country | Founder(s)
    tables = re.findall(r'<table[^>]*wikitable[^>]*>(.*?)</table>', html, re.DOTALL)
    if len(tables) < 3:
        print("Could not find unicorn table")
        return []
    table = tables[2]
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table, re.DOTALL)
    for row in rows[1:]:  # skip header
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL)
        if len(cells) < 4:
            continue
        name = clean(cells[0])
        valuation = clean(cells[1])
        industry = clean(cells[3]) if len(cells) > 3 else ''
        country_raw = clean(cells[4]) if len(cells) > 4 else ''

        if not name or len(name) > 80 or len(name) < 2:
            continue
        # Skip header-like rows
        if name.lower() in ('company', 'name'):
            continue

        region = None
        for k, v in REGION_MAP.items():
            if k.lower() in country_raw.lower():
                region = v
                break
        if not region or region not in TARGET_REGIONS:
            continue

        industries = [i.strip() for i in re.split(r',|/', industry) if i.strip()]

        companies.append({
            "name": name,
            "stage": "Unicorn",
            "regions": [region],
            "tags": industries[:3],
            "investors": [],
            "description": f"{industry} unicorn (${valuation}B)" if valuation else f"{industry} unicorn",
            "source": "wikipedia_unicorn",
        })
    return companies

if __name__ == "__main__":
    html = fetch()
    companies = parse(html)
    out = "extension/data/unicorn_companies.json"
    with open(out, "w") as f:
        json.dump(companies, f, ensure_ascii=False, indent=2)
    print(f"✓ {len(companies)} unicorn companies → {out}")
