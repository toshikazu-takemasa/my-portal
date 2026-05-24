// =====================
// 日々のチェックリスト
// =====================
let dailyTasks = [];

function getDailyCheckDateKey() {
  return 'daily-checklist-date';
}

function resetDailyChecklistIfNewDay() {
  const today = typeof todayISO !== 'undefined' ? todayISO : new Date().toISOString().slice(0, 10);
  const last  = localStorage.getItem(getDailyCheckDateKey());
  if (last === today) return;

  // 日付が変わったら全チェック状態をクリア
  Object.keys(localStorage)
    .filter(k => k.startsWith('daily-task-'))
    .forEach(k => localStorage.removeItem(k));

  localStorage.setItem(getDailyCheckDateKey(), today);
}

async function loadDailyTasks () {
  resetDailyChecklistIfNewDay();

  const listEl = document.getElementById('daily-checklist-list-right');
  try {
    if (!dailyTasks.length) {
      let config = null;
      if (window.PORTAL_CONFIG_INLINE) {
        config = window.PORTAL_CONFIG_INLINE;
      } else {
        const res = await fetch('./data/portal-config.json');
        if (res.ok) config = await res.json();
      }
      if (config) {
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

window.addEventListener('portal-config-loaded', () => {
  if (typeof portalConfig !== 'undefined' && portalConfig?.dailyTasks) {
    dailyTasks = portalConfig.dailyTasks;
    renderDailyChecklist();
  }
});

function renderDailyChecklist () {
  const listEl = document.getElementById('daily-checklist-list-right');
  if (!listEl || dailyTasks.length === 0) return;

  listEl.innerHTML = '';

  dailyTasks.forEach(task => {
    // work-vault形式 (label) と my-portal形式 (title) の両方に対応
    const title   = ((task.label || task.title) || '').trim();
    const key     = `daily-task-${title}`;
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
    text.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;';

    const titleSpan = document.createElement('span');

    // links[] 形式（work-vault）
    if (Array.isArray(task.links) && task.links.length > 0) {
      titleSpan.textContent = title;
      text.appendChild(titleSpan);

      const linksWrap = document.createElement('span');
      linksWrap.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
      task.links.forEach(l => {
        const a = document.createElement('a');
        a.href = l.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = l.title || l.domain || '🔗';
        a.style.cssText = 'font-size:0.7rem;padding:1px 6px;border-radius:4px;background:var(--section-bg2,#f6f8fa);color:var(--accent,#0969da);text-decoration:none;white-space:nowrap;';
        linksWrap.appendChild(a);
      });
      text.appendChild(linksWrap);

    // url 形式（従来の my-portal）
    } else if (task.url) {
      const a = document.createElement('a');
      a.href = task.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.cssText = 'color:inherit;text-decoration:inherit;';
      a.textContent = title;
      text.appendChild(a);

    } else {
      titleSpan.textContent = title;
      text.appendChild(titleSpan);
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
}

function resetDailyChecklist () {
  dailyTasks.forEach(task => {
    const title = ((task.label || task.title) || '').trim();
    localStorage.removeItem(`daily-task-${title}`);
  });
  renderDailyChecklist();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { loadDailyTasks(); });
} else {
  loadDailyTasks();
}

window.loadDailyTasks    = loadDailyTasks;
window.resetDailyChecklist = resetDailyChecklist;
window.renderDailyChecklist = renderDailyChecklist;
