// =====================
// メモタブ（GitHub vault/task/memo.md・主題ごとのカード形式）
// memo.md を行頭 `## ` 単位でセクション分割し、1セクション = 1カードとして表示する。
// モバイル前提のUI: カードはアコーディオン（タップで展開して編集、閉じるとタイトル+プレビュー1行）。
// どのカードの「保存」からでも、画面上の全カードをまとめて memo.md にコミットする。
// 最初の `## ` より前の内容（preamble）は「冒頭メモ」カード（改名・削除不可）として扱う。
// =====================

let memoTabLoaded = false;
let memoRawMode   = false;
let memoDirty     = false;
let memoPreambleBuf = [];   // 空白のみ等でカード化されなかった preamble 行の温存用

function memoStatus(msg, color) {
  const el = document.getElementById('memo-tab-status');
  if (!el) return;
  el.style.color = color || 'var(--text-sub)';
  el.textContent = msg;
}

function markMemoDirty() {
  memoDirty = true;
  memoStatus('未保存の変更があります');
}

window.addEventListener('beforeunload', e => {
  if (memoDirty) { e.preventDefault(); e.returnValue = ''; }
});

// --- パース / シリアライズ（無編集ならバイト一致） ---
function parseMemoContent(content) {
  const preamble = [];
  const sections = [];
  let cur = null;
  for (const line of content.split('\n')) {
    const m = line.match(/^##\s+(.*)$/);
    if (m) {
      cur = { title: m[1].trim(), lines: [] };
      sections.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  return { preamble, sections };
}

function serializeMemoContent(preamble, sections) {
  const out = [...preamble];
  sections.forEach(s => {
    out.push(`## ${s.title}`);
    out.push(...s.lines);
  });
  return out.join('\n');
}

// --- 読み込み ---
async function loadMemoTab(force = false) {
  if (memoTabLoaded && !force) return;
  const container = document.getElementById('memo-tab-cards');
  if (!container) return;
  if (force && memoDirty && !confirm('未保存の変更があります。破棄して再読み込みしますか？')) return;

  memoStatus('読み込み中…');
  try {
    const content = await MemoRepository.load();
    const { preamble, sections } = parseMemoContent(content);
    renderMemoCards(preamble, sections);
    const textarea = document.getElementById('memo-tab-textarea');
    if (textarea) textarea.value = content;
    memoDirty = false;
    memoTabLoaded = true;
    memoStatus('');
  } catch (e) {
    if (e instanceof GitHubAuthError) {
      memoStatus('GitHub PAT が未設定です（設定タブから登録してください）', '#cf222e');
    } else {
      memoStatus(`読み込み失敗: ${e.message}`, '#cf222e');
    }
  }
}

// --- カード描画 ---
function renderMemoCards(preamble, sections) {
  const container = document.getElementById('memo-tab-cards');
  if (!container) return;
  container.innerHTML = '';
  memoPreambleBuf = [];

  if (preamble.join('\n').trim() !== '') {
    container.appendChild(buildMemoCard('冒頭メモ', preamble.join('\n'), { fixed: true }));
  } else {
    memoPreambleBuf = preamble;   // 空白のみの冒頭行はシリアライズ時に温存
  }

  sections.forEach(s => container.appendChild(buildMemoCard(s.title, s.lines.join('\n'), { fixed: false })));

  if (!container.children.length) {
    const empty = document.createElement('div');
    empty.className = 'memo-empty';
    empty.textContent = 'カードがありません。下の入力欄から主題（例: 読書メモ / ADR）を追加できます。';
    container.appendChild(empty);
  } else if (container.children.length === 1) {
    container.firstElementChild.classList.add('open');   // 1枚だけなら開いておく
  }
}

function memoPreviewText(body) {
  const first = body.split('\n').find(l => l.trim() !== '');
  return first ? first.trim() : '（空）';
}

function buildMemoCard(title, body, { fixed }) {
  const card = document.createElement('div');
  card.className = 'memo-card';
  if (fixed) card.dataset.fixed = '1';

  // ヘッダ（タップで開閉）
  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'memo-card-head';
  head.onclick = () => card.classList.toggle('open');

  const titleSpan = document.createElement('span');
  titleSpan.className = 'memo-card-title-text';
  titleSpan.textContent = title;

  const preview = document.createElement('span');
  preview.className = 'memo-card-preview';
  preview.textContent = memoPreviewText(body);

  const chev = document.createElement('span');
  chev.className = 'memo-card-chev';
  chev.textContent = '▸';

  head.appendChild(titleSpan);
  head.appendChild(preview);
  head.appendChild(chev);

  // 本体（展開時のみ表示）
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'memo-card-body';

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'memo-card-title-input';
  titleInput.value = title;
  if (fixed) {
    titleInput.readOnly = true;
    titleInput.title = 'memo.md の冒頭部分（見出しなし）';
  }
  titleInput.addEventListener('input', () => {
    titleSpan.textContent = titleInput.value.trim() || '無題';
    markMemoDirty();
  });

  const textarea = document.createElement('textarea');
  textarea.className = 'memo-card-text';
  textarea.value = body;
  textarea.placeholder = 'メモを記入…';
  textarea.rows = 5;
  const autoGrow = () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight + 2, 400) + 'px';
  };
  textarea.addEventListener('input', () => {
    preview.textContent = memoPreviewText(textarea.value);
    autoGrow();
    markMemoDirty();
  });
  head.addEventListener('click', autoGrow, { once: true });

  const actions = document.createElement('div');
  actions.className = 'memo-card-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'quick-memo-btn';
  saveBtn.textContent = '保存';
  saveBtn.onclick = () => saveMemoCards();
  actions.appendChild(saveBtn);

  if (!fixed) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'quick-memo-btn memo-card-del-btn';
    delBtn.textContent = '削除';
    delBtn.onclick = () => deleteMemoCard(card, titleInput.value.trim() || title);
    actions.appendChild(delBtn);
  }

  bodyDiv.appendChild(titleInput);
  bodyDiv.appendChild(textarea);
  bodyDiv.appendChild(actions);

  card.appendChild(head);
  card.appendChild(bodyDiv);
  return card;
}

// --- 画面上のカード → { preamble, sections } ---
function collectMemoCards() {
  const container = document.getElementById('memo-tab-cards');
  let preamble = memoPreambleBuf;
  const sections = [];
  container.querySelectorAll('.memo-card').forEach(card => {
    const title = card.querySelector('.memo-card-title-input').value.trim();
    const lines = card.querySelector('.memo-card-text').value.split('\n');
    if (card.dataset.fixed === '1') {
      preamble = lines;
    } else {
      sections.push({ title: title || '無題', lines });
    }
  });
  return { preamble, sections };
}

// --- 保存（全カードをまとめて memo.md にコミット） ---
async function saveMemoCards(message = '📝 メモを更新') {
  memoStatus('保存中…');
  try {
    const { preamble, sections } = collectMemoCards();
    const content = serializeMemoContent(preamble, sections);
    await MemoRepository.save(content);
    const textarea = document.getElementById('memo-tab-textarea');
    if (textarea) textarea.value = content;
    memoDirty = false;
    memoStatus('✅ 保存しました', '#1a7f37');
  } catch (e) {
    memoStatus(`保存失敗: ${e.message}`, '#cf222e');
  }
}

// --- カード追加 ---
function addMemoCard() {
  const input = document.getElementById('memo-new-title');
  const container = document.getElementById('memo-tab-cards');
  if (!input || !container) return;
  const title = input.value.trim();
  if (!title) { input.focus(); return; }

  const { sections } = collectMemoCards();
  if (sections.some(s => s.title === title)) {
    memoStatus(`「${title}」というカードは既にあります`, '#cf222e');
    return;
  }

  container.querySelector('.memo-empty')?.remove();
  const card = buildMemoCard(title, '', { fixed: false });
  card.classList.add('open');
  container.appendChild(card);
  input.value = '';
  input.blur();
  markMemoDirty();
  card.querySelector('.memo-card-text').focus();
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// --- カード削除（confirm 後すぐコミット） ---
async function deleteMemoCard(cardEl, title) {
  if (!confirm(`カード「${title}」を削除しますか？\n（memo.md からセクションごと削除されます）`)) return;
  cardEl.remove();
  await saveMemoCards(`🗑 メモカード削除: ${title}`);
  const container = document.getElementById('memo-tab-cards');
  if (container && !container.children.length) {
    renderMemoCards(memoPreambleBuf, []);
  }
}

// --- カード表示 ⇔ MD全体編集の切替（編集中の内容は引き継ぐ） ---
function toggleMemoRawMode() {
  const cards   = document.getElementById('memo-tab-cards');
  const addRow  = document.getElementById('memo-add-row');
  const textarea = document.getElementById('memo-tab-textarea');
  const rawBar  = document.getElementById('memo-raw-actions');
  const toggle  = document.getElementById('memo-mode-toggle');
  if (!cards || !textarea) return;

  if (memoRawMode) {
    // raw → カード
    const { preamble, sections } = parseMemoContent(textarea.value);
    renderMemoCards(preamble, sections);
    memoRawMode = false;
    textarea.classList.add('is-hidden');
    rawBar?.classList.add('is-hidden');
    cards.classList.remove('is-hidden');
    addRow?.classList.remove('is-hidden');
    if (toggle) toggle.textContent = 'MD';
  } else {
    // カード → raw
    const { preamble, sections } = collectMemoCards();
    textarea.value = serializeMemoContent(preamble, sections);
    memoRawMode = true;
    cards.classList.add('is-hidden');
    addRow?.classList.add('is-hidden');
    textarea.classList.remove('is-hidden');
    rawBar?.classList.remove('is-hidden');
    if (toggle) toggle.textContent = 'カード';
  }
}

// --- MD全体編集モードの保存 ---
async function saveMemoTab() {
  const textarea = document.getElementById('memo-tab-textarea');
  if (!textarea) return;
  memoStatus('保存中…');
  try {
    await MemoRepository.save(textarea.value);
    memoDirty = false;
    memoStatus('✅ 保存しました', '#1a7f37');
    // カード側の表示も最新化しておく
    const { preamble, sections } = parseMemoContent(textarea.value);
    renderMemoCards(preamble, sections);
  } catch (e) {
    memoStatus(`保存失敗: ${e.message}`, '#cf222e');
  }
}

window.loadMemoTab       = loadMemoTab;
window.markMemoDirty     = markMemoDirty;
window.saveMemoTab       = saveMemoTab;
window.saveMemoCards     = saveMemoCards;
window.addMemoCard       = addMemoCard;
window.toggleMemoRawMode = toggleMemoRawMode;
