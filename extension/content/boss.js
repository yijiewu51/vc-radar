console.log('[VC Radar] Boss直聘 script loaded');

// Skip anonymous/hidden company names
const SKIP_PATTERN = /^(某|匿名|.*大型.*公司|.*知名.*公司|猎头)/;

// Job card container selectors — try class name fragments for resilience
const CARD_SELS = [
  'li.job-card-wrapper',
  '[class*="job-card-wrapper"]',
  '[class*="job-card-body"]',
  '[class*="jobCard"]',
  'li[class*="job"]',
];

function getCards() {
  for (const sel of CARD_SELS) {
    const cards = document.querySelectorAll(sel);
    if (cards.length > 0) return [...cards];
  }
  return [];
}

function markLookable(el, text) {
  el.dataset.vcRadarLookable = text;
}

const JUNK_RE = /[KkK薪万·区市省街道号]|^(本科|硕士|博士|大专|MBA|不限|经验|学历|全职|兼职|实习|A轮|B轮|C轮|D轮|上市|天使|互联网|金融|教育|游戏|电商|工程师|算法|分析师|开发|产品|运营|设计|测试|销售|研究|架构|数据|\d)/i;

function isJunk(text) {
  return !text || text.length < 2 || text.length > 40 || JUNK_RE.test(text) || SKIP_PATTERN.test(text);
}

function findCompanyEl(card) {
  // 1. Try class-based selectors (most reliable)
  const byClass = card.querySelector('[class*="company-name"],[class*="companyName"],[class*="company_name"]');
  if (byClass?.childElementCount === 0 && byClass.textContent?.trim()) return byClass;

  const leaves = [...card.querySelectorAll('*')].filter(el =>
    el.childElementCount === 0 &&
    !el.classList.contains('vc-radar-wrapper') &&
    !el.classList.contains('vc-radar-badge')
  );

  // 2. Find location element (contains · or 区/市/省), look backwards — company name is right before location
  const locationIdx = leaves.findIndex(el => /[·区市省]/.test(el.textContent));
  if (locationIdx > 0) {
    for (let i = locationIdx - 1; i >= 0; i--) {
      if (!isJunk(leaves[i].textContent?.trim())) return leaves[i];
    }
  }

  // 3. Last resort: first non-junk leaf
  return leaves.find(el => !isJunk(el.textContent?.trim())) || null;
}

function scanCard(card) {
  const el = findCompanyEl(card);
  if (!el) return;

  const text = el.textContent?.trim();
  const company = window.vcRadar.lookupCompany(text);
  if (company) {
    window.vcRadar.injectBadge(el, company);
    delete el.dataset.vcRadarLookable;
  } else if (el.dataset.vcRadar) {
    window.vcRadar.cleanupBadge(el);
  } else {
    markLookable(el, text);
  }
}

function scan() {
  const cards = getCards();
  let matched = 0;
  for (const card of cards) {
    scanCard(card);
  }
  window.vcRadar.cleanupStaleWrappers();
  if (matched) console.log(`[VC Radar] Injected ${matched} badge(s)`);
}

async function init() {
  await window.vcRadar.loadCompanies();
  window.vcRadar.initLookupHover();
  scan();
  window.vcRadar.makeSafeObserver(scan).observe(document.body, {
    childList: true,
    subtree: true,
  });
}

init();
