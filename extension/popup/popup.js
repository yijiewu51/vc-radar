const tokenEl = document.getElementById('token');
const dbIdEl = document.getElementById('dbId');
const anthropicKeyEl = document.getElementById('anthropicKey');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');

// Load current config
chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (config) => {
  if (config.notionToken) tokenEl.value = config.notionToken;
  if (config.notionDatabaseId) dbIdEl.value = config.notionDatabaseId;
  if (config.anthropicKey) anthropicKeyEl.value = config.anthropicKey;
});

saveBtn.addEventListener('click', () => {
  const token = tokenEl.value.trim();
  const dbId = dbIdEl.value.trim();
  if (!token || !dbId) {
    statusEl.style.color = '#f38ba8';
    statusEl.textContent = '请填写 Notion Token 和 Database ID';
    return;
  }
  const payload = { notionToken: token, notionDatabaseId: dbId };
  const key = anthropicKeyEl.value.trim();
  if (key) payload.anthropicKey = key;

  chrome.runtime.sendMessage(
    { type: 'SET_CONFIG', payload },
    () => {
      statusEl.style.color = '#a6e3a1';
      statusEl.textContent = '✓ 已保存';
      setTimeout(() => (statusEl.textContent = ''), 2000);
    }
  );
});
