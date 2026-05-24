// =====================
// メモタブ（GitHub vault/memo.md）
// =====================

let memoTabLoaded = false;

async function loadMemoTab() {
  if (memoTabLoaded) return;

  const textarea = document.getElementById('memo-tab-textarea');
  const statusEl = document.getElementById('memo-tab-status');
  if (!textarea || !statusEl) return;

  statusEl.textContent = '読み込み中…';
  try {
    const content = await MemoRepository.load();
    textarea.value = content;
    statusEl.textContent = '';
    memoTabLoaded = true;

    textarea.addEventListener('input', () => {
      statusEl.style.color = 'var(--text-sub)';
      statusEl.textContent = '未保存の変更があります';
    });
  } catch (e) {
    if (e instanceof GitHubAuthError) {
      statusEl.style.color = '#cf222e';
      statusEl.textContent = 'GitHub PAT が未設定です（設定タブから登録してください）';
    } else {
      statusEl.style.color = '#cf222e';
      statusEl.textContent = `読み込み失敗: ${e.message}`;
    }
  }
}

async function saveMemoTab() {
  const textarea = document.getElementById('memo-tab-textarea');
  const statusEl = document.getElementById('memo-tab-status');
  if (!textarea || !statusEl) return;

  statusEl.style.color = 'var(--text-sub)';
  statusEl.textContent = '保存中…';
  try {
    await MemoRepository.save(textarea.value);
    statusEl.style.color = '#1a7f37';
    statusEl.textContent = '✅ 保存しました';
  } catch (e) {
    statusEl.style.color = '#cf222e';
    statusEl.textContent = `保存失敗: ${e.message}`;
  }
}

function clearMemoTab() {
  const textarea = document.getElementById('memo-tab-textarea');
  const statusEl = document.getElementById('memo-tab-status');
  if (!textarea || !statusEl) return;

  textarea.value = '';
  statusEl.style.color = 'var(--text-sub)';
  statusEl.textContent = '未保存の変更があります';
}

window.loadMemoTab  = loadMemoTab;
window.saveMemoTab  = saveMemoTab;
window.clearMemoTab = clearMemoTab;
