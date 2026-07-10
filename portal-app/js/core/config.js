// =====================
// 定数・リポジトリ設定
// =====================

function getRepo()   { return (window.PORTAL_CONFIG_INLINE && window.PORTAL_CONFIG_INLINE.repo) || ''; }
function getBranch() { return (window.PORTAL_CONFIG_INLINE && window.PORTAL_CONFIG_INLINE.branch) || 'main'; }

window.getRepo = getRepo;
window.getBranch = getBranch;

// =====================
// 日付初期化（JST）
// =====================
function getJstTodayISO() {
  const jst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, '0')}-${String(jst.getDate()).padStart(2, '0')}`;
}
window.getJstTodayISO = getJstTodayISO;

const jstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
const dateStr = jstNow.toLocaleDateString('ja-JP', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Tokyo'
});
const todayEl = document.getElementById('today');
if (todayEl) todayEl.textContent = dateStr;

// --- localStorage キー（JST日付ベース） ---
let todayISO = getJstTodayISO();
let todayKey = 'checklist_' + todayISO;

window.todayISO = todayISO;
window.todayKey = todayKey;

// 古いキーを削除
Object.keys(localStorage)
  .filter(k => k.startsWith('checklist_') && k !== todayKey)
  .forEach(k => localStorage.removeItem(k));
