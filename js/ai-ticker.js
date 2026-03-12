// =====================
// AI Ticker Logic
// =====================

/**
 * AIティッカーを初期化し、メッセージを表示する
 */
async function initAiTicker() {
  const tickerTextEl = document.getElementById('ai-ticker-text');
  if (!tickerTextEl) return;

  try {
    const context = await fetchLatestContext();
    const prompt = `
以下の日記やナレッジの記録を参考に、今日の始まりにふさわしい、ポジティブでやる気が出るような一言を生成してください。
ユーザーはこのポータルを「朝一番」に見ることが多いです。
これまでの活動を肯定し、今日という日を前向きに捉えられるような言葉を選んでください。

## 制約
- 60文字以内で簡潔に。
- 余計な説明（「生成しました」など）は省き、メッセージのみを出力してください。
- 日本語で。
- 絵文字を1つ使ってください。

## 情報（日記・ナレッジの一部）
${context}
`;
    // AIにリクエスト
    const message = await callGemini(prompt, "あなたは利用者を励まし、モチベーションを高めるコーチです。");
    
    // 表示
    tickerTextEl.textContent = message.trim();
    tickerTextEl.classList.add('visible');
  } catch (e) {
    console.error('AI Ticker Error:', e);
    tickerTextEl.textContent = "今日も素晴らしい一日になりますように！✨";
    tickerTextEl.classList.add('visible');
  }
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
