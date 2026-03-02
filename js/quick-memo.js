// =====================
// クイックメモ（Issue を素早く作成）
// =====================
async function createQuickMemo() {
  const token = getToken();
  if (!token) { alert('GitHub PAT が必要です（⚙️ 設定）'); return; }

  const repo = getRepo();
  if (!repo) { alert('GitHub リポジトリが設定されていません（⚙️ 設定）'); return; }

  const title = document.getElementById('quick-memo-title').value.trim();
  if (!title) return;

  const labelVal = document.getElementById('quick-memo-label').value;
  const statusEl = document.getElementById('quick-memo-status');
  const btn      = document.querySelector('.quick-memo-btn');

  btn.disabled = true;
  statusEl.style.color = '#888';
  statusEl.textContent = '作成中…';

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        labels: ['status: todo', labelVal],
      }),
    });

    if (res.ok) {
      const issue = await res.json();
      statusEl.style.color = '#1a7f37';
      statusEl.textContent = `✅ Issue #${issue.number} を作成しました`;
      document.getElementById('quick-memo-title').value = '';
      // タスクウィジェットと Issues リストを再取得
      fetchTaskWidget();
      fetchIssues();
    } else {
      const err = await res.json().catch(() => ({}));
      statusEl.style.color = '#cf222e';
      statusEl.textContent = `作成失敗: ${err.message || res.status}`;
    }
  } catch (e) {
    statusEl.style.color = '#cf222e';
    statusEl.textContent = 'ネットワークエラー';
  } finally {
    btn.disabled = false;
    setTimeout(() => { statusEl.textContent = ''; }, 4000);
  }
}

// Enter キーで送信
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('quick-memo-title');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); createQuickMemo(); }
    });
  }
});
