// =====================
// AI アシスタント
// =====================
const SESSIONS_KEY = 'chat_sessions';
const WELCOME_MSG  = '主くん、お疲れさま。今日はどんな一日になりそうかな？\n\n日常生活のちょっとした相談から、作業の応援、日記の振り返りまで、うちで力になれることがあったら何でも言うてな。一緒に頑張ろ！\n\n📝 文章のお手伝い・相談\n📅 日記の管理・振り返り\n📋 予定や記録の整理\n☕ ちょっとした雑談・癒やし';

let chatHistory   = [];
let reflectResult = '';
let currentSession = null;   // { id, title, messages }
let attachedFiles  = [];     // [{ path, content, sha }]
const applyBlocks  = new Map(); // blockId → { path, content }

// ---- Session management ----
function getSessions() { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); }
function saveSessions(s) { localStorage.setItem(SESSIONS_KEY, JSON.stringify(s.slice(0, 30))); }

function saveCurrentSession() {
  if (!currentSession) return;
  currentSession.messages = [...chatHistory];
  const all = getSessions();
  const idx = all.findIndex(s => s.id === currentSession.id);
  const updated = { ...currentSession, updatedAt: Date.now() };
  if (idx >= 0) all[idx] = updated; else all.unshift(updated);
  saveSessions(all);
}

function newChatSession() {
  if (currentSession && chatHistory.length > 0) saveCurrentSession();
  currentSession = { id: Date.now().toString(), title: '新しい会話', messages: [] };
  chatHistory = []; attachedFiles = [];
  renderChatPanel(); closeSessionDropdown();
}

function loadSession(id) {
  if (currentSession && chatHistory.length > 0) saveCurrentSession();
  const s = getSessions().find(s => s.id === id);
  if (!s) return;
  currentSession = { ...s };
  chatHistory = s.messages ? [...s.messages] : [];
  attachedFiles = [];
  renderChatPanel(); closeSessionDropdown();
}

function deleteSession(id, e) {
  e.stopPropagation();
  saveSessions(getSessions().filter(s => s.id !== id));
  if (currentSession && currentSession.id === id) newChatSession();
  else renderSessionDropdown();
}

function renderChatPanel() {
  document.getElementById('session-title-display').textContent =
    currentSession ? currentSession.title : '新しい会話';
  const histEl = document.getElementById('chat-history');
  histEl.innerHTML = '';
  if (chatHistory.length === 0) {
    appendChatBubble('ai', WELCOME_MSG);
  } else {
    chatHistory.forEach(msg => appendChatBubble(msg.role === 'user' ? 'user' : 'ai', msg.content));
  }
  renderFileChips();
}

function toggleSessionDropdown() {
  const dd = document.getElementById('session-dropdown');
  if (dd.classList.contains('is-hidden')) {
    renderSessionDropdown();
    dd.classList.remove('is-hidden');
  } else {
    dd.classList.add('is-hidden');
  }
}
function closeSessionDropdown() { document.getElementById('session-dropdown').classList.add('is-hidden'); }

function renderSessionDropdown() {
  const sessions = getSessions();
  const dd = document.getElementById('session-dropdown');
  if (sessions.length === 0) {
    dd.innerHTML = '<div style="padding:10px 12px;font-size:0.78rem;color:#888;">会話履歴なし</div>';
    return;
  }
  dd.innerHTML = sessions.map(s => {
    const dt  = new Date(parseInt(s.updatedAt || s.id));
    const lbl = dt.toLocaleDateString('ja-JP', { month:'numeric', day:'numeric' }) + ' '
              + dt.toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });
    const active = currentSession && s.id === currentSession.id ? ' active' : '';
    return `<div class="session-item${active}" onclick="loadSession('${s.id}')">
      <div class="session-item-title">${escapeHtml(s.title)}</div>
      <div class="session-item-meta">${lbl}
        <span class="session-del" onclick="deleteSession('${s.id}',event)">✕</span>
      </div>
    </div>`;
  }).join('');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.chat-session-bar')) closeSessionDropdown();
});

// ---- File attachment ----
async function promptFileAttach() {
  const path = prompt('ファイルパスを入力\n例: 保管庫/ナレッジ/メモ.md');
  if (!path) return;
  await fetchFileForAttach(path.trim());
}

async function fetchFileForAttach(path) {
  const token = getToken();
  if (!token) { alert('GitHub PAT が必要です（⚙️ 設定）'); return; }
  if (!getRepo()) { alert('GitHub リポジトリが設定されていません（⚙️ 設定）'); return; }
  const enc = path.split('/').map(encodeURIComponent).join('/');
  try {
    const res = await fetch(`https://api.github.com/repos/${getRepo()}/contents/${enc}`,
      { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { alert(`ファイルが見つかりません:\n${path}`); return; }
    const data = await res.json();
    const raw  = atob(data.content.replace(/\n/g, ''));
    const text = new TextDecoder('utf-8').decode(Uint8Array.from(raw, c => c.charCodeAt(0)));
    attachedFiles = attachedFiles.filter(f => f.path !== path);
    attachedFiles.push({ path, content: text, sha: data.sha });
    renderFileChips();
  } catch(e) { alert('ファイル取得エラー: ' + e.message); }
}

function removeAttachedFile(idx) { attachedFiles.splice(idx, 1); renderFileChips(); }

function renderFileChips() {
  const el = document.getElementById('file-chips');
  if (attachedFiles.length === 0) { el.classList.add('is-hidden'); el.innerHTML = ''; return; }
  el.classList.remove('is-hidden');
  el.innerHTML = attachedFiles.map((f, i) =>
    `<span class="file-chip">📄 ${escapeHtml(f.path.split('/').pop())}
      <span class="file-chip-remove" onclick="removeAttachedFile(${i})">✕</span>
    </span>`).join('');
}

// ---- File apply ----
async function applyFileEdit(blockId, btn) {
  const token = getToken();
  if (!token) { alert('GitHub PAT が必要です'); return; }
  if (!getRepo()) { alert('GitHub リポジトリが設定されていません'); return; }
  const block = applyBlocks.get(blockId);
  if (!block) return;
  btn.disabled = true; btn.textContent = '適用中…';
  try {
    const enc = block.path.split('/').map(encodeURIComponent).join('/');
    const url = `https://api.github.com/repos/${getRepo()}/contents/${enc}`;
    const getRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = {
      message: `✏️ AI編集: ${block.path.split('/').pop()}`,
      content: encodeUtf8Base64(block.content)
    };
    if (getRes.ok) { const d = await getRes.json(); body.sha = d.sha; }
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (putRes.ok) {
      btn.textContent = '✅ 適用完了'; btn.style.background = '#1a7f37';
      const nd = await putRes.json();
      const af = attachedFiles.find(f => f.path === block.path);
      if (af) { af.sha = nd.content.sha; af.content = block.content; }
    } else {
      const err = await putRes.json().catch(() => ({}));
      btn.textContent = `失敗: ${err.message || putRes.status}`;
      btn.style.background = '#cf222e'; btn.disabled = false;
    }
  } catch(e) { btn.textContent = 'エラー: ' + e.message; btn.disabled = false; }
}


// ---- Message rendering ----
function renderAIMessage(text) {
  const container = document.createElement('div');
  const applyRe = /===APPLY:\s*(.+?)===\n([\s\S]*?)===END===/g;
  const parts = []; let lastIdx = 0, m;
  while ((m = applyRe.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push({ type: 'text', content: text.slice(lastIdx, m.index) });
    parts.push({ type: 'apply', path: m[1].trim(), content: m[2] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push({ type: 'text', content: text.slice(lastIdx) });

  parts.forEach(part => {
    if (part.type === 'text') {
      const span = document.createElement('span');
      span.innerHTML = escapeHtml(part.content).replace(/\n/g, '<br>');
      container.appendChild(span);
    } else {
      const blockId = 'ab_' + Math.random().toString(36).slice(2);
      applyBlocks.set(blockId, { path: part.path, content: part.content });
      const d = document.createElement('div');
      d.className = 'apply-block';
      d.innerHTML = `<div class="apply-path">📄 ${escapeHtml(part.path)}</div>
        <details><summary class="apply-summary">内容を確認（${part.content.split('\n').length}行）</summary>
          <pre class="apply-preview">${escapeHtml(part.content)}</pre></details>
        <button class="apply-btn" onclick="applyFileEdit('${blockId}',this)">✅ ファイルに適用</button>`;
      container.appendChild(d);
    }
  });
  return container;
}

function appendChatBubble(role, text) {
  const histEl = document.getElementById('chat-history');
  const div = document.createElement('div');
  div.className = `chat-bubble ${role}`;
  
  if (role.includes('ai')) {
    const avatarUrl = getAiAvatar();
    if (avatarUrl) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.className = 'chat-avatar';
      img.style = "width:48px; height:48px; border-radius:50%; object-fit:cover; border:2px solid #fff; flex-shrink:0;";
      div.appendChild(img);
    }
    const contentSpan = document.createElement('span');
    contentSpan.style.color = '#fff';
    contentSpan.appendChild(renderAIMessage(text));
    div.appendChild(contentSpan);
  } else {
    div.textContent = text;
    div.style.color = '#fff';
  }
  histEl.appendChild(div);
  histEl.scrollTop = histEl.scrollHeight;
  return div;
}

async function sendChat() {
  const geminiKey = getGeminiKey();
  
  if (!geminiKey) {
    alert('⚙️ 設定から Gemini API キー を先に設定してください。');
    return;
  }
  
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;

  const btn = document.getElementById('chat-send-btn');
  btn.disabled = true; input.value = '';
  appendChatBubble('user', text);
  chatHistory.push({ role: 'user', content: text });

  if (chatHistory.length === 1 && currentSession && currentSession.title === '新しい会話') {
    currentSession.title = text.slice(0, 28) + (text.length > 28 ? '…' : '');
    document.getElementById('session-title-display').textContent = currentSession.title;
  }
  saveCurrentSession();

  const thinking = appendChatBubble('ai thinking', '考え中…');

  const includeReport = document.getElementById('include-report').checked;
  const includeKnowledge = document.getElementById('include-knowledge')?.checked;

  const aiName = getAiName();
  const persona = getAiPrompt();

  let sys = `あなたは「${aiName}」として振る舞ってください。
人格・口調設定：${persona}

利用可能なポータル機能：
📝 文章校正・コミュニケーション改善
🤔 業務相談・意思決定サポート
🔧 技術タスク・実装支援
📋 情報整理・作業記録管理
📅 日記管理・振り返り・工数集計支援

## 応答スタイル
- 設定された口調を忠実に守ってください。
- 簡潔: 必要な情報のみ提供
- 問いかけ型: ユーザーの思考を引き出す
- 段階的: 一度に多くを求めない
- ユーザー主導: ユーザーの判断を尊重

設定された人格に基づき、日本語で丁寧かつ簡潔に回答してください。`;

  // コンテキストの収集
  let contextStr = "";
  if (includeReport) {
    // グローバルな reportContent (report.jsで定義されている想定) があれば使用
    if (typeof reportContent !== 'undefined' && reportContent) {
      contextStr += `\n\n### 今日の日記:\n${reportContent}`;
    } else {
      // なければ最新の日記をフェッチ
      const latest = await fetchLatestContextForChat('日記', 1);
      contextStr += `\n\n### 直近の日記:\n${latest}`;
    }
  }
  if (includeKnowledge) {
    const latest = await fetchLatestContextForChat('ナレッジ', 2);
    contextStr += `\n\n### ナレッジ記録:\n${latest}`;
  }

  if (contextStr) {
    sys += `\n\n## 参照情報\n以下の情報をコンテキストとして考慮してください:\n${contextStr}`;
  }

  if (attachedFiles.length > 0) {
    sys += '\n\n## 添付ファイル\nファイルの編集依頼があった場合、完全な新しいファイル内容を以下の形式で出力してください（省略不可）:\n===APPLY: ファイルパス===\n[完全なファイル内容]\n===END===\n\n添付ファイル:';
    attachedFiles.forEach(f => { sys += `\n\n### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``; });
  }

  try {
    // Gemini を使用
    const reply = await callGemini(chatHistory, sys);
    
    thinking.className = 'chat-bubble ai';
    // アバターを残すため、最後の span だけを更新
    const contentSpan = thinking.querySelector('span');
    if (contentSpan) {
      contentSpan.innerHTML = '';
      contentSpan.appendChild(renderAIMessage(reply));
    } else {
      thinking.innerHTML = '';
      thinking.appendChild(renderAIMessage(reply));
    }
    chatHistory.push({ role: 'assistant', content: reply });
    saveCurrentSession();
  } catch (e) {
    thinking.className = 'chat-bubble ai';
    let errMsg = `エラー: ${e.message}`;
    if (e.message.includes('無料枠')) {
      errMsg = 'ごめんね主くん、今はちょっと魔法の力が足りひんみたいやわ。しばらく待ってから、また声かけてくれるかな？';
    }
    const contentSpan = thinking.querySelector('span');
    if (contentSpan) {
      contentSpan.textContent = errMsg;
    } else {
      thinking.textContent = errMsg;
    }
    chatHistory.pop();
  } finally { btn.disabled = false; input.focus(); }
}

/**
 * チャット用コンテキストのフェッチ (ai-ticker.js のロジックを流用)
 */
async function fetchLatestContextForChat(folder, count) {
  const token = getToken();
  const repo  = getRepo();
  if (!token || !repo) return "";

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${folder}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return "";
    const files = await res.json();
    const targets = files
      .filter(f => f.name.endsWith('.md'))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, count);

    let parts = [];
    for (const file of targets) {
      const content = await fetchFileContentForChat(file.path);
      parts.push(`[${file.name}]\n${content.slice(0, 500)}`);
    }
    return parts.join('\n\n');
  } catch (e) {
    return "";
  }
}

async function fetchFileContentForChat(path) {
  const token = getToken();
  const repo  = getRepo();
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return "";
  const data = await res.json();
  const raw  = atob(data.content.replace(/\n/g, ''));
  return new TextDecoder('utf-8').decode(Uint8Array.from(raw, c => c.charCodeAt(0)));
}

function clearChat() {
  chatHistory = [];
  if (currentSession) { currentSession.messages = []; saveCurrentSession(); }
  const histEl = document.getElementById('chat-history');
  histEl.innerHTML = '';
  appendChatBubble('ai', WELCOME_MSG);
  attachedFiles = []; renderFileChips();
}

// ---- Session init ----
(function initSession() {
  const sessions = getSessions();
  if (sessions.length > 0) {
    currentSession = { ...sessions[0] };
    chatHistory = sessions[0].messages ? [...sessions[0].messages] : [];
  } else {
    currentSession = { id: Date.now().toString(), title: '新しい会話', messages: [] };
    chatHistory = [];
  }
  renderChatPanel();
})();

// ---- Popup Chat Logic ----
let isPopupOpen = false;

function toggleAiPopup() {
  const container = document.getElementById('ai-popup-container');
  isPopupOpen = !isPopupOpen;
  container.classList.toggle('open', isPopupOpen);
  
  if (isPopupOpen) {
    // 最新の情報を反映
    document.getElementById('ai-popup-title').textContent = getAiName();
    const avatar = getAiAvatar();
    if (avatar) document.getElementById('ai-popup-avatar').src = avatar;
    
    syncPopupHistory();
    document.getElementById('ai-popup-input').focus();
  }
}

function syncPopupHistory() {
  const histEl = document.getElementById('ai-popup-history');
  histEl.innerHTML = '';
  
  if (chatHistory.length === 0) {
    appendPopupBubble('ai', WELCOME_MSG);
  } else {
    chatHistory.forEach(msg => {
      appendPopupBubble(msg.role === 'user' ? 'user' : 'ai', msg.content);
    });
  }
}

function appendPopupBubble(role, text) {
  const histEl = document.getElementById('ai-popup-history');
  const div = document.createElement('div');
  div.className = `chat-bubble ${role}`;
  div.style.fontSize = '0.78rem';
  div.style.padding = '8px 12px';
  
  if (role === 'ai') {
    const avatarUrl = getAiAvatar();
    if (avatarUrl) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.style = "width:36px; height:36px; border-radius:50%; object-fit:cover; border:1px solid #fff; flex-shrink:0;";
      div.appendChild(img);
    }
    const contentSpan = document.createElement('span');
    contentSpan.style.color = '#fff';
    contentSpan.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
    div.appendChild(contentSpan);
  } else {
    div.textContent = text;
    div.style.color = '#fff';
  }
  
  histEl.appendChild(div);
  histEl.scrollTop = histEl.scrollHeight;
}

async function sendPopupChat() {
  const input = document.getElementById('ai-popup-input');
  const text = input.value.trim();
  if (!text) return;
  
  const geminiKey = getGeminiKey();
  if (!geminiKey) {
    alert('⚙️ 設定から Gemini API キー を先に設定してください。');
    return;
  }

  input.value = '';
  appendPopupBubble('user', text);
  chatHistory.push({ role: 'user', content: text });
  saveCurrentSession();
  
  // メイン画面のヒストリも更新（もし開いていれば）
  if (document.getElementById('chat-history')) {
    appendChatBubble('user', text);
  }

  const thinking = document.createElement('div');
  thinking.className = 'chat-bubble ai thinking';
  thinking.style.fontSize = '0.78rem';
  thinking.textContent = '...';
  document.getElementById('ai-popup-history').appendChild(thinking);

  const aiName = getAiName();
  const persona = getAiPrompt();
  let sys = `あなたは「${aiName}」として振る舞ってください。人格・口調設定：${persona}\n日本語で回答してください。`;

  try {
    const reply = await callGemini(chatHistory, sys);
    thinking.remove();
    appendPopupBubble('ai', reply);
    chatHistory.push({ role: 'assistant', content: reply });
    saveCurrentSession();
    
    if (document.getElementById('chat-history')) {
      appendChatBubble('ai', reply);
    }
  } catch (e) {
    thinking.remove();
    let errMsg = `Error: ${e.message}`;
    if (e.message.includes('無料枠')) {
      errMsg = 'ごめんね主くん、今はちょっと魔法の力が足りひんみたいやわ。しばらく待ってから、また声かけてくれるかな？';
    }
    appendPopupBubble('ai', errMsg);
  }
}

// Enterで送信
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'ai-popup-input' && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendPopupChat();
  }
});


