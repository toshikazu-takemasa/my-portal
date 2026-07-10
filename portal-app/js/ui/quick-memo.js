// =====================
// クイックメモ
// =====================

function getDailyMemoKey() {
  const keyDate = (typeof todayISO !== 'undefined' && todayISO)
    ? todayISO
    : new Date().toISOString().slice(0, 10);
  return `daily-memo_${keyDate}`;
}

function loadQuickMemo() {
  const input = document.getElementById('quick-memo-input');
  if (!input) return;
  input.value = localStorage.getItem(getDailyMemoKey()) || '';
}

function saveQuickMemo() {
  const input = document.getElementById('quick-memo-input');
  const statusEl = document.getElementById('quick-memo-status');
  if (!input || !statusEl) return;

  const value = input.value || '';
  localStorage.setItem(getDailyMemoKey(), value);
  statusEl.style.color = '#1a7f37';
  statusEl.textContent = '✅ メモを保存しました';
}

function clearQuickMemo() {
  const input = document.getElementById('quick-memo-input');
  const statusEl = document.getElementById('quick-memo-status');
  if (!input || !statusEl) return;

  input.value = '';
  localStorage.removeItem(getDailyMemoKey());
  statusEl.style.color = '#8e8e8e';
  statusEl.textContent = 'メモをクリアしました';
}

document.addEventListener('DOMContentLoaded', () => {
  loadQuickMemo();

  const input = document.getElementById('quick-memo-input');
  const statusEl = document.getElementById('quick-memo-status');
  if (!input || !statusEl) return;

  input.addEventListener('input', () => {
    statusEl.style.color = '#8e8e8e';
    statusEl.textContent = '未保存の変更があります';
  });
});
