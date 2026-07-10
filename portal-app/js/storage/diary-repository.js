/**
 * Diary Repository (File-based)
 * 依存関係: js/storage/github-storage.js
 */

window.DiaryRepository = {
  /**
   * 指定した日付の日記を取得する
   * @param {string} dateISO - YYYY-MM-DD
   */
  async getDiary(dateISO) {
    const path = `vault/diary/${dateISO}.md`;
    try {
      const result = await GitHubStorage.getFile(path);
      if (!result) return null;
      return {
        path: path,
        content: result.content,
        sha: result.sha
      };
    } catch (e) {
      console.error(`Diary取得失敗 (${dateISO}):`, e);
      return null;
    }
  },

  /**
   * 日記を保存する
   * @param {string} dateISO - YYYY-MM-DD
   * @param {string} content - 内容
   * @param {string} sha - 既存ファイルのSHA
   */
  async saveDiary(dateISO, content, sha) {
    const path = `vault/diary/${dateISO}.md`;
    const message = sha ? `📝 日記更新: ${dateISO}` : `🆕 日記作成: ${dateISO}`;
    return await GitHubStorage.saveFile(path, content, message);
  }
};
