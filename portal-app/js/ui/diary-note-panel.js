/**
 * 「日記に書く」フォーム
 *
 * 会話中に残したいことを、その場で今日の日記へ追記する導線。
 * AI の append_to_file ツールに頼む経路もあるが、モデルの判断を挟むと
 * 発火しないことがあるため、UI から直接書き込む（旧・覚えてフォームと同じ思想）。
 *
 * 書き込み先は vault/diary/YYYY-MM-DD.md の末尾。「- HH:MM 内容」の形で足す。
 * 旧・覚えてフォーム（ユーザー像 profile.md への記録）はこのフォームに置き換えた。
 * ユーザー像への記録は AI ツール remember_about_user に一本化している。
 *
 * 依存: js/storage/github-storage.js, js/core/config.js (getJstTodayISO),
 *       js/ui/ai-chat.js（chatHistory を参照）
 */

/** 直近のユーザー発話。ai-chat.js の chatHistory はトップレベル let なので名前で参照できる */
function _lastUserUtterance() {
  if (typeof chatHistory === 'undefined' || !Array.isArray(chatHistory)) return '';
  const last = [...chatHistory].reverse().find(m => m && m.role === 'user');
  return last ? String(last.content || '').trim() : '';
}

function _diaryNoteStatus(msg, color) {
  const el = document.getElementById('diary-note-status');
  if (!el) return;
  el.style.color = color || 'var(--text-sub)';
  el.textContent = msg || '';
}

function openDiaryNoteForm() {
  const panel = document.getElementById('diary-note-panel');
  if (!panel) return;

  // 直前の発話を下敷きにする。会話の断片のまま残さず言い換えてもらう前提で、
  // placeholder は残したまま初期値だけ入れる。
  const ta = document.getElementById('diary-note-text');
  if (ta && !ta.value.trim()) ta.value = _lastUserUtterance().slice(0, 200);

  panel.classList.remove('is-hidden');
  _diaryNoteStatus('');
  ta?.focus();
}

function closeDiaryNoteForm() {
  document.getElementById('diary-note-panel')?.classList.add('is-hidden');
  _diaryNoteStatus('');
}

async function submitDiaryNote() {
  const ta  = document.getElementById('diary-note-text');
  const btn = document.getElementById('diary-note-save-btn');
  const text = (ta?.value || '').trim();

  if (!text) { _diaryNoteStatus('書く内容を入力してください', '#cf222e'); return; }
  if (typeof getToken === 'function' && !getToken()) {
    _diaryNoteStatus('PAT が未設定です。設定から登録してください', '#cf222e');
    return;
  }

  if (btn) btn.disabled = true;
  _diaryNoteStatus('書き込んでいます…');
  try {
    const today = getJstTodayISO();
    const path  = `vault/diary/${today}.md`;
    const now   = new Date().toLocaleTimeString('ja-JP', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo'
    });

    // 複数行はリスト項目の継続行（2スペース字下げ）として収める
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const entry = [`- ${now} ${lines[0]}`, ...lines.slice(1).map(l => `  ${l}`)].join('\n');

    // 追記は「読む→つなぐ→書く」をアプリ側でやる（ADR-046 / tool-dispatcher と同じ）
    const existing = await GitHubStorage.getFile(path).catch(() => null);
    const base = (existing ? existing.content : `# ${today}\n`).replace(/\s*$/, '');
    const saved = await GitHubStorage.saveFile(path, `${base}\n${entry}\n`, `📝 日記にメモを追記: ${today}`);
    if (!saved || !saved.commit) {
      _diaryNoteStatus('❌ 日記への追記が確認できませんでした', '#cf222e');
      return;
    }

    if (ta) ta.value = '';
    _diaryNoteStatus(`✅ 今日の日記（${today}）の末尾に追記しました`, '#1a7f37');
  } catch (e) {
    _diaryNoteStatus(`❌ ${e.message}`, '#cf222e');
  } finally {
    if (btn) btn.disabled = false;
  }
}

window.openDiaryNoteForm  = openDiaryNoteForm;
window.closeDiaryNoteForm = closeDiaryNoteForm;
window.submitDiaryNote    = submitDiaryNote;
