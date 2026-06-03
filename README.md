# VC Radar — Chrome Extension

> Browse LinkedIn and Boss直聘, see VC-backed company badges instantly. Research unknown companies with AI, record job applications to Notion.

![badge example](https://img.shields.io/badge/VC--backed-Sequoia%20·%20Series%20B-6366f1?style=flat-square)

---

## Features

- **Funding badges** — automatically annotates company names on LinkedIn and Boss直聘 with funding stage + top investor (e.g. `Series B · Sequoia`)
- **Hover tooltip** — hover the badge to see full company info: description, stage, investors, region, tags
- **AI research (🔍)** — hover any unknown company name to get a Claude-powered summary with 5-star ratings for:
  - 公司发展 (growth prospects)
  - 薪资水平 (salary competitiveness)
  - Work-Life Balance
- **Save to your list** — after AI research, add the company to your personal database so the badge appears on future visits
- **Record to Notion (📌)** — one-click to log a job application (company, title, status, URL, date) into your Notion database
- **2,800+ companies** — covers YC, a16z, Sequoia, Tiger Global, unicorns, Asia VC/PE/HF, and more

---

## Installation

> The extension is not on the Chrome Web Store. Load it manually:

1. Clone or download this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `extension/` folder

---

## Setup

Open the extension popup (click the VC Radar icon) and fill in:

### Notion Integration (for job tracking)

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration** → copy the **Internal Integration Token**
2. Create a Notion database with these properties:

   | Property | Type   |
   |----------|--------|
   | 公司      | Title  |
   | 职位      | Text   |
   | 来源      | Select |
   | 状态      | Select |
   | 链接      | URL    |
   | 日期      | Date   |

3. Share the database with your integration (click **...** → **Connect to** → select your integration)
4. Copy the database ID from the URL: `notion.so/YOUR_DATABASE_ID?v=...`
5. Paste the token and database ID into the popup

### Anthropic API Key (for AI research)

1. Get a key at [console.anthropic.com](https://console.anthropic.com)
2. Paste it into the popup

---

## Usage

### LinkedIn
- Go to `linkedin.com/jobs` — badges appear automatically on company names in the job list and detail panel
- Hover a badge to see full company info
- Hover an unknown company name → click **🔍** → get AI summary + ratings → optionally save to your list
- Click **📌** on any badge → log the application to Notion

### Boss直聘
- Same as LinkedIn — badges appear on company names in job cards
- 🔍 and 📌 work the same way

---

## Company Database

The extension ships with ~2,800 companies from:
- Y Combinator (all batches)
- a16z portfolio
- Sequoia portfolio
- Tiger Global, Coatue, D1 Capital
- Unicorn list (CB Insights)
- Asia VC/PE/HF: Hillhouse, Boyu, Matrix Partners China, Dymon Asia, Segantii, etc.
- Chinese tech giants: ByteDance/字节跳动, Tencent/腾讯, Alibaba/阿里巴巴, etc.

Companies you research and save via 🔍 are stored locally in Chrome and persist across sessions.

---

## Project Structure

```
extension/
├── manifest.json
├── background.js          # Service worker: Notion API, Claude API
├── content/
│   ├── common.js          # Badge injection, AI panel, hover logic
│   ├── linkedin.js        # LinkedIn content script
│   └── boss.js            # Boss直聘 content script
├── popup/
│   ├── popup.html
│   └── popup.js
├── ui/
│   └── badge.css
└── data/
    ├── companies.json     # Merged company database (~2,800 entries)
    └── ...                # Source JSON files by fund/category

scripts/
└── scrape_a16z.py         # Data collection scripts
```

---

## License

MIT
