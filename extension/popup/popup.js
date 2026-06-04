const tokenEl     = document.getElementById('token');
const dbIdEl      = document.getElementById('dbId');
const anthropicEl = document.getElementById('anthropicKey');
const deepseekEl  = document.getElementById('deepseekKey');
const saveBtn     = document.getElementById('save');
const statusEl    = document.getElementById('status');

let currentProvider = 'anthropic';

function selectProvider(p) {
  currentProvider = p;
  document.querySelectorAll('.p-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[onclick="selectProvider('${p}')"]`).classList.add('active');
  document.getElementById('anthropic-section').classList.toggle('visible', p === 'anthropic');
  document.getElementById('deepseek-section').classList.toggle('visible', p === 'deepseek');
}

window.selectProvider = selectProvider;

// Load saved config
chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (config) => {
  if (config.notionToken)      tokenEl.value     = config.notionToken;
  if (config.notionDatabaseId) dbIdEl.value      = config.notionDatabaseId;
  if (config.anthropicKey)     anthropicEl.value = config.anthropicKey;
  if (config.deepseekKey)      deepseekEl.value  = config.deepseekKey;
  if (config.aiProvider)       selectProvider(config.aiProvider);
});

saveBtn.addEventListener('click', () => {
  const token = tokenEl.value.trim();
  const dbId  = dbIdEl.value.trim();

  if (!token || !dbId) {
    statusEl.className = 'err';
    statusEl.textContent = '请填写 Notion Token 和 Database ID';
    return;
  }

  const payload = { notionToken: token, notionDatabaseId: dbId, aiProvider: currentProvider };
  const ak = anthropicEl.value.trim();
  const dk = deepseekEl.value.trim();
  if (ak) payload.anthropicKey = ak;
  if (dk) payload.deepseekKey  = dk;

  chrome.runtime.sendMessage({ type: 'SET_CONFIG', payload }, () => {
    statusEl.className = 'ok';
    statusEl.textContent = '✓ 已保存';
    setTimeout(() => (statusEl.textContent = ''), 2000);
  });
});
