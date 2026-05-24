/**
 * app.js
 * ナビゲーション / レスポンシブレイアウト / アプリ初期化
 * ─ html-loader.js の loadAllPartials() 完了後に初期化を実行する。
 */

const MOBILE_BREAKPOINT = 768;

// ========== ボトムナビ切り替え（スマホ） ==========
function switchBottomNav(section) {
  const setHidden = (element, hidden) => {
    if (!element) return;
    element.classList.toggle('is-hidden', hidden);
  };

  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  const colCalendar        = document.getElementById('col-calendar');
  const colMain            = document.getElementById('col-main');
  const colRight           = document.getElementById('col-right');
  const gcalTitle          = document.getElementById('gcal-title');
  const dailyChecklistCard = document.getElementById('daily-checklist-card');
  const memoTabCard        = document.getElementById('memo-tab-card');

  if (window.innerWidth > MOBILE_BREAKPOINT) return; // PC では無効

  setHidden(colCalendar,        true);
  setHidden(colMain,            true);
  setHidden(colRight,           true);
  setHidden(dailyChecklistCard, false);
  setHidden(memoTabCard,        true);
  setHidden(gcalTitle,          false);

  if (section === 'report') {
    setHidden(colMain, false);
    switchMainTab('report');
  } else if (section === 'checklist') {
    setHidden(colRight, false);
    setHidden(document.getElementById('side-tabs'), false);
    switchSideTab('checklist');
  } else if (section === 'calendar') {
    setHidden(colCalendar, false);
    setHidden(document.getElementById('side-tabs'), true);
    setHidden(dailyChecklistCard, true);
    setHidden(gcalTitle,          false);
  } else if (section === 'ai') {
    setHidden(colMain, false);
    switchMainTab('ai');
  } else if (section === 'settings') {
    setHidden(colMain, false);
    switchMainTab('settings');
  }
}

// ========== サイドタブ切り替え ==========
function switchSideTab(tab) {
  const checklistCard = document.getElementById('daily-checklist-card');
  const memoCard      = document.getElementById('memo-tab-card');
  const stabChecklist = document.getElementById('stab-checklist');
  const stabMemo      = document.getElementById('stab-memo');

  checklistCard?.classList.toggle('is-hidden', tab !== 'checklist');
  memoCard?.classList.toggle('is-hidden',      tab !== 'memo');

  stabChecklist?.classList.toggle('active', tab === 'checklist');
  stabMemo?.classList.toggle('active',      tab === 'memo');

  if (tab === 'memo' && typeof loadMemoTab === 'function') loadMemoTab();
}

// ========== モバイルサイドメニュー ==========
function toggleMobileSideMenu() {
  const colRight = document.getElementById('col-right');
  const overlay  = document.getElementById('mobile-side-overlay');
  if (!colRight || !overlay || window.innerWidth > MOBILE_BREAKPOINT) return;

  const isOpen = colRight.classList.contains('mobile-open');
  colRight.classList.remove('is-hidden');
  colRight.classList.toggle('mobile-open', !isOpen);
  overlay.classList.toggle('open', !isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
}

function closeMobileSideMenu() {
  const colRight = document.getElementById('col-right');
  const overlay  = document.getElementById('mobile-side-overlay');
  if (!colRight || !overlay) return;

  colRight.classList.remove('mobile-open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';

  if (window.innerWidth <= MOBILE_BREAKPOINT) {
    colRight.classList.add('is-hidden');
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMobileSideMenu();
});

// ========== レスポンシブレイアウト同期 ==========
let _syncLastIsMobile = null;

function syncResponsiveLayout() {
  const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

  // 幅方向のブレークポイント変化がなければスキップ
  if (isMobile === _syncLastIsMobile) return;
  _syncLastIsMobile = isMobile;

  const colCalendar = document.getElementById('col-calendar');
  const colMain     = document.getElementById('col-main');
  const colRight    = document.getElementById('col-right');
  const gcalTitle   = document.getElementById('gcal-title');
  const setHidden = (el, hidden) => el?.classList.toggle('is-hidden', hidden);

  if (!colCalendar || !colMain || !colRight) return;

  if (isMobile) {
    const active = document.querySelector('.bottom-nav-item.active')?.dataset.section || 'report';
    closeMobileSideMenu();
    switchBottomNav(active);
    return;
  }

  closeMobileSideMenu();
  setHidden(colMain,  false);
  setHidden(colRight, false);
  setHidden(document.getElementById('side-tabs'), false);
  switchSideTab('checklist');
  setHidden(gcalTitle, false);
  applyCalendarVisibility();
}

window.addEventListener('resize', syncResponsiveLayout);

// ========== アプリ初期化（パーシャルロード後に実行） ==========
loadAllPartials().then(async () => {
  syncResponsiveLayout();
  applyCalendarVisibility();

  // Service Worker を使用しない（キャッシュ問題回避）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  }

  // AI チャットの Enter キー送信
  document.getElementById('chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });

  // data/portal-config.json を読み込む
  try {
    const res = await fetch('data/portal-config.json');
    if (res.ok) window.PORTAL_CONFIG_INLINE = await res.json();
  } catch (e) {
    console.warn('portal-config.json の読み込みに失敗しました:', e);
  }

  // vault/persona/persona.md をロードして frontmatter をパース
  try {
    const res = await fetch('vault/persona/persona.md');
    if (res.ok) {
      const text  = await res.text();
      const fm    = {};
      let body    = text;
      const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (match) {
        match[1].split('\n').forEach(line => {
          const [k, ...v] = line.split(':');
          if (k) fm[k.trim()] = v.join(':').trim();
        });
        body = match[2].trim();
      }
      window.AI_PERSONA = { name: fm.name, userCallName: fm.userCallName, avatarUrl: fm.avatarUrl, body };
    }
  } catch (e) {
    console.warn('persona.md の読み込みに失敗しました:', e);
  }
  window.dispatchEvent(new Event('persona-loaded'));

  // Google Calendar iframe
  const gcalUrl           = window.PORTAL_CONFIG_INLINE?.calendarUrl;
  const gcalIframeEl      = document.getElementById('gcal-iframe');
  const gcalPlaceholderEl = document.getElementById('gcal-placeholder');
  if (gcalUrl) {
    if (gcalIframeEl)      { gcalIframeEl.src = gcalUrl; gcalIframeEl.classList.remove('is-hidden'); }
    if (gcalPlaceholderEl) gcalPlaceholderEl.classList.add('is-hidden');
  } else {
    if (gcalPlaceholderEl) gcalPlaceholderEl.classList.remove('is-hidden');
    if (gcalIframeEl)      gcalIframeEl.classList.add('is-hidden');
  }
  applyCalendarVisibility();

  const token = getToken();
  if (token) {
    await ConfigService.init();
    fetchDailyReport();
    if (typeof renderAllLinks === 'function') renderAllLinks();
    const kintaiLink = document.getElementById('kintai-sheet-link');
    if (kintaiLink && getKintaiUrl()) kintaiLink.href = getKintaiUrl();
  } else {
    // PAT 未設定の場合は設定画面へ
    setTimeout(() => { if (typeof switchMainTab === 'function') switchMainTab('settings'); }, 500);
  }
});
