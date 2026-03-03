// =====================
// 日報 Viewer
// =====================
let reportContent = '';
let reportSha     = '';
let reportTab     = 'preview';

function getDailyReportPath() {
  const jst  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y    = jst.getFullYear();
  const m    = String(jst.getMonth() + 1).padStart(2, '0');
  const d    = String(jst.getDate()).padStart(2, '0');
  const days = ['日曜日','月曜日','火曜日','水曜日','木曜日','金曜日','土曜日'];
  return `保管庫/日報/${y}-${m}-${d}_${days[jst.getDay()]}_日報.md`;
}

function generateDailyReportTemplate() {
  const jst  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y    = jst.getFullYear();
  const m    = String(jst.getMonth() + 1).padStart(2, '0');
  const d    = String(jst.getDate()).padStart(2, '0');
  const headerDate = `${y}-${m}-${d}`;
  
  const template = `# ${headerDate}

- [ ] 朝メールチェック  
- [ ] 夜マネーフォワード  
- [ ] タスクチェック  
- [ ] [エクササイズ](https://youtu.be/GxDRXrpJjpI?si=kQMTI3Ps8Eo2bE4k)：5分  
- [ ] 読書または勉強

[数基礎](https://suukiso.com/):

残予算：　日   
次回クレカ：

—

- [ ] 確定申告  
- [ ] 緑瓶

`;
  return template;
}

async function getCurrentDailyReportSha(token, repo) {
  const path        = getDailyReportPath();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const apiUrl      = `https://api.github.com/repos/${repo}/contents/${encodedPath}`;

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (res.status === 404) return null;  // 新規作成
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`sha 取得失敗 (${res.status}): ${err.message || ''}`);
  }

  const data = await res.json();
  return data.sha || null;
}

async function fetchDailyReport() {
  const token = getToken();
  if (!token) {
    document.getElementById('report-preview').innerHTML = '<p class="md-empty">⚙️ 設定から PAT を設定すると日報を表示します</p>';
    return;
  }
  if (!getRepo()) {
    document.getElementById('report-preview').innerHTML = '<p class="md-empty">⚙️ 設定から GitHub リポジトリを設定してください</p>';
    return;
  }

  const metaEl    = document.getElementById('report-meta');
  const previewEl = document.getElementById('report-preview');
  metaEl.textContent = '取得中…';

  const path        = getDailyReportPath();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const apiUrl      = `https://api.github.com/repos/${getRepo()}/contents/${encodedPath}`;

  try {
    const res = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });

    if (res.status === 404) {
      previewEl.innerHTML = '<p class="md-empty">日報がまだ作成されていません。<br>「↻ 日報を再生成」で生成してください。</p>';
      metaEl.textContent  = '日報ファイルなし';
      // 新規作成用にテンプレートを用意
      reportContent = generateDailyReportTemplate();
      reportSha     = '';
      return;
    }
    if (res.status === 401) {
      previewEl.innerHTML = '<p class="md-empty">認証エラー。トークンを確認してください。</p>';
      metaEl.textContent  = '';
      return;
    }
    if (!res.ok) { metaEl.textContent = `エラー: ${res.status}`; return; }

    const data  = await res.json();
    const raw   = atob(data.content.replace(/\n/g, ''));
    const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
    reportContent = new TextDecoder('utf-8').decode(bytes);
    reportSha     = data.sha;

    renderCurrentTab();
    const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    metaEl.textContent = `最終更新 ${now}`;
  } catch (e) {
    metaEl.textContent = 'ネットワークエラー';
  }
}

function switchMainTab(name) {
  ['report', 'links', 'ai'].forEach(t => {
    document.getElementById('mtab-' + t).classList.toggle('active', t === name);
    document.getElementById('main-panel-' + t).classList.toggle('is-hidden', t !== name);
  });
}

function switchTab(tab) {
  reportTab = tab;
  document.getElementById('tab-preview').classList.toggle('active', tab === 'preview');
  document.getElementById('tab-edit').classList.toggle('active', tab === 'edit');
  document.getElementById('report-preview').classList.toggle('is-hidden', tab !== 'preview');
  document.getElementById('report-edit').classList.toggle('is-hidden', tab !== 'edit');
  renderCurrentTab();
}

function renderCurrentTab() {
  if (!reportContent) return;
  if (reportTab === 'preview') {
    document.getElementById('report-preview').innerHTML = renderMarkdown(reportContent);
    attachMdCheckboxListeners();
  } else {
    document.getElementById('report-textarea').value = reportContent;
  }
}

function attachMdCheckboxListeners() {
  document.querySelectorAll('.md-cb').forEach(cb => {
    cb.addEventListener('change', async () => {
      const lineIdx = parseInt(cb.dataset.line);
      const lines   = reportContent.split('\n');
      if (!lines[lineIdx]) return;

      lines[lineIdx] = cb.checked
        ? lines[lineIdx].replace(/^(\s*)- \[ \]/, '$1- [x]')
        : lines[lineIdx].replace(/^(\s*)- \[x\]/i, '$1- [ ]');
      reportContent = lines.join('\n');

      const span = cb.nextElementSibling;
      if (span) span.classList.toggle('md-done', cb.checked);

      await pushReportToGitHub(cb.checked ? '✅ チェック' : '⬜ チェック解除');
    });
  });
}

async function saveDailyReport() {
  const newContent = document.getElementById('report-textarea').value;
  reportContent = newContent;
  const statusEl = document.getElementById('save-status');
  statusEl.style.color = '#888';
  statusEl.textContent = '保存中…';
  await pushReportToGitHub('✏️ 日報を編集');
}

async function pushReportToGitHub(message) {
  const token = getToken();
  const repo = getRepo();
  if (!token || !repo) return;

  const saveEl  = document.getElementById('save-status');
  const metaEl  = document.getElementById('report-meta');
  const path        = getDailyReportPath();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const apiUrl      = `https://api.github.com/repos/${repo}/contents/${encodedPath}`;

  if (!reportSha) {
    try {
      reportSha = await getCurrentDailyReportSha(token, repo) || '';
    } catch (e) {
      if (saveEl) { saveEl.style.color = '#cf222e'; saveEl.textContent = `保存失敗: ${e.message}`; }
      return;
    }
  }

  const body = {
    message,
    content: encodeUtf8Base64(reportContent),
    ...(reportSha ? { sha: reportSha } : {}),
  };

  try {
    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const data = await res.json();
      reportSha = data.content.sha;
      renderCurrentTab();
      if (saveEl) { saveEl.style.color = '#1a7f37'; saveEl.textContent = '✅ 保存しました'; }
      const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      metaEl.textContent = `保存完了 ${now}（git pull で同期）`;
    } else {
      const err = await res.json().catch(() => ({}));
      if (saveEl) { saveEl.style.color = '#cf222e'; saveEl.textContent = `保存失敗: ${err.message || res.status}`; }
    }
  } catch (e) {
    if (saveEl) { saveEl.style.color = '#cf222e'; saveEl.textContent = '保存エラー'; }
  }
}

async function regenReport() {
  const token = getToken();
  const repo = getRepo();
  if (!token || !repo) { alert('GitHub PAT とリポジトリを設定してください'); return; }

  const btn = document.getElementById('regen-btn');
  const statusEl = document.getElementById('regen-status');
  btn.disabled = true;
  statusEl.classList.remove('is-hidden');
  statusEl.textContent = '生成中…';

  const path        = getDailyReportPath();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const apiUrl      = `https://api.github.com/repos/${repo}/contents/${encodedPath}`;

  try {
    const template = generateDailyReportTemplate();

    let latestSha;
    try {
      latestSha = await getCurrentDailyReportSha(token, repo);
    } catch (e) {
      statusEl.style.color = '#cf222e';
      statusEl.textContent = `生成失敗: ${e.message}`;
      return;
    }

    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: latestSha != null ? '📝 日報を再生成' : '🆕 日報を新規作成',
        content: encodeUtf8Base64(template),
        ...(latestSha != null ? { sha: latestSha } : {}),
      })
    });

    if (res.ok) {
      const data = await res.json();
      reportSha = data.content.sha;
      reportContent = template;
      renderCurrentTab();
      switchTab('preview');
      statusEl.style.color = '#1a7f37';
      statusEl.textContent = '✅ テンプレートを生成しました';
      setTimeout(() => { statusEl.classList.add('is-hidden'); }, 3000);
    } else {
      const err = await res.json().catch(() => ({}));
      statusEl.style.color = '#cf222e';
      statusEl.textContent = `生成失敗: ${err.message || res.status}`;
    }
  } catch (e) {
    statusEl.style.color = '#cf222e';
    statusEl.textContent = '生成エラー';
  } finally {
    btn.disabled = false;
  }
}
