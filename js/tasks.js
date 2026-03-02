// =====================
// タスクウィジェット（GitHub Issues ベース）
// =====================
let currentTaskFilter = 'all';

function switchTaskFilter(filter) {
  currentTaskFilter = filter;
  document.querySelectorAll('.task-filter-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === filter);
  });
  fetchTaskWidget();
}

async function fetchTaskWidget() {
  const token = getToken();
  const repo  = getRepo();
  if (!token || !repo) return;

  const listEl   = document.getElementById('task-widget-list');
  const statusEl = document.getElementById('task-widget-status');
  if (!listEl) return;

  statusEl.textContent = '取得中…';
  listEl.innerHTML = '';

  // フィルタリング方針:
  //   'today' → P1 ラベル（今日やるべき高優先度）
  //   'week'  → P1 + P2 ラベル
  //   'all'   → すべてのオープン Issue
  const labelMap = {
    today: 'P1',
    week:  'P1,P2',
    all:   ''
  };
  const label = labelMap[currentTaskFilter] || '';

  try {
    const url = label
      ? `https://api.github.com/repos/${repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=30`
      : `https://api.github.com/repos/${repo}/issues?state=open&per_page=30`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });

    if (res.status === 401) { statusEl.textContent = '認証エラー'; return; }
    if (!res.ok) { statusEl.textContent = `エラー: ${res.status}`; return; }

    const issues = (await res.json()).filter(i => !i.pull_request);

    if (issues.length === 0) {
      listEl.innerHTML = '<p style="font-size:0.78rem;color:#aaa;padding:8px 0;">タスクはありません</p>';
      statusEl.textContent = '0件';
    } else {
      issues.forEach(issue => {
        const a = document.createElement('a');
        a.className = 'issue-item task-widget-item';
        a.href = issue.html_url;
        a.target = '_blank';

        // ラベルチップ（色付き）
        const labelsHtml = issue.labels.map(l => {
          const color = l.color ? l.color : 'aaa';
          return `<span class="label-chip" style="background:#${color}22;color:#${color};border-color:#${color}55">${escapeHtml(l.name)}</span>`;
        }).join('');

        a.innerHTML =
          `<span class="issue-num">#${issue.number}</span>` +
          `<span class="issue-title">${escapeHtml(issue.title)}</span>` +
          (labelsHtml ? `<span class="issue-labels">${labelsHtml}</span>` : '');

        listEl.appendChild(a);
      });

      const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      statusEl.textContent = `${issues.length}件 · ${now}`;
    }
  } catch (e) {
    statusEl.textContent = 'ネットワークエラー';
  }
}
