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

function openSettings() {
  document.getElementById('settings-modal').classList.add('open');
  showModalTokenUI();
  showModalClaudeUI();
  showRepoConfig();
  initCalendarDisplay();
  document.getElementById('modal-status').textContent = '';
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('open');
}

function closeSettingsOnOverlay(e) {
  if (e.target === document.getElementById('settings-modal')) closeSettings();
}

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

// ---- Claude API Key UI ----
const CLAUDE_KEY = 'claude_api_key';

function getClaudeKey() { return localStorage.getItem(CLAUDE_KEY); }

function saveClaudeKey() {
  const val = document.getElementById('claude-key-input').value.trim();
  if (!val) return;
  localStorage.setItem(CLAUDE_KEY, val);
  document.getElementById('claude-key-input').value = '';
  showModalClaudeUI();
  const st = document.getElementById('modal-status');
  st.style.color = '#1a7f37'; st.textContent = '✅ APIキーを保存しました';
  setTimeout(() => { st.textContent = ''; }, 2000);
}

function clearClaudeKey() { localStorage.removeItem(CLAUDE_KEY); showModalClaudeUI(); }

function showModalClaudeUI() {
  const has = !!getClaudeKey();
  document.getElementById('modal-claude-set').classList.toggle('is-hidden', !has);
  document.getElementById('modal-claude-unset').classList.toggle('is-hidden', has);
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
