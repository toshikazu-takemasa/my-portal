// =====================
// GitHub Issues
// =====================
async function fetchIssues() {
  const token = getToken();
  if (!token || !getRepo()) return;

  const statusEl = document.getElementById('issues-status');
  const listEl   = document.getElementById('issues-list');
  statusEl.textContent = '取得中…';
  listEl.innerHTML = '';

  try {
    const res = await fetch(
      `https://api.github.com/repos/${getRepo()}/issues?state=open&per_page=20`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );

    if (res.status === 401) { statusEl.textContent = '認証エラー'; return; }
    if (!res.ok) { statusEl.textContent = `エラー: ${res.status}`; return; }

    const issues   = await res.json();
    const filtered = issues.filter(i => !i.pull_request);

    if (filtered.length === 0) {
      listEl.innerHTML = '<p style="font-size:0.78rem;color:#aaa;padding:4px 0;">オープンな Issue はありません</p>';
    } else {
      filtered.forEach(issue => {
        const a = document.createElement('a');
        a.className = 'issue-item';
        a.href = issue.html_url;
        a.target = '_blank';
        a.innerHTML = `<span class="issue-num">#${issue.number}</span><span class="issue-title">${escapeHtml(issue.title)}</span>`;
        listEl.appendChild(a);
      });
    }

    const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    statusEl.textContent = `${filtered.length}件 · 更新 ${now}`;
  } catch (e) {
    statusEl.textContent = 'ネットワークエラー';
  }
}

// =====================
// 日報再生成
// =====================
async function regenReport() {
  const token = getToken();
  if (!token) {
    alert('⚙️ 設定から GitHub PAT を先に設定してください。');
    return;
  }
  if (!getRepo()) {
    alert('⚙️ 設定から GitHub リポジトリを先に設定してください。');
    return;
  }
  const btn = document.getElementById('regen-btn');
  const statusEl = document.getElementById('regen-status');
  btn.disabled = true;
  btn.textContent = '送信中…';
  statusEl.style.display = 'block';
  statusEl.style.color = '#888';
  statusEl.textContent = '';

  try {
    const res = await fetch(
      `https://api.github.com/repos/${getRepo()}/actions/workflows/daily-report.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: getBranch() }),
      }
    );

    if (res.status === 204) {
      const prevSha = reportSha;
      const MAX = 18;
      const INTERVAL = 20;
      let attempt = 0;

      btn.textContent = '生成中…';
      statusEl.style.color = '#888';

      const poll = setInterval(async () => {
        attempt++;
        statusEl.textContent = `🔄 生成中… ${attempt * INTERVAL}秒経過`;

        await fetchDailyReport();

        if (reportSha && reportSha !== prevSha) {
          clearInterval(poll);
          statusEl.style.color = '#1a7f37';
          statusEl.textContent = '✅ 日報が更新されました！';
          btn.disabled = false;
          btn.textContent = '↻ 日報を再生成';
          return;
        }

        if (attempt >= MAX) {
          clearInterval(poll);
          statusEl.style.color = '#cf222e';
          statusEl.textContent = '⏱ タイムアウト。手動で ↻ 更新 を押してください。';
          btn.disabled = false;
          btn.textContent = '↻ 日報を再生成';
        }
      }, INTERVAL * 1000);

      return;

    } else if (res.status === 403) {
      statusEl.textContent = '⚠️ 権限エラー。トークンに Actions write が必要です。';
      statusEl.style.color = '#cf222e';
    } else {
      statusEl.textContent = `エラー: ${res.status}`;
      statusEl.style.color = '#cf222e';
    }
  } catch (e) {
    statusEl.textContent = 'ネットワークエラー';
    statusEl.style.color = '#cf222e';
  }

  btn.disabled = false;
  btn.textContent = '↻ 日報を再生成';
}
