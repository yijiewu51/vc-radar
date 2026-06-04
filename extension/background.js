// Background service worker — handles Notion API and AI research calls

const DEFAULT_CONFIG = {
  notionToken: '',
  notionDatabaseId: '',
  anthropicKey: '',
  deepseekKey: '',
  aiProvider: 'anthropic',   // 'anthropic' | 'deepseek'
};

async function getConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get(DEFAULT_CONFIG, resolve);
  });
}

async function recordJob({ company, title, url, source, status }) {
  const { notionToken, notionDatabaseId } = await getConfig();

  const today = new Date().toISOString().split('T')[0];

  const body = {
    parent: { database_id: notionDatabaseId },
    properties: {
      '公司': {
        title: [{ text: { content: company || '未知公司' } }],
      },
      '职位': {
        rich_text: [{ text: { content: title || '' } }],
      },
      '来源': {
        select: { name: source || 'LinkedIn' },
      },
      '状态': {
        select: { name: status || '已投递' },
      },
      '链接': {
        url: url || null,
      },
      '日期': {
        date: { start: today },
      },
    },
  };

  const resp = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.message || `Notion API error ${resp.status}`);
  }
  return await resp.json();
}

const RESEARCH_PROMPT = (name) =>
  `请用JSON格式简介这家公司："${name}"。只返回JSON，不要其他内容：\n{"description":"3-4句中文简介，包括做什么、规模阶段、所在地区","ratings":{"growth":4,"salary":3,"wlb":3}}\nratings各项为1-5整数：growth=公司发展前景，salary=薪资竞争力，wlb=work-life balance。不了解则description写"未找到相关信息"，ratings各项给3。`;

function parseAIResponse(text) {
  const match = text.trim().match(/\{[\s\S]*\}/);
  if (!match) return { description: text, ratings: { growth: 3, salary: 3, wlb: 3 } };
  try {
    return JSON.parse(match[0]);
  } catch {
    return { description: text, ratings: { growth: 3, salary: 3, wlb: 3 } };
  }
}

async function researchWithAnthropic(companyName, apiKey) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: RESEARCH_PROMPT(companyName) }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error?.message || `Anthropic API error ${resp.status}`);
  }
  const data = await resp.json();
  return parseAIResponse(data.content[0].text);
}

async function researchWithDeepSeek(companyName, apiKey) {
  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 400,
      messages: [{ role: 'user', content: RESEARCH_PROMPT(companyName) }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error?.message || `DeepSeek API error ${resp.status}`);
  }
  const data = await resp.json();
  return parseAIResponse(data.choices[0].message.content);
}

async function researchCompany(companyName) {
  const config = await getConfig();
  const provider = config.aiProvider || 'anthropic';

  if (provider === 'deepseek') {
    if (!config.deepseekKey) throw new Error('未配置 DeepSeek API Key，请在插件设置里填写');
    return researchWithDeepSeek(companyName, config.deepseekKey);
  } else {
    if (!config.anthropicKey) throw new Error('未配置 Anthropic API Key，请在插件设置里填写');
    return researchWithAnthropic(companyName, config.anthropicKey);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'RECORD_JOB') {
    recordJob(msg.payload)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'RESEARCH_COMPANY') {
    researchCompany(msg.payload.name)
      .then(data => sendResponse({ ok: true, ...data }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'GET_CONFIG') {
    getConfig().then(sendResponse);
    return true;
  }

  if (msg.type === 'SET_CONFIG') {
    chrome.storage.local.set(msg.payload, () => sendResponse({ ok: true }));
    return true;
  }
});
