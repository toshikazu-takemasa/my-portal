// =====================
// 本日のタスク チェックリスト
// =====================
const checkboxes = document.querySelectorAll('.task-check');

const saved = JSON.parse(localStorage.getItem(todayKey) || '{}');
checkboxes.forEach(cb => {
  cb.checked = !!saved[cb.dataset.id];
  cb.closest('.check-item').classList.toggle('done', cb.checked);
});

function save() {
  const state = {};
  checkboxes.forEach(cb => { state[cb.dataset.id] = cb.checked; });
  localStorage.setItem(todayKey, JSON.stringify(state));
  updateProgress();
}

function updateProgress() {
  const total = checkboxes.length;
  const done  = Array.from(checkboxes).filter(c => c.checked).length;
  document.getElementById('progress-fill').style.width = (done / total * 100) + '%';
  document.getElementById('progress-text').textContent = done + ' / ' + total;
  document.getElementById('reset-badge').textContent   = done === total ? '✅ 完了' : '';
}

checkboxes.forEach(cb => {
  cb.addEventListener('change', () => {
    cb.closest('.check-item').classList.toggle('done', cb.checked);
    save();
  });
});

updateProgress();

// =====================
// 日の3つの柱（アコーディオン）
// =====================
const pillarChecks = document.querySelectorAll('.pillar-check');
let pillarsOpen = false;

const savedPillars = JSON.parse(localStorage.getItem(PILLARS_KEY) || '{}');
pillarChecks.forEach(cb => {
  cb.checked = !!savedPillars[cb.dataset.pid];
  cb.closest('.check-item').classList.toggle('done', cb.checked);
});

function savePillars() {
  const state = {};
  pillarChecks.forEach(cb => { state[cb.dataset.pid] = cb.checked; });
  localStorage.setItem(PILLARS_KEY, JSON.stringify(state));
  updatePillarsChip();
}

function updatePillarsChip() {
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

pillarChecks.forEach(cb => {
  cb.addEventListener('change', () => {
    cb.closest('.check-item').classList.toggle('done', cb.checked);
    savePillars();
  });
});

updatePillarsChip();
