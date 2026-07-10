// =====================
// Analytics Band (Progress Chart)
// =====================

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

  const { done, total } = getDailyChecklistProgress();
  const ratio = total === 0 ? 0 : Math.round((done / total) * 100);

  fillEl.style.width = `${ratio}%`;
  textEl.textContent = `${done} / ${total} DONE (${ratio}%)`;
}

window.updateAnalyticsProgressChart = updateAnalyticsProgressChart;
window.addEventListener('progress-data-changed', updateAnalyticsProgressChart);
window.addEventListener('DOMContentLoaded', updateAnalyticsProgressChart);
