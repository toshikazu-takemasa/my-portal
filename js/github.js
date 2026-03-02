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
