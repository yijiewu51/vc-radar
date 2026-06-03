// Shared logic: load company data, match names, inject badges

let companyNames = [];
let companyMap = new Map();
let loaded = false;

function registerCompany(c) {
  const names = [c.name, ...(c.aliases || [])];
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!companyMap.has(key)) {
      companyMap.set(key, c);
      companyNames.push(key);
    }
  }
}

async function loadCompanies() {
  if (loaded) return;
  try {
    const url = chrome.runtime.getURL('data/companies.json');
    const res = await fetch(url);
    const companies = await res.json();
    for (const c of companies) registerCompany(c);

    // Also load user-added companies from chrome.storage
    const { userCompanies = [] } = await new Promise(resolve =>
      chrome.storage.local.get({ userCompanies: [] }, resolve)
    );
    for (const c of userCompanies) registerCompany(c);

    companyNames.sort((a, b) => b.length - a.length);
    loaded = true;
    console.log(`[VC Radar] Loaded ${companyMap.size} companies`);
  } catch (e) {
    console.error('[VC Radar] Failed to load companies.json:', e);
  }
}

function saveUserCompany(company) {
  // Immediately usable in current session
  registerCompany(company);
  companyNames.sort((a, b) => b.length - a.length);
  // Persist across sessions
  chrome.storage.local.get({ userCompanies: [] }, ({ userCompanies }) => {
    const key = company.name.trim().toLowerCase();
    if (!userCompanies.find(c => c.name.trim().toLowerCase() === key)) {
      userCompanies.push(company);
      chrome.storage.local.set({ userCompanies });
    }
  });
}

function lookupCompany(text) {
  if (!text) return null;
  const lower = text.trim().toLowerCase();
  // 1. Exact match (always safe)
  if (companyMap.has(lower)) return companyMap.get(lower);
  // 2. Substring match: only for long names (≥10 chars) with strict space-only boundaries
  for (const name of companyNames) {
    if (name.length < 10) continue;
    const idx = lower.indexOf(name);
    if (idx === -1) continue;
    const before = idx === 0 ? ' ' : lower[idx - 1];
    const after = idx + name.length >= lower.length ? ' ' : lower[idx + name.length];
    if (/[\s,.()|]/.test(before) && /[\s,.()|]/.test(after)) {
      return companyMap.get(name);
    }
  }
  return null;
}

function createTooltip(company) {
  const tip = document.createElement('div');
  tip.className = 'vc-radar-tooltip';
  const investors = company.investors?.slice(0, 3).join(', ') || '-';
  const tags = company.tags?.join(' · ') || '';
  const regions = company.regions?.join(', ') || '';
  tip.innerHTML = `
    <div class="vc-radar-tip-name">${company.name}</div>
    <div class="vc-radar-tip-desc">${company.description || ''}</div>
    <div class="vc-radar-tip-row"><b>阶段</b> ${company.stage || '-'}</div>
    <div class="vc-radar-tip-row"><b>投资方</b> ${investors}</div>
    <div class="vc-radar-tip-row"><b>地区</b> ${regions}</div>
    ${tags ? `<div class="vc-radar-tip-tags">${tags}</div>` : ''}
  `;
  return tip;
}

// WeakMap: el → its injected wrapper, for precise removal without relying on sibling position
const elWrapperMap = new WeakMap();

// Card container selectors — one badge per card
const CARD_ROOT_SEL =
  'li.jobs-search-results__list-item, li.scaffold-layout__list-item, ' +
  '.job-card-container, [data-job-id], .entity-result, ' +
  '.occludable-update, .job-card-wrapper, .job-card-list';

function injectBadge(el, company) {
  // Skip if already showing this exact company
  if (el.dataset.vcRadar === company.name) return;

  const card = el.closest(CARD_ROOT_SEL);

  // Card already processed for this company — skip
  if (card && card.dataset.vcRadarDone === company.name) return;

  // Remove ALL stale badges in the card before injecting a fresh one
  if (card) {
    card.querySelectorAll('.vc-radar-wrapper').forEach(w => w.remove());
    card.querySelectorAll('[data-vc-radar]').forEach(e => { delete e.dataset.vcRadar; });
    card.dataset.vcRadarDone = company.name;
  } else {
    // No recognized card: clean up ALL stale badges in el's immediate parent
    // (handles both same-element reuse and LinkedIn's replaceChild pattern)
    elWrapperMap.get(el)?.remove();
    el.parentNode?.querySelectorAll('.vc-radar-wrapper').forEach(w => w.remove());
    el.parentNode?.querySelectorAll('[data-vc-radar]').forEach(e => { delete e.dataset.vcRadar; });
  }

  el.dataset.vcRadar = company.name;

  const wrapper = document.createElement('span');
  wrapper.className = 'vc-radar-wrapper';

  const badge = document.createElement('span');
  badge.className = 'vc-radar-badge';

  // Build badge label
  let stage = (company.stage || '').trim();
  // YC companies without batch → just show category
  if (stage === 'YC') {
    stage = company.categories?.[0] || 'YC Alumni';
  }
  // Skip "Y Combinator" as investor label (redundant when stage already says YC)
  const investors = (company.investors || []).filter(i => i !== 'Y Combinator');
  const topInvestor = investors[0] || '';
  const label = topInvestor ? `${stage} · ${topInvestor}` : stage || 'Startup';
  badge.textContent = label;

  // Record button 📌
  const recBtn = document.createElement('span');
  recBtn.className = 'vc-radar-record';
  recBtn.title = '记录到 Notion';
  recBtn.textContent = '📌';
  recBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    openRecordPanel(recBtn, company);
  });

  wrapper.appendChild(badge);
  wrapper.appendChild(recBtn);
  wrapper.appendChild(createTooltip(company));
  el.insertAdjacentElement('afterend', wrapper);
  elWrapperMap.set(el, wrapper);
}

function openRecordPanel(btn, company) {
  // Remove any existing panel
  document.querySelector('.vc-radar-panel')?.remove();

  const source = location.hostname.includes('zhipin') ? 'Boss直聘' : 'LinkedIn';

  // 提取岗位标题：列表卡片 vs 右侧详情面板分开处理
  const card = btn.closest(CARD_ROOT_SEL);
  let guessedTitle = '';
  if (card) {
    // 列表卡片：在卡片内找岗位标题链接
    const titleEl = card.querySelector(
      '.job-card-list__title--link, .job-card-list__title, a[href*="/jobs/view/"], .job-name'
    );
    if (titleEl) {
      const ariaLabel = titleEl.getAttribute('aria-label');
      guessedTitle = ariaLabel
        ? ariaLabel.split(' at ')[0].trim()
        : (titleEl.innerText || '').trim().split('\n')[0].trim();
    }
  } else {
    // 右侧详情面板：直接用页面唯一的标题元素
    const titleEl = document.querySelector(
      '.job-details-jobs-unified-top-card__job-title h1, ' +
      '.jobs-unified-top-card__job-title h1, ' +
      '.topcard__title, .job-title, h1.name'
    );
    guessedTitle = (titleEl?.innerText || '').trim().split('\n')[0].trim();
  }

  const panel = document.createElement('div');
  panel.className = 'vc-radar-panel';
  panel.innerHTML = `
    <div class="vc-radar-panel-title">📌 记录到 Notion</div>
    <div class="vc-radar-panel-company">${company.name}</div>
    <input class="vc-radar-panel-input" placeholder="职位名称" value="${guessedTitle}" />
    <select class="vc-radar-panel-status">
      <option value="已投递">已投递</option>
      <option value="待投递">待投递</option>
      <option value="一面">一面</option>
      <option value="二面">二面</option>
      <option value="三面">三面</option>
      <option value="Offer">Offer</option>
      <option value="已拒绝">已拒绝</option>
    </select>
    <div class="vc-radar-panel-actions">
      <button class="vc-radar-panel-cancel">取消</button>
      <button class="vc-radar-panel-confirm">确认记录</button>
    </div>
    <div class="vc-radar-panel-msg"></div>
  `;

  document.body.appendChild(panel);

  // Position near button
  const rect = btn.getBoundingClientRect();
  panel.style.top = `${rect.bottom + window.scrollY + 6}px`;
  panel.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 260)}px`;

  const input = panel.querySelector('.vc-radar-panel-input');
  const statusSel = panel.querySelector('.vc-radar-panel-status');
  const msg = panel.querySelector('.vc-radar-panel-msg');
  input.focus();

  panel.querySelector('.vc-radar-panel-cancel').onclick = () => panel.remove();

  panel.querySelector('.vc-radar-panel-confirm').onclick = async () => {
    const title = input.value.trim();
    msg.style.color = '#89b4fa';
    msg.textContent = '保存中...';

    try {
      chrome.runtime.sendMessage({
        type: 'RECORD_JOB',
        payload: {
          company: company.name,
          title,
          url: location.href,
          source,
          status: statusSel.value,
        },
      }, (res) => {
        if (chrome.runtime.lastError) {
          msg.style.color = '#f38ba8';
          msg.textContent = '✗ 请刷新页面后重试';
          return;
        }
        if (res?.ok) {
          msg.style.color = '#a6e3a1';
          msg.textContent = '✓ 已保存到 Notion';
          btn.textContent = '✅';
          setTimeout(() => panel.remove(), 1500);
        } else {
          msg.style.color = '#f38ba8';
          msg.textContent = '✗ ' + (res?.error || '保存失败');
        }
      });
    } catch (e) {
      msg.style.color = '#f38ba8';
      msg.textContent = '✗ 请刷新页面后重试';
    }
  };

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!panel.contains(e.target)) {
        panel.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 100);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// MutationObserver helper: ignore mutations caused by our own badge insertions
function makeSafeObserver(scanFn, delay = 600) {
  let injecting = false;
  const debounced = debounce(() => {
    if (injecting) return;
    injecting = true;
    scanFn();
    injecting = false;
  }, delay);
  return new MutationObserver((mutations) => {
    // Skip if all mutations are our own badge wrappers
    const allOurs = mutations.every(m =>
      [...m.addedNodes].every(n =>
        n.classList?.contains('vc-radar-wrapper') ||
        n.classList?.contains('vc-radar-badge') ||
        n.classList?.contains('vc-radar-lookup') ||
        n.classList?.contains('vc-radar-panel')
      )
    );
    if (!allOurs) debounced();
  });
}

// Remove any badge wrapper that is no longer adjacent to a marked element
function cleanupStaleWrappers() {
  document.querySelectorAll('.vc-radar-wrapper').forEach(w => {
    if (!w.previousElementSibling?.dataset.vcRadar) w.remove();
  });
}

// Global hover-based lookup button — avoids DOM insertion accumulation
let _lookupFloatBtn = null;
let _lookupHideTimer = null;

function initLookupHover() {
  if (_lookupFloatBtn) return;
  _lookupFloatBtn = document.createElement('span');
  _lookupFloatBtn.className = 'vc-radar-lookup';
  _lookupFloatBtn.textContent = '🔍';
  _lookupFloatBtn.style.position = 'fixed';
  _lookupFloatBtn.style.display = 'none';
  _lookupFloatBtn.style.zIndex = '99998';
  document.body.appendChild(_lookupFloatBtn);

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-vc-radar-lookable]');
    if (target) {
      clearTimeout(_lookupHideTimer);
      const name = target.dataset.vcRadarLookable;
      const rect = target.getBoundingClientRect();
      _lookupFloatBtn.style.top = `${rect.top + rect.height / 2 - 10}px`;
      _lookupFloatBtn.style.left = `${rect.right + 4}px`;
      _lookupFloatBtn.style.display = 'inline-block';
      _lookupFloatBtn.title = `AI 简介 "${name}"`;
      _lookupFloatBtn.onclick = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        openResearchPanel(_lookupFloatBtn, name);
      };
    } else if (e.target.closest('.vc-radar-lookup') || e.target.closest('.vc-radar-panel')) {
      clearTimeout(_lookupHideTimer); // keep visible while on button or panel
    } else {
      clearTimeout(_lookupHideTimer);
      _lookupHideTimer = setTimeout(() => {
        _lookupFloatBtn.style.display = 'none';
      }, 150);
    }
  });
}

// Open AI research panel for unknown companies
function openResearchPanel(btn, companyName) {
  document.querySelector('.vc-radar-panel')?.remove();

  const panel = document.createElement('div');
  panel.className = 'vc-radar-panel';
  panel.style.width = '260px';
  panel.innerHTML = `
    <div class="vc-radar-panel-title">🔍 AI 公司简介</div>
    <div class="vc-radar-panel-company">${companyName}</div>
    <div class="vc-radar-panel-msg" style="color:#89b4fa;min-height:60px;line-height:1.5;font-size:12px;">正在查询，请稍候...</div>
    <div class="vc-radar-add-row" style="display:none;margin-top:8px;">
      <select class="vc-radar-panel-status" style="margin-bottom:6px;">
        <option value="Startup">Startup</option>
        <option value="VC-backed">VC-backed</option>
        <option value="Series A+">Series A+</option>
        <option value="Unicorn">Unicorn</option>
        <option value="PE">PE</option>
        <option value="Hedge Fund">Hedge Fund</option>
        <option value="Public">Public</option>
        <option value="Consulting">Consulting</option>
        <option value="Bank">Bank</option>
        <option value="Other">Other</option>
      </select>
      <button class="vc-radar-add-btn" style="width:100%;padding:6px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">📥 加入我的列表</button>
      <div class="vc-radar-add-msg" style="font-size:11px;text-align:center;margin-top:4px;min-height:14px;"></div>
    </div>
    <div class="vc-radar-panel-actions" style="margin-top:8px;">
      <button class="vc-radar-panel-cancel">关闭</button>
    </div>
  `;
  document.body.appendChild(panel);

  const rect = btn.getBoundingClientRect();
  panel.style.top = `${rect.bottom + window.scrollY + 6}px`;
  panel.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 260)}px`;

  panel.querySelector('.vc-radar-panel-cancel').onclick = () => panel.remove();

  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!panel.contains(e.target)) {
        panel.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 100);

  const doResearch = (retry = false) => {
    chrome.runtime.sendMessage({ type: 'RESEARCH_COMPANY', payload: { name: companyName } }, (res) => {
      const msgEl = panel.querySelector('.vc-radar-panel-msg');
      if (!msgEl) return;
      if (chrome.runtime.lastError || !res) {
        if (!retry) {
          // Service worker was sleeping — it's now awake, try once more
          setTimeout(() => doResearch(true), 600);
          return;
        }
        msgEl.style.color = '#f38ba8';
        msgEl.textContent = '✗ ' + (chrome.runtime.lastError?.message || '连接失败，请刷新页面后重试');
        return;
      }
      if (res.ok) {
        const r = res.ratings || {};
        const desc = res.description || '';
        const unknown = !desc || desc.includes('未找到相关信息');
        const stars = (n) => '★'.repeat(Math.max(1, Math.min(5, n || 3))) + '☆'.repeat(5 - Math.max(1, Math.min(5, n || 3)));
        msgEl.style.color = '#cdd6f4';
        msgEl.innerHTML = `
          <div style="margin-bottom:8px;line-height:1.6">${desc}</div>
          ${unknown ? '' : `
          <div style="font-size:11.5px;line-height:2;border-top:1px solid #313244;padding-top:6px">
            <div><span style="color:#89b4fa;margin-right:6px">公司发展</span><span style="color:#f9e2af">${stars(r.growth)}</span></div>
            <div><span style="color:#89b4fa;margin-right:6px">薪资水平</span><span style="color:#f9e2af">${stars(r.salary)}</span></div>
            <div><span style="color:#89b4fa;margin-right:6px">Work-Life </span><span style="color:#f9e2af">${stars(r.wlb)}</span></div>
          </div>`}`;
        // Show "add to my list" section
        const addRow = panel.querySelector('.vc-radar-add-row');
        if (addRow) {
          addRow.style.display = 'block';
          panel.querySelector('.vc-radar-add-btn').onclick = () => {
            const stage = panel.querySelector('.vc-radar-panel-status').value;
            const addMsg = panel.querySelector('.vc-radar-add-msg');
            saveUserCompany({
              name: companyName,
              stage,
              description: res.description || '',
              regions: [],
              tags: [],
              investors: [],
              source: 'user',
            });
            addMsg.style.color = '#a6e3a1';
            addMsg.textContent = '✓ 已加入，下次浏览即显示 badge';
            panel.querySelector('.vc-radar-add-btn').disabled = true;
          };
        }
      } else {
        msgEl.style.color = '#f38ba8';
        msgEl.textContent = '✗ ' + res.error;
      }
    });
  };
  try { doResearch(); } catch (e) {
    const msgEl = panel.querySelector('.vc-radar-panel-msg');
    if (msgEl) { msgEl.style.color = '#f38ba8'; msgEl.textContent = '✗ 请刷新页面后重试'; }
  }
}

// Clean up stale badge when an element's company changed to something not in DB
function cleanupBadge(el) {
  const card = el.closest(CARD_ROOT_SEL);
  if (card) {
    card.querySelectorAll('.vc-radar-wrapper').forEach(w => w.remove());
    card.querySelectorAll('[data-vc-radar]').forEach(e => { delete e.dataset.vcRadar; });
    delete card.dataset.vcRadarDone;
  } else {
    elWrapperMap.get(el)?.remove();
    el.parentNode?.querySelectorAll('.vc-radar-wrapper').forEach(w => w.remove());
    el.parentNode?.querySelectorAll('[data-vc-radar]').forEach(e => { delete e.dataset.vcRadar; });
  }
  delete el.dataset.vcRadar;
}

window.vcRadar = { loadCompanies, lookupCompany, injectBadge, cleanupBadge, cleanupStaleWrappers, openResearchPanel, initLookupHover, saveUserCompany, debounce, makeSafeObserver };
