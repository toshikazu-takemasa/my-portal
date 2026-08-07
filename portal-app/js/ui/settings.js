// =====================
// 設定画面・永続化ロジック
// =====================

const TOKEN_KEY  = 'gh_pat';
const GEMINI_KEY = 'gemini_api_key';

window.TOKEN_KEY  = TOKEN_KEY;
window.GEMINI_KEY = GEMINI_KEY;

// ---- 基本取得関数 ----
// 保存先の切り替え・暗号化は SecureStore が担う（ADR-033 決定事項7）。
// SecureStore 未ロード時は従来どおり localStorage を直接見る（後方互換）。
function _readKey(name) {
  if (typeof SecureStore !== 'undefined') return SecureStore.get(name);
  return localStorage.getItem(name);
}

function getToken()     { return _readKey(TOKEN_KEY); }
function getGeminiKey() { return _readKey(GEMINI_KEY); }
// getRepo / getBranch は js/core/config.js で定義（data/portal-config.json から読む）

window.getToken     = getToken;
window.getGeminiKey = getGeminiKey;

// ---- AI Persona (PERSONA_DIR の card.json から読む / ADR-040) ----
// window.AI_PERSONA = { name, userCallName, avatarUrl, greeting, avoidWords, intro, sections, postHistory }
// は app.js の初期化時にセット済み。
// avatarUrl は任意。省略時はペルソナディレクトリの avatar.png を使う（セットを持ち運べるようにするため）
function getAiName()   { return (window.AI_PERSONA && window.AI_PERSONA.name)      || 'AI'; }
function getAiAvatar() { return (window.AI_PERSONA && window.AI_PERSONA.avatarUrl)  || `${PERSONA_DIR}avatar.png`; }

/**
 * card.json のセクションを、プロンプトに載せる1本のテキストへ組み立てる。
 * 見出しの順序は card.json の配列順がそのまま効く（順序をデータで持つため）。
 */
function getAiPrompt() {
  const p = window.AI_PERSONA || {};
  const blocks = [];
  if (p.intro) blocks.push(p.intro);
  (p.sections || []).forEach(s => {
    if (!s || !s.heading) return;
    blocks.push(`【${s.heading}】\n${(s.lines || []).join('\n')}`);
  });
  const body = blocks.join('\n\n') || 'あなたは優秀なアシスタントです。';
  return body.replace(/\{呼称\}/g, p.userCallName || 'ユーザー');
}

// ---- 初期化 ----
function initSettingsTab() {
  showModalTokenUI();
  showModalGeminiUI();
  initKeyProtectionUI();
  initAvatarSceneUI();
  renderReplyFeedbackTally();

  const statusEl = document.getElementById('modal-status');
  if (statusEl) statusEl.textContent = '';
}

// ---- 返信候補から拾ったフィードバック（ADR-038） ----
function renderReplyFeedbackTally() {
  const el = document.getElementById('reply-feedback-tally');
  if (!el || typeof ReplyFeedback === 'undefined') return;

  const t = ReplyFeedback.tally();
  if (!t.total) {
    el.textContent = 'まだ記録がありません。対話画面で返信候補を押すと溜まります。';
    return;
  }
  // 実装の言葉（vault / ADR / 保存先）は出さない。ユーザーが見て意味の分かるものだけ。
  const violations = ReplyFeedback.recentViolations();
  el.innerHTML = `直近 <strong>${t.total}</strong> 回の反応<br>`
    + `会話を閉じる返信 ${t.close} ／ 掘り下げる返信 ${t.more}<br>`
    + `候補を使わず自分で入力 ${t.free} ／ その他 ${t.other}`
    + (violations.length
        ? `<br><span style="color:#cf222e;">使わない約束の言葉を検出: ${violations.map(escapeHtml).join('・')}</span>`
        : '');
}

function resetReplyFeedback() {
  if (typeof ReplyFeedback === 'undefined') return;
  ReplyFeedback.reset();
  renderReplyFeedbackTally();
}

// ---- アバターの表情・背景（ADR-035） ----
function initAvatarSceneUI() {
  if (typeof AvatarScene === 'undefined' || !AvatarScene.manifest) return;

  const sel = document.getElementById('avatar-bg-select');
  if (sel) {
    sel.innerHTML = AvatarScene.backgrounds()
      .map(b => `<option value="${b.id}">${escapeHtml(b.label || b.id)}</option>`)
      .join('');
    sel.value = AvatarScene.currentBackground || AvatarScene.savedBackground() || AvatarScene.manifest.defaultBackground || 'mood';
  }

  const btns = document.getElementById('avatar-expr-buttons');
  if (btns) {
    btns.innerHTML = AvatarScene.expressions()
      .map(e => `<button class="btn-quiet" style="font-size:11.5px;padding:6px 12px;" onclick="previewAvatarExpression('${e.id}')">${escapeHtml(e.label || e.id)}</button>`)
      .join('');
  }

  const note = document.getElementById('avatar-scene-note');
  if (note) {
    note.innerHTML = AvatarScene.hasDedicatedImages()
      ? '表情差分の画像を読み込んでいます。AI は返答に <code>[表情:happy]</code> のようなタグを入れて表情を切り替えます。'
      : `表情差分の画像がまだ配置されていません。<code>${PERSONA_DIR}expressions/</code> に
         <code>${AvatarScene.expressions().map(e => e.id + '.png').join(' / ')}</code>
         を置くと自動的に本物の表情差分に切り替わります。それまでは avatar.png ＋ CSS の疑似表情で代用します。`;
  }
}

function changeAvatarBackground() {
  const sel = document.getElementById('avatar-bg-select');
  if (!sel || typeof AvatarScene === 'undefined') return;
  AvatarScene.setBackground(sel.value, { persist: true });

  const st = document.getElementById('avatar-scene-status');
  if (st) {
    st.style.color = '#1a7f37';
    st.textContent = `✅ 背景を「${sel.options[sel.selectedIndex].textContent}」にしました`;
    setTimeout(() => { st.textContent = ''; }, 2000);
  }
}

function previewAvatarExpression(id) {
  if (typeof AvatarScene === 'undefined') return;
  AvatarScene.setExpression(id);

  const st = document.getElementById('avatar-scene-status');
  if (st) {
    const def = AvatarScene.findExpression(id);
    st.style.color = 'var(--text-sub)';
    st.textContent = `表情: ${def ? (def.label || def.id) : id}（対話タブで舞台の変化を確認できます）`;
  }
}

/**
 * APIキーとして保存してよい文字列か検査する。
 *
 * キーは HTTP ヘッダ（Authorization / x-goog-api-key）に載せるため、
 * ISO-8859-1 の範囲外の文字が1つでもあると fetch が
 * 「String contains non ISO-8859-1 code point」という TypeError を投げる。
 * これは呼び出し箇所から遠いところで出るので、原因にたどり着けない。
 *
 * 実際に「トークン欄に別のテキストを貼ってしまい、全 API が落ちる」事故が起きたので、
 * 入口で弾いて理由を伝える。
 *
 * @returns {string|null} 問題があればメッセージ、無ければ null
 */
function _validateApiKey(val, label) {
  const bad = [...val].filter(ch => ch.codePointAt(0) > 0x7e || ch.codePointAt(0) < 0x21);
  if (bad.length) {
    const sample = [...new Set(bad)].slice(0, 5)
      .map(ch => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`)
      .join(' ');
    return `${label}に使えない文字が ${bad.length} 個含まれています（${sample}）。\n`
         + '全角文字や空白が混ざっていないか、貼り付けた内容を確認してください。';
  }
  return null;
}

// ---- GitHub PAT ----
function showModalTokenUI() {
  const hasToken = !!getToken();
  document.getElementById('modal-pat-set').classList.toggle('is-hidden', !hasToken);
  document.getElementById('modal-pat-unset').classList.toggle('is-hidden', hasToken);
}

async function saveToken() {
  const val = document.getElementById('token-input').value.trim();
  if (!val) return;
  const invalid = _validateApiKey(val, 'GitHub PAT');
  if (invalid) { alert(invalid); return; }
  try {
    await _writeKey(TOKEN_KEY, val);
  } catch (e) {
    alert(`保存できませんでした: ${e.message}`);
    return;
  }
  document.getElementById('token-input').value = '';
  showModalTokenUI();
  location.reload(); // トークン変更時は確実な反映のためリロード推奨
}

function clearToken() {
  _removeKey(TOKEN_KEY);
  showModalTokenUI();
  location.reload();
}

// ---- Gemini API Key ----
function showModalGeminiUI() {
  const has = !!getGeminiKey();
  document.getElementById('modal-gemini-set').classList.toggle('is-hidden', !has);
  document.getElementById('modal-gemini-unset').classList.toggle('is-hidden', has);
}

async function saveGeminiKey() {
  const val = document.getElementById('gemini-key-input').value.trim();
  if (!val) return;
  const invalid = _validateApiKey(val, 'Gemini API キー');
  if (invalid) { alert(invalid); return; }
  try {
    await _writeKey(GEMINI_KEY, val);
  } catch (e) {
    alert(`保存できませんでした: ${e.message}`);
    return;
  }
  document.getElementById('gemini-key-input').value = '';
  showModalGeminiUI();
}

function clearGeminiKey() { _removeKey(GEMINI_KEY); showModalGeminiUI(); }

// =====================
// APIキーの保護（保存先切替・暗号化） ADR-033 決定事項7
// =====================

async function _writeKey(name, value) {
  if (typeof SecureStore !== 'undefined') return await SecureStore.set(name, value);
  localStorage.setItem(name, value);
}

function _removeKey(name) {
  if (typeof SecureStore !== 'undefined') return SecureStore.remove(name);
  localStorage.removeItem(name);
}

function _keyProtStatus(msg, color) {
  const el = document.getElementById('key-protection-status');
  if (!el) return;
  el.style.color = color || 'var(--text-sub)';
  el.textContent = msg;
}

function initKeyProtectionUI() {
  if (typeof SecureStore === 'undefined') return;

  const backendSel = document.getElementById('key-backend-select');
  if (backendSel) backendSel.value = SecureStore.backendName();

  const enabled = SecureStore.isEncrypted();
  document.getElementById('key-enc-on')?.classList.toggle('is-hidden', !enabled);
  document.getElementById('key-enc-off')?.classList.toggle('is-hidden', enabled);

  const lockState = document.getElementById('key-lock-state');
  if (lockState) {
    lockState.textContent = !enabled
      ? ''
      : (SecureStore.isUnlocked() ? '🔓 解錠済み' : '🔒 ロック中');
  }
  _keyProtStatus('');
}

function changeKeyBackend() {
  const sel = document.getElementById('key-backend-select');
  if (!sel || typeof SecureStore === 'undefined') return;
  SecureStore.setBackend(sel.value);
  _keyProtStatus(
    sel.value === 'session'
      ? '✅ sessionStorage に切り替えました（タブを閉じるとキーは破棄されます）'
      : '✅ localStorage に切り替えました',
    '#1a7f37'
  );
}

async function enableKeyEncryption() {
  const p1 = document.getElementById('key-pass-input')?.value || '';
  const p2 = document.getElementById('key-pass-confirm')?.value || '';
  if (!p1) { _keyProtStatus('パスフレーズを入力してください', '#cf222e'); return; }
  if (p1 !== p2) { _keyProtStatus('パスフレーズが一致しません', '#cf222e'); return; }

  _keyProtStatus('暗号化しています…');
  try {
    await SecureStore.enableEncryption(p1);
    document.getElementById('key-pass-input').value = '';
    document.getElementById('key-pass-confirm').value = '';
    initKeyProtectionUI();
    _keyProtStatus('✅ 暗号化を有効にしました。次回起動時にパスフレーズを求められます', '#1a7f37');
  } catch (e) {
    _keyProtStatus(`❌ ${e.message}`, '#cf222e');
  }
}

async function disableKeyEncryption() {
  if (!confirm('暗号化を解除して平文保存に戻します。よろしいですか？')) return;
  try {
    if (!SecureStore.isUnlocked()) {
      const ok = await SecureStore.promptUnlock();
      if (!ok) { _keyProtStatus('解錠できなかったため中止しました', '#cf222e'); return; }
    }
    await SecureStore.disableEncryption();
    initKeyProtectionUI();
    _keyProtStatus('✅ 暗号化を解除しました', '#1a7f37');
  } catch (e) {
    _keyProtStatus(`❌ ${e.message}`, '#cf222e');
  }
}

async function unlockKeys() {
  const ok = await SecureStore.promptUnlock();
  initKeyProtectionUI();
  if (ok) location.reload();
}

// ---- Kintai URL ----
function getKintaiUrl() { return ConfigService.data.kintaiUrl || ''; }

async function saveKintaiUrl() {
  const val = document.getElementById('kintai-url-input').value.trim();
  const st = document.getElementById('kintai-url-status');
  st.textContent = '保存中...';
  await ConfigService.updateConfig({ kintaiUrl: val }, '📊 勤怠URLを更新');
  st.style.color = '#1a7f37'; st.textContent = '✅ 保存しました';
  setTimeout(() => { st.textContent = ''; }, 2000);
}

// global 登録
window.getToken = getToken;
window.getGeminiKey = getGeminiKey;
window.getAiName = getAiName;
window.getAiPrompt = getAiPrompt;
window.getAiAvatar = getAiAvatar;
window.getKintaiUrl = getKintaiUrl;
window.initSettingsTab = initSettingsTab;
window.saveToken = saveToken;
window.clearToken = clearToken;
window.saveGeminiKey = saveGeminiKey;
window.clearGeminiKey = clearGeminiKey;
window.saveKintaiUrl = saveKintaiUrl;
window.initKeyProtectionUI = initKeyProtectionUI;
window.renderReplyFeedbackTally = renderReplyFeedbackTally;
window.resetReplyFeedback = resetReplyFeedback;
window.initAvatarSceneUI = initAvatarSceneUI;
window.changeAvatarBackground = changeAvatarBackground;
window.previewAvatarExpression = previewAvatarExpression;
window.changeKeyBackend = changeKeyBackend;
window.enableKeyEncryption = enableKeyEncryption;
window.disableKeyEncryption = disableKeyEncryption;
window.unlockKeys = unlockKeys;
window.testGeminiKey = async function() {
  const key = document.getElementById('gemini-key-input')?.value || getGeminiKey();
  const statusEl = document.getElementById('gemini-test-status');
  if (!key) {
    if (statusEl) statusEl.textContent = '❌ キーが入力されていません';
    return;
  }
  if (statusEl) statusEl.textContent = '⏳ テスト中...';
  try {
    // キーはヘッダーで送る（ADR-033 決定事項7）
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
    });
    if (res.ok) {
      if (statusEl) statusEl.textContent = '✅ 接続成功';
    } else {
      const err = await res.json().catch(() => ({}));
      if (statusEl) statusEl.textContent = `❌ エラー: ${err.error?.message || res.status}`;
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = `❌ 接続失敗: ${e.message}`;
  }
};
