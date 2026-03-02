// =====================
// 定数・リポジトリ設定
// =====================

// リポジトリ・ブランチは localStorage から読み込む（設定画面で変更可能）
const REPO_KEY    = 'github_repo';
const BRANCH_KEY  = 'github_branch';

function getRepo()   { return localStorage.getItem(REPO_KEY)   || ''; }
function getBranch() { return localStorage.getItem(BRANCH_KEY) || 'main'; }

// =====================
// 日付初期化（JST）
// =====================
const jstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
const dateStr = jstNow.toLocaleDateString('ja-JP', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Tokyo'
});
document.getElementById('today').textContent = dateStr;

// --- localStorage キー（JST日付ベース） ---
const todayISO   = jstNow.toISOString().slice(0, 10);
const todayKey   = 'checklist_' + todayISO;
const PILLARS_KEY = 'pillars_' + todayISO;

// 古いキーを削除
Object.keys(localStorage)
  .filter(k => (k.startsWith('checklist_') && k !== todayKey) ||
               (k.startsWith('pillars_')   && k !== PILLARS_KEY))
  .forEach(k => localStorage.removeItem(k));
