# VC Radar — Chrome 浏览器插件

> 在 LinkedIn 和 Boss直聘 浏览职位时，自动显示公司融资阶段角标。支持 AI 研究陌生公司、一键记录求职进度到 Notion。

![badge example](https://img.shields.io/badge/VC--backed-Sequoia%20·%20Series%20B-6366f1?style=flat-square)

---

## 功能介绍

- **融资角标** — 自动在公司名旁显示融资阶段和主要投资方（如 `Series B · Sequoia`）
- **悬停详情** — 鼠标悬停角标，查看公司完整信息：简介、融资阶段、投资方、地区、标签
- **AI 研究（🔍）** — 鼠标悬停陌生公司名，点击 🔍 获取 Claude AI 简介，并附三项 1-5 星评分：
  - 公司发展前景
  - 薪资竞争力
  - Work-Life Balance
- **加入我的列表** — AI 研究后可将公司保存到本地数据库，下次浏览自动显示角标
- **记录到 Notion（📌）** — 点击角标上的 📌，一键将申请记录（公司、职位、状态、链接、日期）存入 Notion
- **2800+ 家公司** — 涵盖 YC、a16z、Sequoia、Tiger Global、独角兽榜单、亚洲 VC/PE/对冲基金等

---

## 安装方法

> 目前需手动加载，尚未上架 Chrome 商店。

1. 下载或克隆本仓库
2. 打开 Chrome，地址栏输入 `chrome://extensions`
3. 右上角开启**开发者模式**
4. 点击**加载已解压的扩展程序** → 选择 `extension/` 文件夹

---

## 配置说明

点击浏览器右上角的 VC Radar 图标，打开弹窗填写以下信息：

### Notion 配置（用于记录求职进度）

1. 前往 [notion.so/my-integrations](https://www.notion.so/my-integrations) → **新建集成** → 复制 **Internal Integration Token**
2. 在 Notion 中新建一个数据库，添加以下字段：

   | 字段名 | 类型   |
   |--------|--------|
   | 公司   | 标题   |
   | 职位   | 文本   |
   | 来源   | 选择   |
   | 状态   | 选择   |
   | 链接   | URL    |
   | 日期   | 日期   |

3. 点击数据库右上角 **...** → **连接到** → 选择你的集成
4. 从数据库 URL 中复制 Database ID（格式：`notion.so/你的DATABASE_ID?v=...`）
5. 将 Token 和 Database ID 填入弹窗并保存

### Anthropic API Key（用于 AI 研究公司）

1. 前往 [console.anthropic.com](https://console.anthropic.com) 获取 API Key
2. 填入弹窗并保存

---

## 使用方式

### LinkedIn
- 打开 `linkedin.com/jobs`，职位列表中公司名旁会自动出现角标
- 悬停角标查看详情
- 悬停没有角标的公司名 → 点击 🔍 → 获取 AI 简介和评分 → 可选择保存到本地
- 点击角标上的 📌 → 填写职位信息 → 记录到 Notion

### Boss直聘
- 在职位列表中，已收录公司名旁自动显示角标
- 🔍 和 📌 功能同上

---

## 公司数据库来源

- Y Combinator（全批次）
- a16z 投资组合
- Sequoia 投资组合
- Tiger Global、Coatue、D1 Capital
- 独角兽榜单（CB Insights）
- 亚洲机构：高瓴、博裕、华平、Matrix Partners China、Dymon Asia、Segantii 等
- 中国互联网大厂：字节跳动、腾讯、阿里巴巴、百度、小米、华为等

通过 🔍 研究并保存的公司存储在 Chrome 本地，重启浏览器后依然有效。

---

## 项目结构

```
extension/
├── manifest.json
├── background.js          # Service Worker：调用 Notion API、Claude API
├── content/
│   ├── common.js          # 核心逻辑：角标注入、AI 面板、悬浮按钮
│   ├── linkedin.js        # LinkedIn 内容脚本
│   └── boss.js            # Boss直聘 内容脚本
├── popup/
│   ├── popup.html
│   └── popup.js
├── ui/
│   └── badge.css
└── data/
    ├── companies.json     # 合并后的公司数据库（~2800 条）
    └── ...                # 按基金/类别分类的原始 JSON

scripts/
└── *.py                   # 数据采集脚本
```

---

## License

MIT
