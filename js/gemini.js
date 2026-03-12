// =====================
// Gemini API 連携ユーティリティ
// =====================

/**
 * Gemini API を呼び出す
 * @param {string} prompt - 送信するプロンプト
 * @param {string} systemInstruction - システム指示（オプション）
 * @returns {Promise<string>} AI の回答
 */
async function callGemini(prompt, systemInstruction = "") {
  const key = getGeminiKey();
  if (!key) {
    throw new Error('Gemini APIキーが設定されていません。設定画面から登録してください。');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ]
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
    throw new Error(err.error?.message || `Gemini API エラー: ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
