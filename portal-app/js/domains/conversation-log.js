/**
 * ConversationLog — アバターとの会話を逐次・全文で記録する（ADR-035 決定事項2）
 *
 * 方針:
 *   - 要約しない。表示した発話をそのまま追記する。
 *   - AI の save_file 任せにせず、アプリが1往復ごとに追記する（記録漏れを構造的に防ぐ）。
 *   - 保存先は 1日1ファイル: vault/conversations/YYYY-MM-DD_アバター会話.md
 *   - 書き込みに失敗しても会話は止めない。localStorage のキューに積んで次回フラッシュする。
 *
 * 依存: js/storage/github-storage.js, js/core/config.js (getJstTodayISO)
 */

const CONV_QUEUE_KEY   = 'conversation_log_queue';
const CONV_SESSION_KEY = 'conversation_log_last_session';

window.ConversationLog = {
  _flushing: false,

  /** 保存先パス（1日1ファイル） */
  path(dateISO) {
    return `vault/conversations/${dateISO || getJstTodayISO()}_アバター会話.md`;
  },

  /** JST の HH:MM */
  _now() {
    return new Date().toLocaleTimeString('ja-JP', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo'
    });
  },

  _queue() {
    try { return JSON.parse(localStorage.getItem(CONV_QUEUE_KEY) || '[]'); }
    catch (e) { return []; }
  },

  _setQueue(q) {
    localStorage.setItem(CONV_QUEUE_KEY, JSON.stringify(q.slice(-200)));
  },

  /**
   * 発話を1件キューに積む（送信はしない）。
   * @param {{role: 'user'|'ai', text: string, speaker?: string, expression?: string,
   *          feedback?: 'close'|'more'|'free'|'other', sessionId?: string, sessionTitle?: string}} entry
   *   feedback はユーザー発話の評価種別（ADR-041 決定6）。AI 発話では使わない。
   */
  enqueue(entry) {
    if (!entry || !entry.text || !String(entry.text).trim()) return;
    const q = this._queue();
    q.push({
      date: getJstTodayISO(),
      at: this._now(),
      role: entry.role,
      speaker: entry.speaker || (entry.role === 'user' ? 'ユーザー' : 'AI'),
      text: String(entry.text),
      expression: entry.expression || '',
      feedback: entry.feedback || '',
      sessionId: entry.sessionId || '',
      sessionTitle: entry.sessionTitle || ''
    });
    this._setQueue(q);
  },

  /**
   * 1件を Markdown ブロックにする（要約せず全文）。
   * 括弧の中身は、ユーザー発話なら評価種別、AI 発話なら表情。
   *   **[14:01] ユーザー（close）:**
   *   **[14:01] はやて（worried）:**
   */
  _render(entry) {
    const tag = entry.role === 'user' ? entry.feedback : entry.expression;
    return `**[${entry.at}] ${entry.speaker}${tag ? `（${tag}）` : ''}:**\n${entry.text.trim()}\n`;
  },

  /**
   * キューを GitHub へ書き出す。日付ごとにまとめて1ファイル1リクエストで追記する。
   * PAT 未設定・通信失敗時はキューを残して次回に回す。
   */
  async flush() {
    if (this._flushing) return;
    const queued = this._queue();
    if (queued.length === 0) return;
    if (typeof getToken !== 'function' || !getToken() || !getRepo()) return;

    this._flushing = true;
    try {
      // 日付ごとにグループ化（日付をまたいだまま溜まっていても正しい日のファイルへ入る）
      const byDate = queued.reduce((acc, e) => {
        (acc[e.date] = acc[e.date] || []).push(e);
        return acc;
      }, {});

      const failed = [];
      for (const [date, entries] of Object.entries(byDate)) {
        try {
          await this._appendToFile(date, entries);
        } catch (e) {
          console.warn(`会話ログの追記に失敗しました（${date}）:`, e);
          failed.push(...entries);
        }
      }
      this._setQueue(failed);
    } finally {
      this._flushing = false;
    }
  },

  async _appendToFile(date, entries) {
    const path = this.path(date);
    const existing = await GitHubStorage.getFile(path).catch(() => null);

    let body = existing ? existing.content.replace(/\s*$/, '') : `# ${date} アバター会話ログ\n\n> 要約せず、発話をそのまま時系列で記録しています（ADR-035）。`;

    let lastSession = localStorage.getItem(CONV_SESSION_KEY) || '';
    let out = '';

    for (const entry of entries) {
      // セッションが切り替わったら見出しを打つ
      if (entry.sessionId && entry.sessionId !== lastSession) {
        const title = entry.sessionTitle || '会話';
        out += `\n\n## ${title}（${entry.at}〜）\n`;
        lastSession = entry.sessionId;
      }
      out += `\n${this._render(entry)}`;
    }

    // 既存ファイルに当該セッション見出しが無い場合（別端末で書かれた等）でも、
    // 追記そのものは常に成立させる。見出しの重複は許容する。
    await GitHubStorage.saveFile(
      path,
      `${body}${out}\n`,
      `💬 会話ログ追記: ${date}`
    );
    localStorage.setItem(CONV_SESSION_KEY, lastSession);
  },

  /** 1往復（ユーザー発話 + AI 応答）を記録して即フラッシュする */
  async record(entries) {
    entries.forEach(e => this.enqueue(e));
    await this.flush();
  }
};

// 起動時に前回の失敗分を流す
window.addEventListener('portal-config-loaded', () => {
  window.ConversationLog.flush().catch(e => console.warn('会話ログのフラッシュに失敗:', e));
});
