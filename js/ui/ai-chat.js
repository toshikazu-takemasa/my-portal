// =====================
// AI アシスタント
// =====================
const SESSIONS_KEY = 'chat_sessions';
const WELCOME_MSG  = '今日も一緒に頑張ろな🌙 何でも気軽に話しかけてな！';

let chatHistory   = [];
let reflectResult = '';
let currentSession = null;   // { id, title, messages }
let attachedFiles  = [];     // [{ path, content, sha }]
const applyBlocks  = new Map(); // blockId → { path, content }

// VN テキストページング
let vnPages       = [];
let vnCurrentPage = 0;
let vnIsTyping    = false;
let vnTypingTimer = null;

function splitIntoVnPages(text) {
  const MAX_CHARS = 60; // 1行あたり30文字前後×2行を想定
  // 句読点、感嘆符、改行で分割
  let segs = text.split(/(?<=[。！？\n])/g).filter(s => s.length > 0);
  const pages = [];
  let cur = '';

  for (let s of segs) {
    // セグメント自体が長い場合は強制分割
    while (s.length > MAX_CHARS) {
      if (cur.length > 0) {
        pages.push(cur.trim());
        cur = '';
      }
      pages.push(s.slice(0, MAX_CHARS).trim());
      s = s.slice(MAX_CHARS);
    }

    if (cur.length + s.length > MAX_CHARS && cur.length > 0) {
      pages.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) pages.push(cur.trim());
  
  if (pages.length === 0 && text.trim().length > 0) {
    pages.push(text.trim());
  }
  return pages;
}

function typeWriterEffect(element, text, callback) {
  vnIsTyping = true;
  let i = 0;
  element.textContent = '';
  
  const indicator = document.getElementById('vn-advance-indicator');
  if (indicator) indicator.style.display = 'none';

  function type() {
    if (i < text.length) {
      element.append(text.charAt(i));
      i++;
      vnTypingTimer = setTimeout(type, 30); // 30ms間隔
    } else {
      vnIsTyping = false;
      if (callback) callback();
    }
  }
  type();
}

function showVnPage(idx) {
  const textEl = document.getElementById('vn-dialogue-text');
  const indicator = document.getElementById('vn-advance-indicator');
  if (!textEl) return;

  if (vnTypingTimer) clearTimeout(vnTypingTimer);
  
  typeWriterEffect(textEl, vnPages[idx] || '', () => {
    if (indicator) {
      indicator.style.display = 'block';
      if (idx < vnPages.length - 1) {
        indicator.setAttribute('data-last', 'false');
      } else {
        indicator.setAttribute('data-last', 'true');
      }
    }
  });
}

function advanceVnText() {
  const box = document.getElementById('vn-dialogue-box');
  if (box && box.classList.contains('thinking')) return; // 考え中は無視

  if (vnIsTyping) {
    if (vnTypingTimer) clearTimeout(vnTypingTimer);
    vnIsTyping = false;
    const textEl = document.getElementById('vn-dialogue-text');
    const indicator = document.getElementById('vn-advance-indicator');
    if (textEl) textEl.textContent = vnPages[vnCurrentPage] || '';
    if (indicator && vnCurrentPage < vnPages.length - 1) indicator.style.display = 'block';
    return;
  }

  if (vnCurrentPage < vnPages.length - 1) {
    vnCurrentPage++;
    showVnPage(vnCurrentPage);
  }
}

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

  const portrait = document.getElementById('vn-portrait-img');
  const nameTag  = document.getElementById('vn-ai-name-tab');
  if (portrait) portrait.src = getAiAvatar() || '';
  if (nameTag)  nameTag.textContent = getAiName();

  const logEl = document.getElementById('vn-user-log');
  if (logEl) logEl.innerHTML = '';

  const wrap = document.querySelector('.chat-wrap.vn-mode');
  if (wrap) {
    wrap.querySelectorAll('.chat-bubble').forEach(b => b.remove());
  }

  if (chatHistory.length === 0) {
    appendChatBubble('ai', WELCOME_MSG);
  } else {
    let lastAi = null;
    chatHistory.forEach(msg => {
      if (msg.role === 'user') appendChatBubble('user', msg.content);
      else if (msg.role === 'assistant' || msg.role === 'model') lastAi = msg.content;
    });
    appendChatBubble('ai', lastAi || WELCOME_MSG);
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
  const path = prompt('ファイルパスを入力\n例: vault/knowledge/memo.md');
  if (!path) return;
  await fetchFileForAttach(path.trim());
}

async function fetchFileForAttach(path) {
  try {
    const res = await GitHubStorage.getFile(path);
    if (!res) { alert(`ファイルが見つかりません:\n${path}`); return; }
    attachedFiles = attachedFiles.filter(f => f.path !== path);
    attachedFiles.push({ path, content: res.content, sha: res.sha });
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

// ---- Message rendering ----
function appendChatBubble(role, text) {
  if (role.includes('ai')) {
    const box    = document.getElementById('vn-dialogue-box');
    const textEl = document.getElementById('vn-dialogue-text');
    if (!box || !textEl) return null;

    const isThinking = role.includes('thinking');
    box.classList.toggle('thinking', isThinking);
    if (isThinking) {
      textEl.textContent = '考え中…';
      const indicator = document.getElementById('vn-advance-indicator');
      if (indicator) indicator.style.display = 'none';
    } else {
      vnPages = splitIntoVnPages(text);
      vnCurrentPage = 0;
      showVnPage(0);
    }
    return box;
  } else {
    const logEl = document.getElementById('vn-user-log');
    if (!logEl) return null;
    const entry = document.createElement('div');
    entry.className = 'vn-user-entry';
    entry.textContent = text;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
    return entry;
  }
}

// ---- Agentic Send Chat ----
async function sendChat() {
  const geminiKey = getGeminiKey();
  if (!geminiKey) { alert('⚙️ 設定から Gemini API キー を先に設定してください。'); return; }
  
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

利用可能なポータル機能（ツールを使って実行してください）：
- ファイルの保存・読込・一覧取得（日記やナレッジ管理）
- タスクの追加・更新・取得（リポジトリ内の tasks.json を管理）
- 日記の統合・エクスポート

## 応答スタイル
- 設定された口調を忠実に守ってください。
- ファイルの作成や更新を行ったら、必ずその旨を報告してください。
- ユーザーに確認が必要な場合は、ツールを実行する前に問いかけてください。`;

  if (includeReport || includeKnowledge) {
    const latest = await AiService.getLatestContext();
    sys += `\n\n## 現在のコンテキスト\n${latest}`;
  }
  
  if (attachedFiles.length > 0) {
    sys += '\n\n## 添付ファイル:';
    attachedFiles.forEach(f => { sys += `\n\n### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``; });
  }

  let currentContents = chatHistory.map(msg => ({
    role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  try {
    let loop = true;
    let maxIter = 5;
    let finalReply = "";

    while (loop && maxIter-- > 0) {
      const data = await callGeminiRaw(currentContents, sys, ToolDefinitions);
      const message = data.candidates?.[0]?.content;
      if (!message) break;

      currentContents.push(message);

      const toolCalls = message.parts.filter(p => p.functionCall);
      if (toolCalls.length > 0) {
        const responses = [];
        for (const call of toolCalls) {
          const result = await ToolDispatcher.dispatch(call.functionCall.name, call.functionCall.args);
          responses.push({
            functionResponse: {
              name: call.functionCall.name,
              response: { result: result }
            }
          });
        }
        currentContents.push({ role: 'user', parts: responses });
      } else {
        loop = false;
        finalReply = message.parts.map(p => p.text).join('') || '';
      }
    }
    
    thinking.classList.remove('thinking');
    if (finalReply) {
      vnPages = splitIntoVnPages(finalReply);
      vnCurrentPage = 0;
      showVnPage(0);
      chatHistory.push({ role: 'assistant', content: finalReply });
      saveCurrentSession();
    }
  } catch (e) {
    console.error('Chat Error:', e);
    let errMsg = `エラー: ${e.message}`;
    thinking.classList.remove('thinking');
    const textEl = document.getElementById('vn-dialogue-text');
    if (textEl) textEl.textContent = errMsg;
    chatHistory.pop();
  } finally { btn.disabled = false; input.focus(); }
}

function clearChat() {
  chatHistory = [];
  if (currentSession) { currentSession.messages = []; saveCurrentSession(); }
  const logEl = document.getElementById('vn-user-log');
  if (logEl) logEl.innerHTML = '';
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

function switchChatSession(id) { loadSession(id); }

window.sendChat = sendChat;
window.clearChat = clearChat;
window.newChatSession = newChatSession;
window.switchChatSession = switchChatSession;
window.toggleSessionDropdown = toggleSessionDropdown;
window.advanceVnText = advanceVnText;
window.promptFileAttach = promptFileAttach;
window.initChat = function() { renderChatPanel(); };
