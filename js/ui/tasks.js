// =====================
// タスクウィジェット（ファイルベース: vault/tasks.json）
// =====================

function getTaskCheckedKey() {
  const today = typeof todayISO !== 'undefined' ? todayISO : new Date().toISOString().slice(0, 10);
  return `task-widget-checked_${today}`;
}

function getTaskCheckedState() {
  try {
    const v = JSON.parse(localStorage.getItem(getTaskCheckedKey()) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}

function saveTaskCheckedState(state) {
  localStorage.setItem(getTaskCheckedKey(), JSON.stringify(state || {}));
}

async function fetchTaskWidget() {
  const listEl   = document.getElementById('task-widget-list');
  const statusEl = document.getElementById('task-widget-status');
  if (!listEl || !statusEl) return;

  statusEl.textContent = '読み込み中…';
  listEl.innerHTML = '';

  const filterEl = document.getElementById('task-filter-status');
  const searchEl = document.getElementById('task-search-input');
  const filterVal   = filterEl?.value || 'active';
  const searchQuery = (searchEl?.value || '').trim().toLowerCase();

  try {
    let tasks = await TaskRepository.getAllTasks();

    if (filterVal === 'active') {
      tasks = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
    } else if (filterVal === 'done') {
      tasks = tasks.filter(t => t.status === 'done');
    }

    if (searchQuery) {
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(searchQuery) ||
        (t.description || '').toLowerCase().includes(searchQuery)
      );
    }

    if (tasks.length === 0) {
      listEl.innerHTML = '<p style="font-size:0.78rem;color:#aaa;padding:8px 0;">タスクはありません</p>';
      statusEl.textContent = '0件';
      return;
    }

    const checkedState = getTaskCheckedState();
    const priorityColors = { P1: '#cf222e', P2: '#1f6feb', P3: '#6e7781' };

    tasks.forEach(task => {
      const row = document.createElement('div');
      row.className = 'issue-item task-widget-item';

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = checkedState[task.id] === true;
      check.style.cssText = 'width:15px;height:15px;margin-top:2px;accent-color:var(--accent);cursor:pointer;flex-shrink:0;';
      check.addEventListener('change', () => {
        const state = getTaskCheckedState();
        state[task.id] = check.checked;
        saveTaskCheckedState(state);
        window.dispatchEvent(new Event('progress-data-changed'));
      });

      const content = document.createElement('div');
      content.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;flex:1;min-width:0;';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'issue-title';
      titleSpan.style.cssText = 'flex:1;min-width:0;word-break:break-word;';
      titleSpan.textContent = task.title;
      content.appendChild(titleSpan);

      const chips = document.createElement('span');
      chips.className = 'issue-labels';
      const pColor = priorityColors[task.priority] || '#888';
      let chipsHtml = `<span class="label-chip" style="background:${pColor}22;color:${pColor};border-color:${pColor}88;">${escapeHtml(task.priority || 'P2')}</span>`;
      if (task.status === 'in-progress') {
        chipsHtml += `<span class="label-chip" style="background:#2da44e22;color:#2da44e;border-color:#2da44e88;">進行中</span>`;
      }
      (task.labels || []).forEach(l => {
        chipsHtml += `<span class="label-chip">${escapeHtml(l)}</span>`;
      });
      chips.innerHTML = chipsHtml;
      content.appendChild(chips);

      const doneBtn = document.createElement('button');
      doneBtn.className = 'issue-close-btn';
      doneBtn.textContent = '✓';
      doneBtn.title = '完了にする';
      doneBtn.style.cssText = 'color:#2da44e;border-color:#2da44e;';
      doneBtn.addEventListener('click', async () => {
        statusEl.textContent = '更新中…';
        try {
          await TaskRepository.updateTask(task.id, { status: 'done' });
          const state = getTaskCheckedState();
          delete state[task.id];
          saveTaskCheckedState(state);
          await fetchTaskWidget();
        } catch (e) {
          statusEl.textContent = `失敗: ${e.message}`;
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'issue-close-btn';
      deleteBtn.textContent = '×';
      deleteBtn.title = '削除';
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`「${task.title}」を削除しますか？`)) return;
        statusEl.textContent = '削除中…';
        try {
          await TaskRepository.deleteTask(task.id);
          await fetchTaskWidget();
        } catch (e) {
          statusEl.textContent = `失敗: ${e.message}`;
        }
      });

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;align-items:center;gap:5px;flex-shrink:0;';
      actions.appendChild(doneBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(check);
      row.appendChild(content);
      row.appendChild(actions);
      listEl.appendChild(row);
    });

    const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    statusEl.textContent = `${tasks.length}件 · ${now}`;
    window.dispatchEvent(new Event('progress-data-changed'));
  } catch (e) {
    statusEl.textContent = `エラー: ${e.message}`;
  }
}

async function createTaskFromWidget() {
  const titleEl    = document.getElementById('task-create-title');
  const priorityEl = document.getElementById('task-create-priority');
  const statusEl   = document.getElementById('task-widget-status');
  if (!titleEl || !statusEl) return;

  const title = (titleEl.value || '').trim();
  if (!title) {
    statusEl.textContent = 'タイトルを入力してください';
    return;
  }

  statusEl.textContent = '作成中…';
  try {
    await TaskRepository.addTask({ title, priority: priorityEl?.value || 'P2' });
    titleEl.value = '';
    statusEl.textContent = '✅ 追加しました';
    await fetchTaskWidget();
  } catch (e) {
    statusEl.textContent = `失敗: ${e.message}`;
  }
}

window.fetchTaskWidget = fetchTaskWidget;
window.createTaskFromWidget = createTaskFromWidget;
