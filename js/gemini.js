// =====================
// Gemini API 連携ユーティリティ
// =====================

/**
 * Gemini API を呼び出す
 * @param {string|Array} promptOrHistory - 送信するプロンプト、または会話履歴（[{role, content}]）
 * @param {string} systemInstruction - システム指示（オプション）
 * @returns {Promise<string>} AI の回答
 */
async function callGemini(promptOrHistory, systemInstruction = "") {
  const key = getGeminiKey();
  if (!key) {
    throw new Error('Gemini APIキーが設定されていません。設定画面から登録してください。');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

  let contents = [];
  if (Array.isArray(promptOrHistory)) {
    // role 'assistant' を Gemini用の 'model' に変換
    contents = promptOrHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  } else {
    contents = [
      {
        role: 'user',
        parts: [{ text: promptOrHistory }]
      }
    ];
  }

  const requestBody = {
    contents: contents
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [
        { text: systemInstruction }
      ]
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.error?.message || '';
    if (res.status === 429) {
      throw new Error(`Gemini API 429: ${detail || 'クォータ超過またはレート制限'}`);
    }
    throw new Error(`Gemini API ${res.status}: ${detail || 'エラーが発生しました'}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
