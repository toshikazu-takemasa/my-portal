// =====================
// タスクウィジェット（GitHub Issues ベース）
// =====================
let currentTaskFilter = 'all';
let taskWidgetIssuesCache = [];

function getTaskWidgetDateKey() {
  return (typeof todayISO !== 'undefined' && todayISO)
    ? todayISO
    : new Date().toISOString().slice(0, 10);
}

function getTaskWidgetStateKey() {
  return `task-widget-checked_${getTaskWidgetDateKey()}`;
}

function getTaskWidgetSnapshotKey() {
  return `task-widget-snapshot_${getTaskWidgetDateKey()}`;
}

function getTaskWidgetCheckedState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getTaskWidgetStateKey()) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveTaskWidgetCheckedState(state) {
  localStorage.setItem(getTaskWidgetStateKey(), JSON.stringify(state || {}));
}

function saveTaskWidgetSnapshot(issues) {
  const snapshot = Array.isArray(issues)
    ? issues.map(issue => ({
        id: issue.number,
        title: issue.title,
        url: issue.html_url,
      }))
    : [];
  localStorage.setItem(getTaskWidgetSnapshotKey(), JSON.stringify(snapshot));
}

async function patchTaskIssue(issueNumber, payload) {
  const token = getToken();
  const repo = getRepo();
  if (!token || !repo) throw new Error('PAT/リポジトリ未設定');

  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload || {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || String(res.status));
  }

  return res.json();
}

async function createTaskIssue() {
  const token = getToken();
  const repo = getRepo();
  const titleEl = document.getElementById('task-quick-title');
  const labelEl = document.getElementById('task-quick-label');
  const statusEl = document.getElementById('task-widget-status');
  if (!titleEl || !labelEl || !statusEl) return;

  const title = (titleEl.value || '').trim();
  const label = (labelEl.value || '').trim();
  if (!title) {
    statusEl.textContent = 'タイトルを入力してください';
    return;
  }
  if (!token || !repo) {
    statusEl.textContent = 'PAT/リポジトリ未設定';
    return;
  }

  statusEl.textContent = '作成中...';

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
        ...(label ? { labels: [label] } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      statusEl.textContent = `作成失敗: ${err.message || res.status}`;
      return;
    }

    titleEl.value = '';
    statusEl.textContent = '✅ 追加しました';
    await fetchTaskWidget();
    if (typeof fetchIssueBoard === 'function') fetchIssueBoard();
  } catch {
    statusEl.textContent = '作成時にネットワークエラー';
  }
}

async function closeTaskIssue(issueNumber) {
  const statusEl = document.getElementById('task-widget-status');
  if (!statusEl) return;
  statusEl.textContent = `#${issueNumber} を完了中...`;

  try {
    await patchTaskIssue(issueNumber, { state: 'closed' });
    const checkedState = getTaskWidgetCheckedState();
    delete checkedState[String(issueNumber)];
    saveTaskWidgetCheckedState(checkedState);
    statusEl.textContent = `✅ #${issueNumber} を完了`; 
    await fetchTaskWidget();
    if (typeof fetchIssueBoard === 'function') fetchIssueBoard();
  } catch (e) {
    statusEl.textContent = `更新失敗: ${e.message}`;
  }
}

async function closeCheckedTaskIssues() {
  const statusEl = document.getElementById('task-widget-status');
  if (!statusEl) return;

  const checkedState = getTaskWidgetCheckedState();
  const targets = taskWidgetIssuesCache
    .map(issue => issue.number)
    .filter(num => checkedState[String(num)] === true);

  if (targets.length === 0) {
    statusEl.textContent = 'チェック済みタスクがありません';
    return;
  }

  statusEl.textContent = `${targets.length}件を完了中...`;

  let done = 0;
  for (const issueNumber of targets) {
    try {
      await patchTaskIssue(issueNumber, { state: 'closed' });
      done += 1;
    } catch {
      // 続行
    }
  }

  saveTaskWidgetCheckedState({});
  statusEl.textContent = `✅ ${done}/${targets.length}件を完了`; 
  await fetchTaskWidget();
  if (typeof fetchIssueBoard === 'function') fetchIssueBoard();
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
    taskWidgetIssuesCache = issues;

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

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;width:100%;';

        const doneBtn = document.createElement('button');
        doneBtn.className = 'quick-memo-btn';
        doneBtn.style.cssText = 'padding:4px 8px;font-size:0.7rem;';
        doneBtn.textContent = '完了';
        doneBtn.addEventListener('click', () => closeTaskIssue(issue.number));

        const editBtn = document.createElement('button');
        editBtn.className = 'quick-memo-btn';
        editBtn.style.cssText = 'padding:4px 8px;font-size:0.7rem;background:#fff;color:#111;border:2px solid #111;';
        editBtn.textContent = '編集';
        editBtn.addEventListener('click', () => {
          if (typeof switchMainTab === 'function') switchMainTab('issues');
          if (typeof startIssueEdit === 'function') startIssueEdit(issue.number);
        });

        actions.appendChild(doneBtn);
        actions.appendChild(editBtn);
        content.appendChild(actions);

        check.addEventListener('change', () => {
          const nextState = getTaskWidgetCheckedState();
          nextState[String(issue.number)] = check.checked;
          saveTaskWidgetCheckedState(nextState);
          window.dispatchEvent(new Event('progress-data-changed'));
        });

        row.appendChild(check);
        row.appendChild(content);
        listEl.appendChild(row);
      });

      const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      statusEl.textContent = `${issues.length}件 · ${now}`;
      window.dispatchEvent(new Event('progress-data-changed'));
    }
  } catch (e) {
    statusEl.textContent = 'ネットワークエラー';
  }
}

window.createTaskIssue = createTaskIssue;
window.closeCheckedTaskIssues = closeCheckedTaskIssues;
