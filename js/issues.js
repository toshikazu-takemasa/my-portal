// =====================
// Issue パネル（作成・一覧・更新）
// =====================
let issuePanelCache = [];

async function fetchIssueProjectStatusBatch({ token, repo, issues }) {
  if (!token || !repo || !Array.isArray(issues) || issues.length === 0) return new Map();

  const nodeIds = issues
    .map(issue => issue?.node_id)
    .filter(Boolean);

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

function parseIssueLabels(text) {
  return (text || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

async function closeIssueFromPanel(issueNumber, rowEl) {
  const token = getToken();
  const repo = getRepo();
  const statusEl = document.getElementById('issue-board-status');
  if (!token || !repo || !statusEl) return;
  if (!confirm(`Issue #${issueNumber} をクローズしますか？`)) return;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'closed' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      statusEl.textContent = `更新失敗: ${err.message || res.status}`;
      return;
    }

    rowEl?.remove();
    const remaining = document.querySelectorAll('#issue-board-list .issue-item').length;
    statusEl.textContent = remaining ? `${remaining}件` : 'オープンな Issue はありません';

    if (typeof fetchTaskWidget === 'function') fetchTaskWidget();
  } catch {
    statusEl.textContent = '更新時にネットワークエラー';
  }
}

async function fetchIssueBoard() {
  const token = getToken();
  const repo = getRepo();
  const listEl = document.getElementById('issue-board-list');
  const statusEl = document.getElementById('issue-board-status');
  const stateEl = document.getElementById('issue-filter-state');
  const searchEl = document.getElementById('issue-search-input');
  if (!listEl || !statusEl || !stateEl || !searchEl) return;

  if (!token || !repo) {
    listEl.innerHTML = '<p style="font-size:0.8rem;color:#8e8e8e;">設定で PAT とリポジトリを指定してください。</p>';
    statusEl.textContent = '未設定';
    return;
  }

  statusEl.textContent = '取得中...';
  listEl.innerHTML = '';

  const state = stateEl.value || 'open';
  const query = (searchEl.value || '').trim().toLowerCase();

  try {
    const url = `https://api.github.com/repos/${repo}/issues?state=${encodeURIComponent(state)}&sort=updated&direction=desc&per_page=50`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (res.status === 401) {
      statusEl.textContent = '認証エラー';
      listEl.innerHTML = '<p style="font-size:0.8rem;color:#cf222e;">PAT を確認してください。</p>';
      return;
    }

    if (!res.ok) {
      statusEl.textContent = `エラー: ${res.status}`;
      listEl.innerHTML = '<p style="font-size:0.8rem;color:#cf222e;">Issue の取得に失敗しました。</p>';
      return;
    }

    const rawIssues = (await res.json()).filter(issue => !issue.pull_request);
    const issues = query
      ? rawIssues.filter(issue => {
          const title = (issue.title || '').toLowerCase();
          const labels = (issue.labels || []).map(label => (label.name || '').toLowerCase()).join(' ');
          return (`#${issue.number}`.includes(query) || title.includes(query) || labels.includes(query));
        })
      : rawIssues;

    const projectStatusMap = await fetchIssueProjectStatusBatch({ token, repo, issues });

    issuePanelCache = issues;

    if (issues.length === 0) {
      listEl.innerHTML = '<p style="font-size:0.8rem;color:#8e8e8e;">Issue はありません。</p>';
      statusEl.textContent = '0件';
      return;
    }

    issues.forEach(issue => {
      const row = document.createElement('div');
      row.className = 'issue-item';

      const content = document.createElement('div');
      content.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;';

      const top = document.createElement('div');
      top.style.cssText = 'display:flex;align-items:flex-start;gap:7px;';
      const num = document.createElement('span');
      num.className = 'issue-num';
      num.textContent = `#${issue.number}`;
      const titleLink = document.createElement('a');
      titleLink.href = issue.html_url;
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      titleLink.className = 'issue-title';
      titleLink.style.cssText = 'color:inherit;text-decoration:none;word-break:break-word;';
      titleLink.textContent = issue.title || '(no title)';
      top.appendChild(num);
      top.appendChild(titleLink);
      content.appendChild(top);

      const meta = document.createElement('div');
      meta.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
      meta.innerHTML = `<span class="label-chip" style="border-color:#888;background:#f4f4f4;color:#555;">${escapeHtml(issue.state)}</span>`;

      const projectStatuses = projectStatusMap.get(issue.number) || [];
      projectStatuses.forEach(item => {
        const chip = document.createElement('span');
        chip.className = 'label-chip';
        chip.style.cssText = 'border-color:#1f6feb66;background:#1f6feb14;color:#1f6feb;';
        chip.textContent = item.statusName;
        meta.appendChild(chip);
      });

      (issue.labels || []).forEach(label => {
        const color = label.color || '999999';
        const chip = document.createElement('span');
        chip.className = 'label-chip';
        chip.style.background = `#${color}2a`;
        chip.style.color = '#111';
        chip.style.borderColor = `#${color}aa`;
        chip.textContent = label.name || '';
        meta.appendChild(chip);
      });
      content.appendChild(meta);

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';

      const editBtn = document.createElement('button');
      editBtn.className = 'quick-memo-btn';
      editBtn.style.cssText = 'padding:5px 9px;font-size:0.72rem;';
      editBtn.textContent = '編集';
      editBtn.addEventListener('click', () => startIssueEdit(issue.number));

      const closeBtn = document.createElement('button');
      closeBtn.className = 'issue-close-btn';
      closeBtn.textContent = '×';
      closeBtn.title = 'クローズ';
      closeBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        closeIssueFromPanel(issue.number, row);
      });

      actions.appendChild(editBtn);
      actions.appendChild(closeBtn);
      row.appendChild(content);
      row.appendChild(actions);
      listEl.appendChild(row);
    });

    const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    statusEl.textContent = `${issues.length}件 · ${now}`;
  } catch {
    statusEl.textContent = 'ネットワークエラー';
    listEl.innerHTML = '<p style="font-size:0.8rem;color:#cf222e;">ネットワークエラー</p>';
  }
}

function clearIssueCreateForm() {
  const titleEl = document.getElementById('issue-create-title');
  const bodyEl = document.getElementById('issue-create-body');
  const labelsEl = document.getElementById('issue-create-labels');
  if (titleEl) titleEl.value = '';
  if (bodyEl) bodyEl.value = '';
  if (labelsEl) labelsEl.value = '';
}

async function createIssueFromPanel() {
  const token = getToken();
  const repo = getRepo();
  const statusEl = document.getElementById('issue-board-status');
  const titleEl = document.getElementById('issue-create-title');
  const bodyEl = document.getElementById('issue-create-body');
  const labelsEl = document.getElementById('issue-create-labels');
  if (!statusEl || !titleEl || !bodyEl || !labelsEl) return;

  const title = titleEl.value.trim();
  if (!title) {
    statusEl.textContent = 'タイトルは必須です';
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
        body: bodyEl.value,
        labels: parseIssueLabels(labelsEl.value),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      statusEl.textContent = `作成失敗: ${err.message || res.status}`;
      return;
    }

    clearIssueCreateForm();
    statusEl.textContent = '✅ 作成しました';
    await fetchIssueBoard();
    await fetchTaskWidget();
  } catch {
    statusEl.textContent = '作成時にネットワークエラー';
  }
}

function startIssueEdit(issueNumber) {
  const issue = issuePanelCache.find(item => item.number === issueNumber);
  if (!issue) return;

  const boxEl = document.getElementById('issue-update-box');
  const numEl = document.getElementById('issue-update-number');
  const titleEl = document.getElementById('issue-update-title');
  const bodyEl = document.getElementById('issue-update-body');
  const labelsEl = document.getElementById('issue-update-labels');
  const stateEl = document.getElementById('issue-update-state');
  if (!boxEl || !numEl || !titleEl || !bodyEl || !labelsEl || !stateEl) return;

  boxEl.classList.remove('is-hidden');
  numEl.value = `#${issue.number}`;
  numEl.dataset.issueNumber = String(issue.number);
  titleEl.value = issue.title || '';
  bodyEl.value = issue.body || '';
  labelsEl.value = (issue.labels || []).map(label => label.name || '').filter(Boolean).join(', ');
  stateEl.value = issue.state === 'closed' ? 'closed' : 'open';
  boxEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelIssueEdit() {
  const boxEl = document.getElementById('issue-update-box');
  const numEl = document.getElementById('issue-update-number');
  if (!boxEl || !numEl) return;
  boxEl.classList.add('is-hidden');
  numEl.value = '';
  numEl.dataset.issueNumber = '';
}

async function updateIssueFromPanel() {
  const token = getToken();
  const repo = getRepo();
  const statusEl = document.getElementById('issue-board-status');
  const numEl = document.getElementById('issue-update-number');
  const titleEl = document.getElementById('issue-update-title');
  const bodyEl = document.getElementById('issue-update-body');
  const labelsEl = document.getElementById('issue-update-labels');
  const stateEl = document.getElementById('issue-update-state');

  if (!statusEl || !numEl || !titleEl || !bodyEl || !labelsEl || !stateEl) return;
  const issueNumber = Number(numEl.dataset.issueNumber || '0');
  if (!issueNumber) {
    statusEl.textContent = '更新対象を選択してください';
    return;
  }
  if (!token || !repo) {
    statusEl.textContent = 'PAT/リポジトリ未設定';
    return;
  }

  const title = titleEl.value.trim();
  if (!title) {
    statusEl.textContent = 'タイトルは必須です';
    return;
  }

  statusEl.textContent = `#${issueNumber} 更新中...`;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body: bodyEl.value,
        labels: parseIssueLabels(labelsEl.value),
        state: stateEl.value === 'closed' ? 'closed' : 'open',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      statusEl.textContent = `更新失敗: ${err.message || res.status}`;
      return;
    }

    statusEl.textContent = `✅ #${issueNumber} を更新しました`;
    cancelIssueEdit();
    await fetchIssueBoard();
    await fetchTaskWidget();
  } catch {
    statusEl.textContent = '更新時にネットワークエラー';
  }
}

window.fetchIssueBoard = fetchIssueBoard;
window.createIssueFromPanel = createIssueFromPanel;
window.clearIssueCreateForm = clearIssueCreateForm;
window.startIssueEdit = startIssueEdit;
window.cancelIssueEdit = cancelIssueEdit;
window.updateIssueFromPanel = updateIssueFromPanel;
