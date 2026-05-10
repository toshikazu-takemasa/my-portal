/**
 * Gemini API 連携ユーティリティ
 * Tool Use (Function Calling) 対応版
 */

/**
 * Gemini API を呼び出す
 * @param {Array} contents - 会話履歴（Gemini 形式: [{role: 'user'|'model', parts: [{text: '...'}|{functionCall: '...'}]}]）
 * @param {string} systemInstruction - システム指示
 * @param {Array} tools - ツール定義（ToolDefinitions）
 * @returns {Promise<Object>} APIレスポンス全体
 */
async function callGeminiRaw(contents, systemInstruction = "", tools = null) {
  const key = getGeminiKey();
  if (!key) throw new Error('Gemini APIキーが設定されていません。');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

  const requestBody = {
    contents: contents,
    generationConfig: { maxOutputTokens: 2048 }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  if (tools) {
    requestBody.tools = tools;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API ${res.status}: ${err.error?.message || '不明なエラー'}`);
  }

  return await res.json();
}

/**
 * 旧来の callGemini との互換性を維持しつつ、使いやすくラップしたもの
 */
async function callGemini(promptOrHistory, systemInstruction = "") {
  let contents = [];
  if (Array.isArray(promptOrHistory)) {
    contents = promptOrHistory.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  } else {
    contents = [{ role: 'user', parts: [{ text: promptOrHistory }] }];
  }

  const data = await callGeminiRaw(contents, systemInstruction);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

window.callGeminiRaw = callGeminiRaw;
window.callGemini = callGemini;
