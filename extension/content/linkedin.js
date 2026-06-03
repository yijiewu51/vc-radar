console.log('[VC Radar] LinkedIn script loaded');

const SKIP_PATTERN = /^(某|匿名|.*大型.*公司)/;

// Detail panel only: show badge + 🔍 (user has clicked a specific job)
const DETAIL_SELECTORS = [
  '.jobs-unified-top-card__company-name a',
  '.jobs-unified-top-card__company-name span',
  '.job-details-jobs-unified-top-card__company-name a',
  '.job-details-jobs-unified-top-card__company-name span',
  '.topcard__org-name-link',
  '.org-top-card-summary__title',
];

// Job list cards: badge only (too many cards → too many 🔍 buttons)
const COMPANY_SELECTORS = [
  'span.job-card-container__company-name',
  'div.job-card-container__company-name',
  ...DETAIL_SELECTORS,
];

// Low-confidence: broader selectors that might match company names but also other text → badge only
const BROAD_SELECTORS = [
  '.artdeco-entity-lockup__subtitle span',
  '.job-card-list__entity-lockup .artdeco-entity-lockup__subtitle',
  '.entity-result__primary-subtitle span',
  '.entity-result__secondary-subtitle span',
  '.update-components-actor__description span',
];

const SELECTORS = [...COMPANY_SELECTORS, ...BROAD_SELECTORS];

function scan() {
  let matched = 0;

  // Detail panel: badge for known, mark unknown as lookable (hover shows 🔍)
  for (const sel of DETAIL_SELECTORS) {
    for (const el of document.querySelectorAll(sel)) {
      const text = el.textContent?.trim();
      if (!text || text.length > 120) continue;
      const company = window.vcRadar.lookupCompany(text);
      if (company) {
        window.vcRadar.injectBadge(el, company);
        delete el.dataset.vcRadarLookable;
        matched++;
      } else if (el.dataset.vcRadar) {
        window.vcRadar.cleanupBadge(el);
      } else if (!SKIP_PATTERN.test(text)) {
        el.dataset.vcRadarLookable = text;
      }
    }
  }

  // List cards + broad: badge only
  const listAndBroad = [
    'span.job-card-container__company-name',
    'div.job-card-container__company-name',
    ...BROAD_SELECTORS,
  ];
  for (const sel of listAndBroad) {
    for (const el of document.querySelectorAll(sel)) {
      const text = el.textContent?.trim();
      if (!text || text.length > 120) continue;
      const company = window.vcRadar.lookupCompany(text);
      if (company) {
        window.vcRadar.injectBadge(el, company);
        matched++;
      } else if (el.dataset.vcRadar) {
        window.vcRadar.cleanupBadge(el);
      }
    }
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
