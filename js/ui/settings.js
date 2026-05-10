// =====================
// 設定画面・永続化ロジック
// =====================

const TOKEN_KEY  = 'gh_pat';
const GEMINI_KEY = 'gemini_api_key';

window.TOKEN_KEY  = TOKEN_KEY;
window.GEMINI_KEY = GEMINI_KEY;

// ---- 基本取得関数 ----
function getToken()     { return localStorage.getItem(TOKEN_KEY); }
function getGeminiKey() { return localStorage.getItem(GEMINI_KEY); }
// getRepo / getBranch は js/core/config.js で定義（data/portal-config.json から読む）

window.getToken     = getToken;
window.getGeminiKey = getGeminiKey;

// ---- AI Persona (vault/persona/persona.md から読む) ----
// window.AI_PERSONA = { name, userCallName, avatarUrl, body } はアプリ初期化時にセット済み
function getAiName()   { return (window.AI_PERSONA && window.AI_PERSONA.name)      || 'AI'; }
function getAiAvatar() { return (window.AI_PERSONA && window.AI_PERSONA.avatarUrl)  || 'docs/images/avatar.png'; }
function getAiPrompt() {
  const p = window.AI_PERSONA || {};
  return (p.body || 'あなたは優秀なアシスタントです。').replace(/\{呼称\}/g, p.userCallName || 'ユーザー');
}

// ---- 初期化 ----
function initSettingsTab() {
  showModalTokenUI();
  showModalGeminiUI();
  initCalendarDisplay();

  const statusEl = document.getElementById('modal-status');
  if (statusEl) statusEl.textContent = '';
}

// ---- GitHub PAT ----
function showModalTokenUI() {
  const hasToken = !!getToken();
  document.getElementById('modal-pat-set').classList.toggle('is-hidden', !hasToken);
  document.getElementById('modal-pat-unset').classList.toggle('is-hidden', hasToken);
}

function saveToken() {
  const val = document.getElementById('token-input').value.trim();
  if (!val) return;
  localStorage.setItem(TOKEN_KEY, val);
  document.getElementById('token-input').value = '';
  showModalTokenUI();
  location.reload(); // トークン変更時は確実な反映のためリロード推奨
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  showModalTokenUI();
  location.reload();
}

// ---- Gemini API Key ----
function showModalGeminiUI() {
  const has = !!getGeminiKey();
  document.getElementById('modal-gemini-set').classList.toggle('is-hidden', !has);
  document.getElementById('modal-gemini-unset').classList.toggle('is-hidden', has);
}

function saveGeminiKey() {
  const val = document.getElementById('gemini-key-input').value.trim();
  if (!val) return;
  localStorage.setItem(GEMINI_KEY, val);
  document.getElementById('gemini-key-input').value = '';
  showModalGeminiUI();
}

function clearGeminiKey() { localStorage.removeItem(GEMINI_KEY); showModalGeminiUI(); }

// ---- Calendar ----
function initCalendarDisplay() {
  const checkbox = document.getElementById('show-calendar-checkbox');
  if (checkbox) checkbox.checked = ConfigService.data.showCalendar !== false;
  applyCalendarVisibility();
}

async function toggleCalendarDisplay() {
  const show = document.getElementById('show-calendar-checkbox').checked;
  ConfigService.data = { ...ConfigService.data, showCalendar: show };
  applyCalendarVisibility();
  ConfigService.updateConfig({ showCalendar: show }, '📅 カレンダー表示設定を更新').catch(console.warn);
}

function applyCalendarVisibility() {
  const show = ConfigService.data.showCalendar !== false;
  const col = document.getElementById('col-calendar');
  const layout = document.querySelector('.layout');
  if (col) col.classList.toggle('is-hidden', !show);
  if (layout) layout.classList.toggle('calendar-hidden', !show);
}

// ---- Kintai URL ----
function getKintaiUrl() { return ConfigService.data.kintaiUrl || ''; }

async function saveKintaiUrl() {
  const val = document.getElementById('kintai-url-input').value.trim();
  const st = document.getElementById('kintai-url-status');
  st.textContent = '保存中...';
  await ConfigService.updateConfig({ kintaiUrl: val }, '📊 勤怠URLを更新');
  st.style.color = '#1a7f37'; st.textContent = '✅ 保存しました';
  setTimeout(() => { st.textContent = ''; }, 2000);
}

// global 登録
window.getToken = getToken;
window.getGeminiKey = getGeminiKey;
window.getAiName = getAiName;
window.getAiPrompt = getAiPrompt;
window.getAiAvatar = getAiAvatar;
window.getKintaiUrl = getKintaiUrl;
window.initSettingsTab = initSettingsTab;
window.saveToken = saveToken;
window.clearToken = clearToken;
window.saveGeminiKey = saveGeminiKey;
window.clearGeminiKey = clearGeminiKey;
window.toggleCalendarDisplay = toggleCalendarDisplay;
window.saveKintaiUrl = saveKintaiUrl;
window.testGeminiKey = async function() {
  const key = document.getElementById('gemini-key-input')?.value || getGeminiKey();
  const statusEl = document.getElementById('gemini-test-status');
  if (!key) {
    if (statusEl) statusEl.textContent = '❌ キーが入力されていません';
    return;
  }
  if (statusEl) statusEl.textContent = '⏳ テスト中...';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
    });
    if (res.ok) {
      if (statusEl) statusEl.textContent = '✅ 接続成功';
    } else {
      const err = await res.json().catch(() => ({}));
      if (statusEl) statusEl.textContent = `❌ エラー: ${err.error?.message || res.status}`;
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = `❌ 接続失敗: ${e.message}`;
  }
};
