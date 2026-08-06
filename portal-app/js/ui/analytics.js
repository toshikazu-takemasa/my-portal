// =====================
// 進捗表示（今日タブの進捗バーと件数）
// analytics-band / ヘッダーのリング / 一言カードは廃止したが、計算ロジックは流用している。
// =====================

function getDailyChecklistProgress() {
  const items = document.querySelectorAll('#daily-checklist-list-right .check-item');
  const total = items.length;
  const done  = Array.from(items).filter(el => el.classList.contains('done')).length;
  return { done, total };
}

function updateAnalyticsProgressChart() {
  const { done, total } = getDailyChecklistProgress();
  const ratio = total === 0 ? 0 : done / total;

  const fillEl = document.getElementById('analytics-progress-fill');
  if (fillEl) fillEl.style.width = `${Math.round(ratio * 100)}%`;

  const countEl = document.getElementById('checklist-count');
  if (countEl) countEl.textContent = `${done} / ${total}`;
}

window.updateAnalyticsProgressChart = updateAnalyticsProgressChart;
window.addEventListener('progress-data-changed', updateAnalyticsProgressChart);
window.addEventListener('DOMContentLoaded', updateAnalyticsProgressChart);
