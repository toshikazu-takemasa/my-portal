/**
 * Config Repository (File-based)
 * 依存関係: js/storage/github-storage.js
 */

const CONFIG_PATH = 'vault/config.json';

window.ConfigRepository = {
  /**
   * 設定ファイルを読み込む
   */
  async loadConfig() {
    try {
      const result = await GitHubStorage.getFile(CONFIG_PATH);
      if (!result) return null;
      return JSON.parse(result.content);
    } catch (e) {
      if (e instanceof GitHubAuthError) throw e;
      console.error('Config読み込み失敗:', e);
      return null;
    }
  },

  /**
   * 設定ファイルを保存する
   */
  async saveConfig(data, message = '⚙️ 設定更新') {
    await GitHubStorage.saveFile(CONFIG_PATH, JSON.stringify(data, null, 2), message);
  }
};
