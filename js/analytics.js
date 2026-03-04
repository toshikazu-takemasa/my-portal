// =====================
// Analytics Band (Progress Chart)
// =====================

function getTaskWidgetProgress() {
  const taskDateKey = (typeof todayISO !== 'undefined' && todayISO)
    ? todayISO
    : new Date().toISOString().slice(0, 10);

  const stateKey = `task-widget-checked_${taskDateKey}`;
  const snapshotKey = `task-widget-snapshot_${taskDateKey}`;

  let checkedState = {};
  let snapshot = [];

  try {
    const parsedState = JSON.parse(localStorage.getItem(stateKey) || '{}');
    checkedState = parsedState && typeof parsedState === 'object' ? parsedState : {};
  } catch {
    checkedState = {};
  }

  try {
    const parsedSnapshot = JSON.parse(localStorage.getItem(snapshotKey) || '[]');
    snapshot = Array.isArray(parsedSnapshot) ? parsedSnapshot : [];
  } catch {
    snapshot = [];
  }

  const total = snapshot.length;
  const done = snapshot.filter(item => checkedState[String(item.id)] === true).length;
  return { done, total };
}

function getDailyChecklistProgress() {
  const checks = document.querySelectorAll('#daily-checklist-list-right input[type="checkbox"]');
  const total = checks.length;
  const done = Array.from(checks).filter(check => check.checked).length;
  return { done, total };
}

function updateAnalyticsProgressChart() {
  const fillEl = document.getElementById('analytics-progress-fill');
  const textEl = document.getElementById('analytics-progress-text');
  if (!fillEl || !textEl) return;

  const daily = getDailyChecklistProgress();
  const task = getTaskWidgetProgress();

  const total = daily.total + task.total;
  const done = daily.done + task.done;
  const ratio = total === 0 ? 0 : Math.round((done / total) * 100);

  fillEl.style.width = `${ratio}%`;
  textEl.textContent = `${done} / ${total} DONE (${ratio}%)`;
}

window.updateAnalyticsProgressChart = updateAnalyticsProgressChart;
window.addEventListener('progress-data-changed', updateAnalyticsProgressChart);
window.addEventListener('DOMContentLoaded', updateAnalyticsProgressChart);
