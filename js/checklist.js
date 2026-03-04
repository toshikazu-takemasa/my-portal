// =====================
// 本日のタスク チェックリスト
// =====================
var pillarsOpen = false;

const checkboxes = document.querySelectorAll('.task-check');

const taskStorageKey = (typeof todayKey !== 'undefined' && todayKey) ? todayKey : null;
const saved = taskStorageKey ? JSON.parse(localStorage.getItem(taskStorageKey) || '{}') : {};

checkboxes.forEach(cb => {
  cb.checked = !!saved[cb.dataset.id];
  cb.closest('.check-item').classList.toggle('done', cb.checked);
});

function save() {
  if (!taskStorageKey) return;
  const state = {};
  checkboxes.forEach(cb => { state[cb.dataset.id] = cb.checked; });
  localStorage.setItem(taskStorageKey, JSON.stringify(state));
  updateProgress();
}

function updateProgress() {
  const total = checkboxes.length;
  const done  = Array.from(checkboxes).filter(c => c.checked).length;
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const resetBadge = document.getElementById('reset-badge');
  if (progressFill) {
    const ratio = total === 0 ? 0 : (done / total * 100);
    progressFill.style.width = ratio + '%';
  }
  if (progressText) progressText.textContent = done + ' / ' + total;
  if (resetBadge) resetBadge.textContent = total > 0 && done === total ? '✅ 完了' : '';
}

checkboxes.forEach(cb => {
  cb.addEventListener('change', () => {
    cb.closest('.check-item').classList.toggle('done', cb.checked);
    save();
  });
});

updateProgress();

// =====================
// 確認事項（アコーディオン）
// =====================
const CHECKLIST_PILLARS_CONFIG_KEY = 'pillars_config_v1';

const DEFAULT_PILLARS = [
  { id: 'p1', title: '扉は常に気をつける' },
  { id: 'p2', title: 'すり足注意' },
  { id: 'p3', title: 'こたつの電気' },
  { id: 'p4', title: '昨日の食器' },
  { id: 'p5', title: '弁当' },
  { id: 'p6', title: 'パン' },
  { id: 'p7', title: '着替え' },
  { id: 'p8', title: '明日の服' },
  { id: 'p9', title: 'エアコン' },
  { id: 'p10', title: 'スマホしまう' }
];

let pillars = DEFAULT_PILLARS.map(item => ({ ...item }));

function getPillarChecks() {
  return document.querySelectorAll('.pillar-check');
}

function renderPillars() {
  const list = document.getElementById('pillars-list');
  if (!list) return;

  list.innerHTML = '';
  pillars.forEach(item => {
    const label = document.createElement('label');
    label.className = 'check-item';
    label.innerHTML =
      `<input type="checkbox" class="pillar-check" data-pid="${escapeHtml(item.id)}">` +
      `<span class="check-label">${escapeHtml(item.title)}</span>`;
    list.appendChild(label);
  });
}

function bindPillarCheckEvents() {
  const pillarChecks = getPillarChecks();
  pillarChecks.forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.check-item').classList.toggle('done', cb.checked);
      savePillars();
    });
  });
}

function applySavedPillarsState() {
  const savedPillars = JSON.parse(localStorage.getItem(PILLARS_KEY) || '{}');
  const pillarChecks = getPillarChecks();
  pillarChecks.forEach(cb => {
    cb.checked = !!savedPillars[cb.dataset.pid];
    cb.closest('.check-item').classList.toggle('done', cb.checked);
  });
}

function setPillars(nextPillars) {
  if (!Array.isArray(nextPillars) || nextPillars.length === 0) return;
  pillars = nextPillars.map((item, idx) => ({
    id: (item.id || `p${idx + 1}`).toString(),
    title: (item.title || '').toString().trim()
  })).filter(item => item.title);
  if (pillars.length === 0) pillars = DEFAULT_PILLARS.map(item => ({ ...item }));

  renderPillars();
  applySavedPillarsState();
  bindPillarCheckEvents();
  updatePillarsChip();
}

async function loadPillarsConfig() {
  const stored = localStorage.getItem(CHECKLIST_PILLARS_CONFIG_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) setPillars(parsed);
    } catch {}
  } else {
    setPillars(DEFAULT_PILLARS);
  }

  try {
    const res = await fetch('./data/portal-config.json');
    if (!res.ok) return;
    const config = await res.json();
    if (Array.isArray(config.pillars) && config.pillars.length > 0) {
      localStorage.setItem(CHECKLIST_PILLARS_CONFIG_KEY, JSON.stringify(config.pillars));
      setPillars(config.pillars);
    }
  } catch (e) {
    console.warn('Failed to load pillars config:', e);
  }
}

window.addEventListener('portal-config-loaded', () => {
  const stored = localStorage.getItem(CHECKLIST_PILLARS_CONFIG_KEY);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) setPillars(parsed);
  } catch {}
});

function savePillars() {
  const state = {};
  const pillarChecks = getPillarChecks();
  pillarChecks.forEach(cb => { state[cb.dataset.pid] = cb.checked; });
  localStorage.setItem(PILLARS_KEY, JSON.stringify(state));
  updatePillarsChip();
}

function updatePillarsChip() {
  const pillarChecks = getPillarChecks();
  const total = pillarChecks.length;
  const done  = Array.from(pillarChecks).filter(c => c.checked).length;
  const chip  = document.getElementById('pillars-chip');
  chip.textContent = done === total ? '✅ 完了' : done + ' / ' + total;
  chip.style.background = done === total ? '#e6f4ea' : '#f0f6ff';
  chip.style.color       = done === total ? '#1a7f37' : '#0969da';
}

function togglePillars() {
  pillarsOpen = !pillarsOpen;
  document.getElementById('pillars-body').classList.toggle('open', pillarsOpen);
  document.getElementById('pillars-header').classList.toggle('open', pillarsOpen);
}

loadPillarsConfig();
