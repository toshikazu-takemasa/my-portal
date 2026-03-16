// =====================
// AI Ticker Logic
// =====================

const TICKER_CACHE_KEY = 'ai_ticker_cache';
const TICKER_DATE_KEY  = 'ai_ticker_date';

// ページング管理用
let tickerPages = [];
let tickerCurrentPage = 0;

function splitTickerIntoPages(text) {
  const MAX_CHARS = 40; // ティッカーエリアに収まる程度の文字数
  const pages = [];
  let s = text;
  while (s.length > MAX_CHARS) {
    pages.push(s.slice(0, MAX_CHARS));
    s = s.slice(MAX_CHARS);
  }
  if (s) pages.push(s);
  return pages;
}

function showTickerPage(idx) {
  const tickerTextEl = document.getElementById('ai-ticker-text');
  if (!tickerTextEl) return;
  tickerTextEl.textContent = tickerPages[idx] || '';
  tickerTextEl.classList.add('visible');
  
  // 次のページがあるかのインジケータ（任意で追加可能）
  const container = tickerTextEl.parentElement;
  if (idx < tickerPages.length - 1) {
    container.classList.add('has-next');
  } else {
    container.classList.remove('has-next');
  }
}

function advanceTickerPage() {
  if (tickerCurrentPage < tickerPages.length - 1) {
    tickerCurrentPage++;
    showTickerPage(tickerCurrentPage);
  }
}

/**
 * AIティッカーを初期化し、メッセージを表示する
 */
async function initAiTicker(force = false) {
  const tickerTextEl = document.getElementById('ai-ticker-text');
  const avatarEl = document.getElementById('ai-ticker-avatar');
  const container = document.querySelector('.ai-ticker-container');
  if (!tickerTextEl) return;

  // クリックイベントの設定（一度だけ）
  if (container && !container.dataset.listenerAdded) {
    container.addEventListener('click', advanceTickerPage);
    container.dataset.listenerAdded = 'true';
    container.style.cursor = 'pointer';
  }

  // アバターの反映
  const avatarUrl = getAiAvatar();
  if (avatarEl && avatarUrl) {
    avatarEl.src = avatarUrl;
    avatarEl.style.display = 'block';
  }

  // キャッシュの確認
  const today = new Date().toISOString().split('T')[0];
  const cachedDate = localStorage.getItem(TICKER_DATE_KEY);
  const cachedMsg  = localStorage.getItem(TICKER_CACHE_KEY);

  if (!force && cachedDate === today && cachedMsg) {
    tickerPages = splitTickerIntoPages(cachedMsg);
    tickerCurrentPage = 0;
    showTickerPage(0);
    return;
  }

  tickerTextEl.textContent = "考え中...";
  tickerTextEl.classList.remove('visible');

  try {
    const context = await fetchLatestContext();
    const persona = getAiPrompt();
    const aiName = getAiName();
    
    const prompt = `
以下の日記やナレッジの記録を参考に、今日の始まりにふさわしい、ポジティブでやる気が出るような一言を生成してください。
ユーザーはこのポータルを「朝一番」に見ることが多いです。

## あなたの設定
名前: ${aiName}
性格・口調: ${persona}

## 制約
- 短すぎず長すぎず、**30文字〜60文字程度**で。
- 余計な説明（「生成しました」など）は省き、メッセージのみを出力してください。
- 日本語で。設定された口調（例：関西弁）を忠実に守ってください。
- 絵文字を1つ使ってください。

## 情報（日記・ナレッジの一部）
${context}
`;
    // AIにリクエスト
    const message = (await callGemini(prompt, `あなたは${aiName}です。${persona}`)).trim();
    
    // キャッシュ保存
    localStorage.setItem(TICKER_CACHE_KEY, message);
    localStorage.setItem(TICKER_DATE_KEY, today);

    // 表示
    tickerPages = splitTickerIntoPages(message);
    tickerCurrentPage = 0;
    showTickerPage(0);

  } catch (e) {
    console.error('AI Ticker Error:', e);
    const fallback = "今日も素晴らしい一日になりますように！✨";
    tickerPages = splitTickerIntoPages(cachedMsg || fallback);
    tickerCurrentPage = 0;
    showTickerPage(0);
  }
}

/**
 * メッセージを強制的に再生成する
 */
async function refreshAiTicker() {
  const btn = document.getElementById('ai-ticker-refresh');
  if (btn) btn.disabled = true;
  await initAiTicker(true);
  if (btn) btn.disabled = false;
}

/**
 * 日記やナレッジから最新の情報を数件取得して文字列にする
 */
async function fetchLatestContext() {
  const token = getToken();
  const repo  = getRepo();
  if (!token || !repo) return "（記録がまだありません）";

  let contextParts = [];

  try {
    // 1. 最新の日記を取得 (直近3日分くらい)
    const diaryRes = await fetch(`https://api.github.com/repos/${repo}/contents/日記`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (diaryRes.ok) {
      const files = await diaryRes.json();
      // 日付順にソートして最新3つ
      const latestDiaries = files
        .filter(f => f.name.endsWith('.md'))
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(0, 3);

      for (const file of latestDiaries) {
        const content = await fetchFileContent(file.path);
        contextParts.push(`### 日記: ${file.name}\n${content.slice(0, 300)}...`);
      }
    }

    // 2. ナレッジから1つ取得
    const knowledgeRes = await fetch(`https://api.github.com/repos/${repo}/contents/ナレッジ`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (knowledgeRes.ok) {
      const files = await knowledgeRes.json();
      const latestKnowledge = files
        .filter(f => f.name.endsWith('.md'))
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(0, 1);

      for (const file of latestKnowledge) {
        const content = await fetchFileContent(file.path);
        contextParts.push(`### ナレッジ: ${file.name}\n${content.slice(0, 300)}...`);
      }
    }
  } catch (e) {
    console.warn('Context fetch error:', e);
  }

  return contextParts.join('\n\n');
}

/**
 * GitHub APIでファイルの内容を取得
 */
async function fetchFileContent(path) {
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

// ページ読み込み完了後に実行
window.addEventListener('DOMContentLoaded', () => {
  if (getToken() && getRepo() && getGeminiKey()) {
    initAiTicker();
  }
});
