// =====================
// 日々のチェックリスト
// =====================
let dailyTasks = [];

async function loadDailyTasks() {
  try {
    const res = await fetch('./data/portal-config.json');
    const config = await res.json();
    dailyTasks = config.dailyTasks || [];
    renderDailyChecklist();
  } catch (e) {
    console.warn('Failed to load daily tasks:', e);
  }
}

function renderDailyChecklist() {
  const listEl = document.getElementById('daily-checklist-list');
  if (!listEl || dailyTasks.length === 0) return;

  listEl.innerHTML = '';

  dailyTasks.forEach((task, idx) => {
    const key = `daily-task-${task.id}`;
    const isChecked = localStorage.getItem(key) === 'true';

    const div = document.createElement('div');
    div.className = 'daily-task-item';
    div.style.cssText = 'display:flex;align-items:center;padding:8px;border-radius:6px;cursor:pointer;transition:background 0.15s;';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isChecked;
    checkbox.style.cssText = 'width:16px;height:16px;margin-right:10px;cursor:pointer;';

    const label = document.createElement('span');
    label.style.cssText = `flex:1;font-size:0.85rem;color:${isChecked ? '#aaa' : '#333'};${isChecked ? 'text-decoration:line-through;' : ''}`;

    if (task.url) {
      const link = document.createElement('a');
      link.href = task.url;
      link.target = '_blank';
      link.style.cssText = 'color:inherit;text-decoration:inherit;';
      link.textContent = task.title;
      label.appendChild(link);
    } else {
      label.textContent = task.title;
    }

    checkbox.addEventListener('change', (e) => {
      localStorage.setItem(key, e.target.checked.toString());
      label.style.color = e.target.checked ? '#aaa' : '#333';
      label.style.textDecoration = e.target.checked ? 'line-through' : 'none';
    });

    div.appendChild(checkbox);
    div.appendChild(label);

    div.addEventListener('mouseenter', () => {
      div.style.background = '#f5f5f5';
    });
    div.addEventListener('mouseleave', () => {
      div.style.background = 'transparent';
    });

    listEl.appendChild(div);
  });
}

// ページ読み込み時に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadDailyTasks();
  });
} else {
  // スクリプトが </body> の直前で読み込まれる場合、DOMContentLoaded は既に発火している
  loadDailyTasks();
}
