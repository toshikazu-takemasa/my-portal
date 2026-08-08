/**
 * 「覚えて」フォーム（ADR-052）
 *
 * AI に `remember_about_user` を呼ばせる導線も残してあるが、それだけでは確実に発火しない。
 * 実際「覚えといて」と話しかけても記録されない事例が出たため、**UI から直接**
 * PersonaState.remember() を呼ぶ経路を用意した。モデルの判断を挟まないので確実に動く。
 *
 * 依存: js/domains/persona-state.js, js/ui/ai-chat.js（chatHistory を参照）
 */

/** 直近のユーザー発話。ai-chat.js の chatHistory はトップレベル let なので名前で参照できる */
function _lastUserUtterance() {
  if (typeof chatHistory === 'undefined' || !Array.isArray(chatHistory)) return '';
  const last = [...chatHistory].reverse().find(m => m && m.role === 'user');
  return last ? String(last.content || '').trim() : '';
}

function _rememberStatus(msg, color) {
  const el = document.getElementById('remember-status');
  if (!el) return;
  el.style.color = color || 'var(--text-sub)';
  el.textContent = msg || '';
}

function openRememberForm() {
  const panel = document.getElementById('remember-panel');
  if (!panel || typeof PersonaState === 'undefined') return;

  // セクションの選択肢は PersonaState を正とする（2箇所で定義しない）
  const sel = document.getElementById('remember-section');
  if (sel && !sel.options.length) {
    sel.innerHTML = PersonaState.SECTIONS
      .map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}（最大${s.max}）</option>`)
      .join('');
  }

  // 直前の発話を下敷きにする。そのまま覚えると会話の断片が残るので、
  // 言い換えてもらう前提で placeholder は残したまま初期値だけ入れる。
  const ta = document.getElementById('remember-text');
  if (ta && !ta.value.trim()) ta.value = _lastUserUtterance().slice(0, 120);

  panel.classList.remove('is-hidden');
  _rememberStatus('');
  ta?.focus();
}

function closeRememberForm() {
  document.getElementById('remember-panel')?.classList.add('is-hidden');
  _rememberStatus('');
}

async function submitRemember() {
  const ta  = document.getElementById('remember-text');
  const sel = document.getElementById('remember-section');
  const btn = document.getElementById('remember-save-btn');
  const text    = (ta?.value || '').trim();
  const section = sel?.value || '';

  if (!text) { _rememberStatus('覚える内容を入力してください', '#cf222e'); return; }
  if (typeof PersonaState === 'undefined') { _rememberStatus('PersonaState が読み込まれていません', '#cf222e'); return; }
  if (typeof getToken === 'function' && !getToken()) {
    _rememberStatus('PAT が未設定です。設定から登録してください', '#cf222e');
    return;
  }

  if (btn) btn.disabled = true;
  _rememberStatus('保存しています…');
  try {
    const r = await PersonaState.remember(text, section);
    if (!r.ok) { _rememberStatus(`❌ ${r.error}`, '#cf222e'); return; }
    if (ta) ta.value = '';
    _rememberStatus(`✅ ${r.message}`, '#1a7f37');
  } catch (e) {
    _rememberStatus(`❌ ${e.message}`, '#cf222e');
  } finally {
    if (btn) btn.disabled = false;
  }
}

window.openRememberForm  = openRememberForm;
window.closeRememberForm = closeRememberForm;
window.submitRemember    = submitRemember;
