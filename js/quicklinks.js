// =====================
// クイックリンク（全リンク統合・DnD対応）
// =====================
const LINKS_KEY = 'all_links_v2';

const DEFAULT_LINKS = [
  { id: 'b1', emoji: '📅', name: 'Google Calendar', url: 'https://calendar.google.com', category: '今日の予定' },
  { id: 'b2', emoji: '📧', name: 'Gmail',            url: 'https://mail.google.com',    category: '今日の予定' },
  { id: 'b3', emoji: '⚡', name: 'GitHub Issues',   url: 'https://github.com',          category: '今日の予定' },
  { id: 'b4', emoji: '🤖', name: 'Claude',          url: 'https://claude.ai',           category: 'AI' },
  { id: 'b5', emoji: '💎', name: 'Gemini',          url: 'https://gemini.google.com',   category: 'AI' },
  { id: 'b6', emoji: '🐙', name: 'GitHub',          url: 'https://github.com',          category: '開発' },
];

function getAllLinks() {
  const stored = localStorage.getItem(LINKS_KEY);
  if (stored) { try { return JSON.parse(stored); } catch {} }
  const links = DEFAULT_LINKS.map(l => ({ ...l }));
  localStorage.setItem(LINKS_KEY, JSON.stringify(links));
  return links;
}

function saveLinks(links) {
  localStorage.setItem(LINKS_KEY, JSON.stringify(links));
  if (portalConfig) {
    portalConfig.links = links;
    savePortalConfigDebounced('🔗 リンクを更新');
  }
  renderAllLinks();
}

let _dragId = null;

function renderAllLinks() {
  const links = getAllLinks();
  const grid  = document.getElementById('links-body');
  grid.innerHTML = '';

  // カテゴリ順（空が先、あとは登場順）
  const catOrder = [];
  const groups   = {};
  links.forEach(l => {
    const cat = l.category || '';
    if (!groups[cat]) { catOrder.push(cat); groups[cat] = []; }
    groups[cat].push(l);
  });

  catOrder.forEach(cat => {
    // カテゴリラベル（ドロップ対象）
    if (cat) {
      const label = document.createElement('div');
      label.className = 'link-cat-label';
      label.textContent = cat;
      label.dataset.cat = cat;
      label.addEventListener('dragover', e => { e.preventDefault(); label.classList.add('drag-over'); });
      label.addEventListener('dragleave', () => label.classList.remove('drag-over'));
      label.addEventListener('drop', e => {
        e.preventDefault();
        label.classList.remove('drag-over');
        if (!_dragId) return;
        const all = getAllLinks();
        const lnk = all.find(l => l.id === _dragId);
        if (lnk) { lnk.category = cat; saveLinks(all); }
      });
      grid.appendChild(label);
    }

    // リンクカード
    groups[cat].forEach(lnk => {
      const a = document.createElement('a');
      a.className = 'link-card';
      a.href = lnk.url;
      a.target = '_blank';
      a.dataset.id = lnk.id;
      a.draggable = true;
      a.innerHTML =
        `<span class="link-card-icon"><span class="link-card-emoji">${escapeHtml(lnk.emoji || '🔗')}</span></span>` +
        `<span class="link-card-label">${escapeHtml(lnk.name)}</span>` +
        `<span class="del-btn">✕</span>`;

      // ファビコン（成功時は絵文字を置き換え、失敗時はそのまま）
      try {
        const domain   = new URL(lnk.url).hostname;
        const iconWrap = a.querySelector('.link-card-icon');
        const img = document.createElement('img');
        img.className = 'link-card-favicon';
        img.src       = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        img.loading   = 'lazy';
        img.alt       = '';
        iconWrap.insertBefore(img, iconWrap.firstChild);
        img.addEventListener('load',  () => {
          const em = iconWrap.querySelector('.link-card-emoji');
          if (em) em.replaceWith(img);
        });
        img.addEventListener('error', () => img.remove());
      } catch {}

      // 削除
      a.querySelector('.del-btn').addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        saveLinks(getAllLinks().filter(l => l.id !== lnk.id));
      });

      // DnD: ドラッグ開始
      a.addEventListener('dragstart', e => {
        _dragId = lnk.id;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => a.classList.add('dragging'), 0);
      });
      // DnD: ドラッグ終了
      a.addEventListener('dragend', () => {
        a.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        _dragId = null;
      });
      // DnD: 他カードの上を通過
      a.addEventListener('dragover', e => {
        e.preventDefault();
        if (_dragId !== lnk.id) a.classList.add('drag-over');
      });
      a.addEventListener('dragleave', () => a.classList.remove('drag-over'));
      // DnD: このカードへドロップ（並び替え＋カテゴリ変更）
      a.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        a.classList.remove('drag-over');
        if (!_dragId || _dragId === lnk.id) return;
        const all    = getAllLinks();
        const srcIdx = all.findIndex(l => l.id === _dragId);
        if (srcIdx < 0) return;
        const [src] = all.splice(srcIdx, 1);
        src.category = lnk.category;
        const tgtIdx = all.findIndex(l => l.id === lnk.id);
        all.splice(tgtIdx, 0, src);
        saveLinks(all);
      });

      grid.appendChild(a);
    });
  });

  // 追加ボタン
  const addBtn = document.createElement('button');
  addBtn.className = 'add-card-btn';
  addBtn.id = 'add-link-btn';
  addBtn.onclick = toggleAddForm;
  addBtn.innerHTML = '<span style="font-size:1.4rem;line-height:1;">＋</span><span>追加</span>';
  grid.appendChild(addBtn);

  // datalist 更新
  const cats = [...new Set(links.map(l => l.category).filter(Boolean))];
  const dl   = document.getElementById('cat-list');
  dl.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');
}

function toggleAddForm() {
  const form = document.getElementById('add-link-form');
  const show = form.classList.contains('is-hidden');
  form.classList.toggle('is-hidden', !show);
  if (show) document.getElementById('fl-name').focus();
}

function addCustomLink() {
  const emoji = document.getElementById('fl-emoji').value.trim() || '🔗';
  const name  = document.getElementById('fl-name').value.trim();
  const url   = document.getElementById('fl-url').value.trim();
  const cat   = document.getElementById('fl-cat').value.trim();
  if (!name || !url) return;
  const links = getAllLinks();
  links.push({ id: 'c' + Date.now(), emoji, name, url, category: cat });
  saveLinks(links);
  ['fl-emoji','fl-name','fl-url','fl-cat'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('add-link-form').classList.add('is-hidden');
}

renderAllLinks();
