/**
 * Memo Repository
 * 依存関係: js/storage/github-storage.js
 */

const MEMO_PATH = 'vault/task/memo.md';

window.MemoRepository = {
  async load() {
    const result = await GitHubStorage.getFile(MEMO_PATH);
    return result ? result.content : '';
  },

  async save(content) {
    await GitHubStorage.saveFile(MEMO_PATH, content, '📝 メモを更新');
  }
};
