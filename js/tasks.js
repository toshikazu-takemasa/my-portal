// =====================
// タスクウィジェット（GitHub Issues ベース）
// =====================
let currentTaskFilter = 'all';
const taskDateKey = (typeof todayISO !== 'undefined' && todayISO)
  ? todayISO
  : new Date().toISOString().slice(0, 10);
const TASK_WIDGET_STATE_KEY = `task-widget-checked_${taskDateKey}`;
const TASK_WIDGET_SNAPSHOT_KEY = `task-widget-snapshot_${taskDateKey}`;

function getTaskWidgetCheckedState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TASK_WIDGET_STATE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveTaskWidgetCheckedState(state) {
  localStorage.setItem(TASK_WIDGET_STATE_KEY, JSON.stringify(state || {}));
}

function saveTaskWidgetSnapshot(issues) {
  const snapshot = Array.isArray(issues)
    ? issues.map(issue => ({
        id: issue.number,
        title: issue.title,
        url: issue.html_url,
      }))
    : [];
  localStorage.setItem(TASK_WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

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

    saveTaskWidgetSnapshot(issues);

    if (issues.length === 0) {
      listEl.innerHTML = '<p style="font-size:0.78rem;color:#aaa;padding:8px 0;">タスクはありません</p>';
      statusEl.textContent = '0件';
    } else {
      const checkedState = getTaskWidgetCheckedState();

      issues.forEach(issue => {
        const row = document.createElement('div');
        row.className = 'issue-item task-widget-item';

        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'task-widget-check';
        check.checked = checkedState[String(issue.number)] === true;
        check.style.cssText = 'width:15px;height:15px;margin-top:2px;accent-color:var(--accent);cursor:pointer;flex-shrink:0;';

        const content = document.createElement('div');
        content.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;flex:1;min-width:0;';

        const link = document.createElement('a');
        link.href = issue.html_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = 'display:flex;gap:7px;align-items:flex-start;text-decoration:none;color:inherit;flex:1;min-width:0;';

        const num = document.createElement('span');
        num.className = 'issue-num';
        num.textContent = `#${issue.number}`;

        const title = document.createElement('span');
        title.className = 'issue-title';
        title.textContent = issue.title;

        link.appendChild(num);
        link.appendChild(title);
        content.appendChild(link);

        // ラベルチップ（色付き）
        const labelsHtml = issue.labels.map(l => {
          const color = l.color ? l.color : 'aaa';
          return `<span class="label-chip" style="background:#${color}22;color:#${color};border-color:#${color}55">${escapeHtml(l.name)}</span>`;
        }).join('');

        if (labelsHtml) {
          const labels = document.createElement('span');
          labels.className = 'issue-labels';
          labels.innerHTML = labelsHtml;
          content.appendChild(labels);
        }

        check.addEventListener('change', () => {
          const nextState = getTaskWidgetCheckedState();
          nextState[String(issue.number)] = check.checked;
          saveTaskWidgetCheckedState(nextState);
        });

        row.appendChild(check);
        row.appendChild(content);
        listEl.appendChild(row);
      });

      const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      statusEl.textContent = `${issues.length}件 · ${now}`;
    }
  } catch (e) {
    statusEl.textContent = 'ネットワークエラー';
  }
}
