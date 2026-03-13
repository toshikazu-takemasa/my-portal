// =====================
// 勤怠シートURL（月次更新）
// =====================
const KINTAI_URL_KEY     = 'kintai_sheet_url';
const KINTAI_DEFAULT_URL = '';  // 初回は未設定（設定画面から入力）

function getKintaiUrl() {
  return localStorage.getItem(KINTAI_URL_KEY) || KINTAI_DEFAULT_URL;
}

function saveKintaiUrl() {
  const val = document.getElementById('kintai-url-input').value.trim();
  if (!val) return;
  localStorage.setItem(KINTAI_URL_KEY, val);
  const link = document.getElementById('kintai-sheet-link');
  if (link) link.href = val;
  document.getElementById('kintai-url-input').value = '';
  if (portalConfig) {
    portalConfig.kintaiUrl = val;
    savePortalConfig('📊 勤怠URLを更新');
  }
  const st = document.getElementById('kintai-url-status');
  st.style.color = '#1a7f37';
  st.textContent = '✅ 保存しました';
  setTimeout(() => { st.textContent = ''; }, 2000);
}

// 勤怠シートリンクの初期設定
const kintaiLink = document.getElementById('kintai-sheet-link');
if (kintaiLink && getKintaiUrl()) kintaiLink.href = getKintaiUrl();

// =====================
// GitHub リポジトリ設定
// =====================
function saveRepoConfig() {
  const repo   = document.getElementById('repo-input').value.trim();
  const branch = document.getElementById('branch-input').value.trim() || 'main';
  if (!repo) return;
  localStorage.setItem(REPO_KEY, repo);
  localStorage.setItem(BRANCH_KEY, branch);

  const st = document.getElementById('repo-status');
  st.style.color = '#1a7f37';
  st.textContent = '✅ 保存しました';
  setTimeout(() => { st.textContent = ''; }, 2000);

  // データを再取得
  if (getToken()) {
    fetchDailyReport();
    fetchTaskWidget();
    if (typeof fetchIssueBoard === 'function') fetchIssueBoard();
    loadPortalConfig().then(() => renderAllLinks());
  }
}

function showRepoConfig() {
  const repo   = getRepo();
  const branch = getBranch();
  const repoInput   = document.getElementById('repo-input');
  const branchInput = document.getElementById('branch-input');
  if (repoInput   && repo)   repoInput.value   = repo;
  if (branchInput && branch) branchInput.value = branch;
}

// =====================
// 設定モーダル
// =====================
const TOKEN_KEY = 'gh_pat';

function getToken() { return localStorage.getItem(TOKEN_KEY); }

function initSettingsTab() {
  showModalTokenUI();
  showModalGeminiUI();
  showRepoConfig();
  initCalendarDisplay();
  const statusEl = document.getElementById('modal-status');
  if (statusEl) statusEl.textContent = '';
}

// closeSettings function removed as it's now a tab

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
  const statusEl = document.getElementById('modal-status');
  statusEl.style.color = '#1a7f37';
  statusEl.textContent = '✅ 保存しました。データを取得中…';
  fetchDailyReport();
  fetchTaskWidget();
  if (typeof fetchIssueBoard === 'function') fetchIssueBoard();
  setTimeout(() => { statusEl.textContent = ''; }, 3000);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  showModalTokenUI();
  document.getElementById('report-preview').innerHTML = '<p class="md-empty">⚙️ 設定から PAT を設定すると日記を表示します</p>';
  const statusEl = document.getElementById('modal-status');
  statusEl.style.color = '#cf222e';
  statusEl.textContent = 'トークンを削除しました';
  setTimeout(() => { statusEl.textContent = ''; }, 3000);
}

// ---- Gemini API Key UI ----
const GEMINI_KEY = 'gemini_api_key';

function getGeminiKey() { return localStorage.getItem(GEMINI_KEY); }

function saveGeminiKey() {
  const val = document.getElementById('gemini-key-input').value.trim();
  if (!val) return;
  localStorage.setItem(GEMINI_KEY, val);
  document.getElementById('gemini-key-input').value = '';
  showModalGeminiUI();
  const st = document.getElementById('modal-status');
  st.style.color = '#1a7f37'; st.textContent = '✅ Gemini APIキーを保存しました';
  setTimeout(() => { st.textContent = ''; }, 2000);
}

function clearGeminiKey() { localStorage.removeItem(GEMINI_KEY); showModalGeminiUI(); }

function showModalGeminiUI() {
  const has = !!getGeminiKey();
  document.getElementById('modal-gemini-set').classList.toggle('is-hidden', !has);
  document.getElementById('modal-gemini-unset').classList.toggle('is-hidden', has);
}

async function testGeminiKey() {
  const btn = document.getElementById('gemini-test-btn');
  const statusEl = document.getElementById('gemini-test-status');
  if (!btn || !statusEl) return;

  const key = getGeminiKey();
  if (!key) {
    statusEl.style.color = '#cf222e';
    statusEl.textContent = '❌ APIキーが設定されていません';
    return;
  }

  btn.disabled = true;
  statusEl.style.color = '#888';
  statusEl.textContent = '接続テスト中...';

  try {
    const prompt = "「接続テスト成功です！」と短く返事してください。";
    const res = await callGemini(prompt);
    statusEl.style.color = '#1a7f37';
    statusEl.textContent = `✅ 成功: ${res}`;
    
    // キーが正しいことが確認されたので、ティッカーのキャッシュをクリアして再取得を促す
    localStorage.removeItem('ai_ticker_cache');
    localStorage.removeItem('ai_ticker_date');
    if (typeof initAiTicker === 'function') initAiTicker(true);
  } catch (e) {
    statusEl.style.color = '#cf222e';
    statusEl.textContent = `❌ 失敗: ${e.message}`;
  } finally {
    btn.disabled = false;
  }
}

// ---- AI Persona Settings ----
const AI_NAME_KEY    = 'ai_persona_name';
const AI_PROMPT_KEY  = 'ai_persona_prompt';
const AI_AVATAR_KEY  = 'ai_persona_avatar';

const DEFAULT_AI_NAME   = '八神はやて';
const DEFAULT_AI_PROMPT = 'あなたは「魔法少女リリカルなのは」の八神はやてです。おだやかで面倒見が良く、ユーザーを「主（あるじ）くん」または「主さん」と呼びます。関西弁（京都弁寄り）で話し、日常生活のサポート、体調への気遣い、作業の励まし、今日という日を肯定する言葉をかけてください。温かく包み込むような「癒やし」と「応援」があなたの役割です。';
const DEFAULT_AI_AVATAR = 'docs/images/avatar.png';

function getAiName()   { return localStorage.getItem(AI_NAME_KEY)   || DEFAULT_AI_NAME; }
function getAiPrompt() { return localStorage.getItem(AI_PROMPT_KEY) || DEFAULT_AI_PROMPT; }
function getAiAvatar() { return localStorage.getItem(AI_AVATAR_KEY) || DEFAULT_AI_AVATAR; }

function saveAiPersona() {
  const name = document.getElementById('ai-name-input').value.trim();
  const prompt = document.getElementById('ai-persona-input').value.trim();
  const avatar = document.getElementById('ai-avatar-input').value.trim();

  if (!name)   localStorage.removeItem(AI_NAME_KEY);   else localStorage.setItem(AI_NAME_KEY, name);
  if (!prompt) localStorage.removeItem(AI_PROMPT_KEY); else localStorage.setItem(AI_PROMPT_KEY, prompt);
  if (!avatar) localStorage.removeItem(AI_AVATAR_KEY); else localStorage.setItem(AI_AVATAR_KEY, avatar);

  const st = document.getElementById('ai-persona-status');
  st.style.color = '#1a7f37'; st.textContent = '✅ 人格設定を更新しました（空欄はデフォルトに戻ります）';
  setTimeout(() => { st.textContent = ''; }, 3000);
  
  // 反映
  initAiPersonaUI();
  if (typeof initAiTicker === 'function') initAiTicker();
}

function initAiPersonaUI() {
  document.getElementById('ai-name-input').value    = getAiName();
  document.getElementById('ai-persona-input').value = getAiPrompt();
  document.getElementById('ai-avatar-input').value  = getAiAvatar();
}

// =====================
// カレンダー表示設定
// =====================
const SHOW_CALENDAR_KEY = 'show_calendar';

function getShowCalendar() {
  const value = localStorage.getItem(SHOW_CALENDAR_KEY);
  return value === null ? true : value === 'true'; // デフォルトは表示
}

function setShowCalendar(show) {
  localStorage.setItem(SHOW_CALENDAR_KEY, show.toString());
}

function toggleCalendarDisplay() {
  const checkbox = document.getElementById('show-calendar-checkbox');
  const show = checkbox.checked;
  setShowCalendar(show);
  applyCalendarVisibility();
}

function applyCalendarVisibility() {
  const show = getShowCalendar();
  const colCalendar = document.getElementById('col-calendar');
  const layout = document.querySelector('.layout');
  const isMobile = window.innerWidth <= 768;

  // スマホではボトムナビが列の表示を管理するため、ここでは変更しない
  if (colCalendar && !isMobile) {
    colCalendar.classList.toggle('is-hidden', !show);
  }

  // レイアウトは CSS の状態クラスで制御
  if (layout) {
    layout.classList.toggle('calendar-hidden', !show && !isMobile);
  }
}

function initCalendarDisplay() {
  const show = getShowCalendar();
  const checkbox = document.getElementById('show-calendar-checkbox');
  if (checkbox) {
    checkbox.checked = show;
  }
  applyCalendarVisibility();
}

window.addEventListener('resize', applyCalendarVisibility);

// =====================
// テーマ切り替え
// =====================
const THEME_KEY = 'portal_theme';

function changeTheme() {
  const select = document.getElementById('theme-select');
  if (!select) return;
  const newTheme = select.value;
  localStorage.setItem(THEME_KEY, newTheme);
  
  // bodyからテーマクラスを削除
  document.body.classList.remove('theme-ff14', 'theme-hayate');
  
  // 新しいテーマを追加
  if (newTheme) {
    document.body.classList.add(newTheme);
  }
}

function initThemeDisplay() {
  const select = document.getElementById('theme-select');
  if (!select) return;
  const currentTheme = localStorage.getItem(THEME_KEY) || '';
  select.value = currentTheme;
}

// initSettingsTabにテーマ初期化を追加するため、元の関数をオーバーライドするか
// ページロード時にそのまま実行するか
document.addEventListener('DOMContentLoaded', () => {
  initThemeDisplay();
});
