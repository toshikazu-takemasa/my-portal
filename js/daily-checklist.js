// =====================
// 日々のチェックリスト
// =====================
let dailyTasks = [];

async function loadDailyTasks() {
  const listEl = document.getElementById('daily-checklist-list-right');
  try {
    // まず設定画面で保存した内容（localStorage）を優先
    const stored = localStorage.getItem('daily_tasks_config_v1');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        dailyTasks = parsed;
      }
    }
    // なければ portal-config.json
    if (!dailyTasks.length) {
      const res = await fetch('./data/portal-config.json');
      if (res.ok) {
        const config = await res.json();
        dailyTasks = config.dailyTasks || [];
      } else if (typeof portalConfig !== 'undefined' && portalConfig?.dailyTasks) {
        dailyTasks = portalConfig.dailyTasks;
      }
    }
    if (dailyTasks.length === 0 && listEl) {
      listEl.innerHTML = '<p style="font-size:0.75rem;color:#888;">タスクが設定されていません</p>';
    } else {
      renderDailyChecklist();
    }
  } catch (e) {
    console.warn('Failed to load daily tasks:', e);
    if (listEl) {
      listEl.innerHTML = '<p style="font-size:0.75rem;color:#cf222e;">読み込み失敗</p>';
    }
  }
}

// 共通の構成読み込みイベントに同期
window.addEventListener('portal-config-loaded', () => {
  // 設定画面で保存した内容があればそちらを優先
  const stored = localStorage.getItem('daily_tasks_config_v1');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        dailyTasks = parsed;
        renderDailyChecklist();
        return;
      }
    } catch {}
  }
  if (typeof portalConfig !== 'undefined' && portalConfig?.dailyTasks) {
    dailyTasks = portalConfig.dailyTasks;
    renderDailyChecklist();
  }
});

function renderDailyChecklist() {
  // 右側のみに表示（左側は削除）
  const listEls = [
    document.getElementById('daily-checklist-list-right')
  ];
  
  listEls.forEach(listEl => {
    if (!listEl || dailyTasks.length === 0) return;

    listEl.innerHTML = '';

    dailyTasks.forEach(task => {
      // タイトルをIDとして使う
      const id = task.title;
      const key = `daily-task-${id}`;
      const isChecked = localStorage.getItem(key) === 'true';

      const row = document.createElement('label');
      row.className = 'check-item';
      row.classList.toggle('done', isChecked);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isChecked;
      checkbox.className = 'daily-task-check';

      const text = document.createElement('span');
      text.className = 'check-label';

      if (task.url) {
        const link = document.createElement('a');
        link.href = task.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = 'color:inherit;text-decoration:inherit;';
        link.textContent = task.title;
        text.appendChild(link);
      } else {
        text.textContent = task.title;
      }

      checkbox.addEventListener('change', (e) => {
        localStorage.setItem(key, e.target.checked.toString());
        row.classList.toggle('done', e.target.checked);
        window.dispatchEvent(new Event('progress-data-changed'));
      });

      row.appendChild(checkbox);
      row.appendChild(text);

      listEl.appendChild(row);
    });

    window.dispatchEvent(new Event('progress-data-changed'));
  });
}

function resetDailyChecklist() {
  dailyTasks.forEach(task => {
    const id = task.title;
    localStorage.removeItem(`daily-task-${id}`);
  });
  renderDailyChecklist();
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
