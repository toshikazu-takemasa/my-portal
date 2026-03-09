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
  // 右側のみに表示（左側は削除）
  const listEls = [
    document.getElementById('daily-checklist-list-right')
  ];

  const activeLabelColor = 'var(--text)';
  const doneLabelColor = 'var(--text-sub)';
  const itemHoverBg = 'var(--accent-light)';
  const itemBaseBg = 'transparent';
  
  listEls.forEach(listEl => {
    if (!listEl || dailyTasks.length === 0) return;

    listEl.innerHTML = '';

    dailyTasks.forEach((task, idx) => {
      const key = `daily-task-${task.id}`;
      const isChecked = localStorage.getItem(key) === 'true';

      const div = document.createElement('div');
      div.className = 'daily-task-item';
      div.style.cssText = `display:flex;align-items:center;padding:8px;border-radius:6px;cursor:pointer;transition:background 0.15s;background:${itemBaseBg};`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isChecked;
      checkbox.style.cssText = 'width:16px;height:16px;margin-right:10px;cursor:pointer;accent-color:var(--accent);';

      const label = document.createElement('span');
      label.style.cssText = `flex:1;font-size:0.85rem;color:${isChecked ? doneLabelColor : activeLabelColor};${isChecked ? 'text-decoration:line-through;' : ''}`;

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
        label.style.color = e.target.checked ? doneLabelColor : activeLabelColor;
        label.style.textDecoration = e.target.checked ? 'line-through' : 'none';
        window.dispatchEvent(new Event('progress-data-changed'));
      });

      div.appendChild(checkbox);
      div.appendChild(label);

      div.addEventListener('mouseenter', () => {
        div.style.background = itemHoverBg;
      });
      div.addEventListener('mouseleave', () => {
        div.style.background = itemBaseBg;
      });

      listEl.appendChild(div);
    });

    window.dispatchEvent(new Event('progress-data-changed'));
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
