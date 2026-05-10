// =====================
// 日記 Viewer
// =====================
let reportContent = '';
let reportSha = '';
let reportTab = 'edit';
let reportPath = '';

function getDailyReportPaths () {
  const jst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, '0');
  const d = String(jst.getDate()).padStart(2, '0');
  return [`vault/diary/${y}-${m}-${d}.md`];
}

function getDailyReportPath () {
  return reportPath || getDailyReportPaths()[0];
}

async function getCurrentDailyReportSha (token, repo) {
  const path = getDailyReportPath();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${encodedPath}`;

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

async function fetchDailyReport () {
  const token = getToken();
  if (!token) {
    document.getElementById('report-preview').innerHTML = '<p class="md-empty">⚙️ 設定から PAT を設定すると日記を表示します</p>';
    return;
  }
  if (!getRepo()) {
    document.getElementById('report-preview').innerHTML = '<p class="md-empty">⚙️ 設定から GitHub リポジトリを設定してください</p>';
    return;
  }

  const metaEl = document.getElementById('report-meta');
  const previewEl = document.getElementById('report-preview');
  metaEl.textContent = '取得中…';

  try {
    const diary = await DiaryService.getTodayDiary();
    
    reportContent = diary.content;
    reportSha = diary.sha;
    reportPath = diary.path;

    if (!reportSha) {
      previewEl.innerHTML = '<p class="md-empty">日記がまだ作成されていません。<br>「↻ 日記を再生成」で生成してください。</p>';
      metaEl.textContent = '日記ファイルなし';
      return;
    }

    renderCurrentTab();
    const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    metaEl.textContent = `最終更新 ${now}`;
  } catch (e) {
    metaEl.textContent = 'ネットワークエラー';
  }
}

function switchMainTab (name) {
  const tabs = ['report', 'issues', 'links', 'ai', 'settings'];
  const enabledTabs = tabs.filter(t => !!document.getElementById('main-panel-' + t));

  const fallback = enabledTabs.includes('report')
    ? 'report'
    : (enabledTabs[0] || 'report');
  const target = enabledTabs.includes(name) ? name : fallback;

  tabs.forEach(t => {
    const tabEl = document.getElementById('mtab-' + t);
    const panelEl = document.getElementById('main-panel-' + t);
    const isActive = t === target;

    if (tabEl) tabEl.classList.toggle('active', isActive);
    if (!panelEl) return;

    panelEl.classList.toggle('is-hidden', !isActive);
    if (isActive) panelEl.style.removeProperty('display');
  });

  if (target === 'issues' && typeof fetchIssueBoard === 'function') {
    fetchIssueBoard();
  }
  if (target === 'settings' && typeof initSettingsTab === 'function') {
    initSettingsTab();
  }
}

function switchTab (tab) {
  reportTab = tab;
  renderCurrentTab();
}

function renderCurrentTab () {
  const p = document.getElementById('report-preview');
  const e = document.getElementById('report-edit');
  const tp = document.getElementById('tab-preview');
  const te = document.getElementById('tab-edit');
  if (!p || !e || !tp || !te) return;

  if (reportTab === 'preview') {
    p.classList.remove('is-hidden');
    e.classList.add('is-hidden');
    tp.classList.add('active');
    te.classList.remove('active');
    p.innerHTML = renderMarkdown(reportContent || '（日記がまだありません）');
    attachMdCheckboxListeners();
  } else {
    p.classList.add('is-hidden');
    e.classList.remove('is-hidden');
    tp.classList.remove('active');
    te.classList.add('active');
    const textarea = document.getElementById('report-textarea');
    if (textarea) textarea.value = reportContent;
  }
}

/**
 * AIによる振り返りをリクエストし、日記に追記する
 */
async function requestAiReflection() {
  const btn = document.getElementById('ai-reflection-btn');
  const statusEl = document.getElementById('reflect-status');
  if (!btn) return;

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = '🤔 思考中...';
  if (statusEl) statusEl.textContent = 'AIが内容を分析しています...';

  try {
    // コンテキストの収集
    const context = await AiService.getLatestContext();
    
    // AIへのプロンプト
    const prompt = `以下の日記と現在の状況を分析し、短くモチベーションが上がるような振り返りコメント（2-3文）を返してください。
人格設定：${getAiPrompt()}

## 現在の日記内容
${reportContent}

## 追加コンテキスト
${context}`;

    const aiComment = await callGemini(prompt);
    
    // DiaryService を使って追記
    const newContent = await DiaryService.appendReflection(reportContent, aiComment);
    
    // UIを更新
    reportContent = newContent;
    renderCurrentTab();
    
    if (statusEl) statusEl.textContent = '✅ 振り返りを追記しました';
  } catch (e) {
    console.error('AI Reflection Error:', e);
    if (statusEl) statusEl.textContent = '❌ エラーが発生しました';
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
  }
}

// --- 自動保存・下書き復元・ライブプレビュー ---
document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('report-textarea');
  if (!textarea) return;

  // 下書き復元（初期表示時）
  const draft = localStorage.getItem('diary-draft');
  if (draft !== null) textarea.value = draft;

  // 入力時に自動保存＆ライブプレビュー
  textarea.addEventListener('input', () => {
    localStorage.setItem('diary-draft', textarea.value);
    // プレビュータブにも即時反映
    if (reportTab === 'preview') {
      document.getElementById('report-preview').innerHTML = renderMarkdown(textarea.value);
      attachMdCheckboxListeners();
    }
  });
});

// 保存時に下書きを消す
const origSaveDailyReport = saveDailyReport;
saveDailyReport = async function () {
  const textarea = document.getElementById('report-textarea');
  if (textarea) localStorage.removeItem('diary-draft');
  await origSaveDailyReport.apply(this, arguments);
};

function attachMdCheckboxListeners () {
  document.querySelectorAll('.md-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const lineIdx = parseInt(cb.dataset.line);
      const lines = reportContent.split('\n');
      if (!lines[lineIdx]) return;

      lines[lineIdx] = cb.checked
        ? lines[lineIdx].replace(/^(\s*)- \[ \]/, '$1- [x]')
        : lines[lineIdx].replace(/^(\s*)- \[x\]/i, '$1- [ ]');
      reportContent = lines.join('\n');

      const span = cb.nextElementSibling;
      if (span) span.classList.toggle('md-done', cb.checked);

      const saveEl = document.getElementById('save-status');
      if (saveEl) {
        saveEl.style.color = '#8e8e8e';
        saveEl.textContent = '未反映の変更があります（📋 振り返りで反映 / 保存）';
      }
      const metaEl = document.getElementById('report-meta');
      if (metaEl) {
        metaEl.textContent = 'ローカル変更あり（未反映）';
      }
    });
  });
}

async function saveDailyReport () {
  const newContent = document.getElementById('report-textarea').value;
  reportContent = newContent;
  const statusEl = document.getElementById('save-status');
  statusEl.style.color = '#888';
  statusEl.textContent = '保存中…';
  await pushReportToGitHub('✏️ 日記を編集');
}

async function pushReportToGitHub (message) {
  const token = getToken();
  const repo = getRepo();
  if (!token || !repo) return;

  const saveEl = document.getElementById('save-status');
  const metaEl = document.getElementById('report-meta');

  try {
    const today = getJstTodayISO();
    const result = await DiaryService.saveDiary(reportContent, reportSha);
    
    reportSha = result.sha;
    renderCurrentTab();
    
    if (saveEl) { saveEl.style.color = '#1a7f37'; saveEl.textContent = '✅ 保存しました'; }
    const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    metaEl.textContent = `保存完了 ${now}（git pull で同期）`;

    // 保存成功時にチェックボックスをリセット
    resetAllCheckboxes();

    // AIティッカーにコメントをリクエスト
    if (typeof updateTickerWithDiaryComment === 'function') {
      updateTickerWithDiaryComment(reportContent);
    }

    // 家計入力欄をリセット
    if (typeof clearFinanceInputs === 'function') clearFinanceInputs();
  } catch (e) {
    if (saveEl) { saveEl.style.color = '#cf222e'; saveEl.textContent = `保存失敗: ${e.message}`; }
  }
}

function resetAllCheckboxes () {
  if (typeof resetDailyChecklist === 'function') resetDailyChecklist();
  if (typeof resetPillars === 'function') resetPillars();
  if (typeof resetTaskWidgetChecks === 'function') resetTaskWidgetChecks();
}

// =====================
// 今日の記録を日記に反映
// =====================

/**
 * チェックリスト・タスク・メモ・家計記録を収集し、
 * #reflect-output にプレビュー表示する。
 */
async function startAutoReflect () {
  const btn = document.getElementById('reflect-start-btn');
  const statusEl = document.getElementById('reflect-status');
  const outputEl = document.getElementById('reflect-output');
  const resultEl = document.getElementById('reflect-ai-result');
  if (!btn || !statusEl || !outputEl || !resultEl) return;

  btn.disabled = true;
  statusEl.textContent = '収集中…';
  outputEl.classList.add('is-hidden');

  try {
    const today = getJstTodayISO();
    const previewMd = await DiaryService.generateTemplate(today);

    // プレビュー表示
    resultEl.innerHTML = renderMarkdown(previewMd);

    outputEl.classList.remove('is-hidden');
    statusEl.textContent = '内容を確認して「日記に追記して保存」を押してください';

    // 生成した内容を後で appendAutoReflection が参照できるよう保持
    outputEl.dataset.reflectMd = previewMd;
  } catch (e) {
    statusEl.textContent = '収集エラー: ' + (e.message || String(e));
  } finally {
    btn.disabled = false;
  }
}

/**
 * startAutoReflect で生成したプレビューと追加コメントを
 * 現在の日記に追記して GitHub へ保存する。
 */
async function appendAutoReflection () {
  const outputEl = document.getElementById('reflect-output');
  const commentEl = document.getElementById('reflect-comment');
  const statusEl = document.getElementById('reflect-status');
  const appendBtn = document.getElementById('reflect-append-btn');
  if (!outputEl || !statusEl) return;

  const previewMd = (outputEl.dataset.reflectMd || '').trim();
  const comment = ((commentEl?.value) || '').trim();

  if (!previewMd) {
    statusEl.textContent = '先に「今日の記録を日記に反映」を押してください';
    return;
  }

  if (appendBtn) appendBtn.disabled = true;
  statusEl.textContent = '保存中…';

  try {
    // 日記がまだ読み込まれていない場合はテンプレートを準備
    if (!reportContent) {
      reportContent = await DiaryService.generateTemplate(getJstTodayISO());
    }

    // 追記内容を構築
    const commentBlock = comment ? '\n\n## 💬 コメント\n' + comment : '';
    const appendText = '\n\n---\n\n' + previewMd + commentBlock;

    // 既存のコンテンツに追記
    reportContent = reportContent.trimEnd() + appendText + '\n';

    await pushReportToGitHub('📝 今日の記録を日記に反映');

    statusEl.textContent = '✅ 保存しました';
    outputEl.classList.add('is-hidden');
    if (commentEl) commentEl.value = '';
    delete outputEl.dataset.reflectMd;
  } catch (e) {
    statusEl.textContent = '保存エラー: ' + (e.message || String(e));
  } finally {
    if (appendBtn) appendBtn.disabled = false;
  }
}

window.startAutoReflect = startAutoReflect;
window.appendAutoReflection = appendAutoReflection;
window.startAutoReflect = startAutoReflect;
window.appendAutoReflection = appendAutoReflection;

async function regenReport () {
  const token = getToken();
  const repo = getRepo();
  if (!token) { alert('設定画面から GitHub PAT を入力してください'); return; }
  if (!repo)  { alert('portal-config.json に repo が設定されていません'); return; }

  const btn = document.getElementById('regen-btn');
  const statusEl = document.getElementById('regen-status');
  btn.disabled = true;
  statusEl.style.removeProperty('display');
  statusEl.classList.remove('is-hidden');
  statusEl.textContent = '生成中…';

  try {
    const today = getJstTodayISO();
    const template = await DiaryService.generateTemplate(today);
    
    await DiaryService.saveDiary(template, reportSha);
    
    await fetchDailyReport();
    switchTab('edit');
    statusEl.style.color = '#1a7f37';
    statusEl.textContent = '✅ テンプレートを生成しました';
    setTimeout(() => { statusEl.classList.add('is-hidden'); }, 3000);
  } catch (e) {
    statusEl.style.color = '#cf222e';
    statusEl.textContent = '生成エラー: ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

window.switchMainTab = switchMainTab;
window.switchTab = switchTab;
window.saveDailyReport = saveDailyReport;
window.regenReport = regenReport;
window.requestAiReflection = requestAiReflection;
window.fetchDailyReport = fetchDailyReport;
