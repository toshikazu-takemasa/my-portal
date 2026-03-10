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

async function fetchTaskProjectStatusBatch({ token, repo, issues }) {
  if (!token || !repo || !Array.isArray(issues) || issues.length === 0) return new Map();

  // Reuse the issue panel implementation when available.
  if (typeof fetchIssueProjectStatusBatch === 'function') {
    return fetchIssueProjectStatusBatch({ token, repo, issues });
  }

  const nodeIds = issues.map(issue => issue?.node_id).filter(Boolean);
  if (nodeIds.length === 0) return new Map();

  const query = `
    query($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Issue {
          number
          projectItems(first: 20) {
            nodes {
              project {
                title
              }
              fieldValueByName(name: "Status") {
                __typename
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { ids: nodeIds } }),
    });
    if (!res.ok) return new Map();

    const payload = await res.json();
    if (payload?.errors?.length) return new Map();

    const statusMap = new Map();
    (payload?.data?.nodes || []).forEach(node => {
      if (!node || typeof node.number !== 'number') return;
      const projectStatuses = (node.projectItems?.nodes || [])
        .map(item => {
          const projectTitle = item?.project?.title || '';
          const statusName = item?.fieldValueByName?.name || '';
          if (!projectTitle || !statusName) return null;
          return { projectTitle, statusName };
        })
        .filter(Boolean);
      statusMap.set(node.number, projectStatuses);
    });
    return statusMap;
  } catch {
    return new Map();
  }
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
  const titleEl = document.getElementById('task-quick-title') || document.getElementById('issue-widget-create-title');
  const labelEl = document.getElementById('task-quick-label');
  const statusEl = document.getElementById('task-widget-status') || document.getElementById('issue-widget-status');
  if (!titleEl || !statusEl) return;

  const title = (titleEl.value || '').trim();
  const label = (labelEl?.value || '').trim();
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
  const statusEl = document.getElementById('task-widget-status') || document.getElementById('issue-widget-status');
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

async function closeTaskIssueFromRow(issueNumber, rowEl) {
  const statusEl = document.getElementById('task-widget-status') || document.getElementById('issue-widget-status');
  if (!statusEl) return;
  if (!confirm(`Issue #${issueNumber} をクローズしますか？`)) return;

  try {
    await patchTaskIssue(issueNumber, { state: 'closed' });
    const checkedState = getTaskWidgetCheckedState();
    delete checkedState[String(issueNumber)];
    saveTaskWidgetCheckedState(checkedState);

    rowEl?.remove();
    const remaining = document.querySelectorAll('#task-widget-list .issue-item, #issue-widget-list .issue-item').length;
    statusEl.textContent = remaining ? `${remaining}件` : 'オープンな Issue はありません';
    window.dispatchEvent(new Event('progress-data-changed'));

    if (typeof fetchIssueBoard === 'function') fetchIssueBoard();
  } catch (e) {
    statusEl.textContent = `更新失敗: ${e.message}`;
  }
}

async function openIssueEditorFromTask(issueNumber) {
  if (!issueNumber) return;

  // スマホでは右カラム表示中でも、編集フォームがあるメイン列に戻す。
  if (window.innerWidth <= 768 && typeof switchBottomNav === 'function') {
    switchBottomNav('report');
  }

  if (typeof switchMainTab === 'function') {
    switchMainTab('issues');
  }

  if (typeof fetchIssueBoard === 'function') {
    await fetchIssueBoard();
  }

  if (typeof startIssueEdit === 'function') {
    startIssueEdit(issueNumber);
  }
}

async function closeCheckedTaskIssues() {
  const statusEl = document.getElementById('task-widget-status') || document.getElementById('issue-widget-status');
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

  const listEl = document.getElementById('task-widget-list') || document.getElementById('issue-widget-list');
  const statusEl = document.getElementById('task-widget-status') || document.getElementById('issue-widget-status');
  const stateEl = document.getElementById('issue-widget-filter-state');
  const searchEl = document.getElementById('issue-widget-search-input');
  if (!listEl) return;
  if (!statusEl) return;

  statusEl.textContent = '取得中…';
  listEl.innerHTML = '';

  // フィルタリング方針:
  //   issue-widget-* がある場合は state/search を優先
  //   それ以外は従来の task filter（today/week/all）を適用
  const labelMap = {
    today: 'P1',
    week:  'P1,P2',
    all:   ''
  };
  const label = labelMap[currentTaskFilter] || '';
  const selectedState = stateEl?.value || 'open';
  const searchQuery = (searchEl?.value || '').trim().toLowerCase();

  try {
    const baseUrl = `https://api.github.com/repos/${repo}/issues`;
    const url = stateEl
      ? `${baseUrl}?state=${encodeURIComponent(selectedState)}&sort=updated&direction=desc&per_page=50`
      : (label
          ? `${baseUrl}?state=open&labels=${encodeURIComponent(label)}&per_page=30`
          : `${baseUrl}?state=open&per_page=30`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });

    if (res.status === 401) { statusEl.textContent = '認証エラー'; return; }
    if (!res.ok) { statusEl.textContent = `エラー: ${res.status}`; return; }

    const fetchedIssues = (await res.json()).filter(i => !i.pull_request);
    const issues = searchQuery
      ? fetchedIssues.filter(issue => {
          const title = (issue.title || '').toLowerCase();
          const labels = (issue.labels || []).map(labelItem => (labelItem.name || '').toLowerCase()).join(' ');
          return (`#${issue.number}`.includes(searchQuery) || title.includes(searchQuery) || labels.includes(searchQuery));
        })
      : fetchedIssues;

    const projectStatusMap = await fetchTaskProjectStatusBatch({ token, repo, issues });
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

        // ラベルチップ（色分けは残しつつ可読性優先で濃色文字に統一）
        const labelsHtml = issue.labels.map(l => {
          const color = l.color ? l.color : 'aaa';
          return `<span class="label-chip" style="background:#${color}2a;color:#111;border-color:#${color}aa">${escapeHtml(l.name)}</span>`;
        }).join('');

        const projectStatuses = projectStatusMap.get(issue.number) || [];
        const projectHtml = projectStatuses.map(item => {
          const text = item.statusName;
          return `<span class="label-chip" style="background:#1f6feb22;color:#111;border-color:#1f6feb99">${escapeHtml(text)}</span>`;
        }).join('');

        if (projectHtml || labelsHtml) {
          const labels = document.createElement('span');
          labels.className = 'issue-labels';
          labels.innerHTML = projectHtml + labelsHtml;
          content.appendChild(labels);
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'issue-close-btn';
        closeBtn.textContent = '×';
        closeBtn.title = 'クローズ';
        closeBtn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          closeTaskIssueFromRow(issue.number, row);
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'quick-memo-btn';
        editBtn.style.cssText = 'padding:4px 8px;font-size:0.7rem;background:#fff;color:#111;border:2px solid #111;min-height:auto;';
        editBtn.textContent = '編集';
        editBtn.addEventListener('click', async e => {
          e.preventDefault();
          e.stopPropagation();
          await openIssueEditorFromTask(issue.number);
        });

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;align-items:center;gap:5px;flex-shrink:0;';
        actions.appendChild(editBtn);
        actions.appendChild(closeBtn);

        check.addEventListener('change', () => {
          const nextState = getTaskWidgetCheckedState();
          nextState[String(issue.number)] = check.checked;
          saveTaskWidgetCheckedState(nextState);
          window.dispatchEvent(new Event('progress-data-changed'));
        });

        row.appendChild(check);
        row.appendChild(content);
        row.appendChild(actions);
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
window.fetchIssueWidget = fetchTaskWidget;
window.createIssueFromWidget = createTaskIssue;
