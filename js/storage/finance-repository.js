/**
 * Finance Repository (File-based)
 * 依存関係: js/storage/github-storage.js
 */

window.FinanceRepository = {
  /**
   * 指定した年月の家計データを取得する
   * @param {string} ym - YYYY-MM
   */
  async getRecords(ym) {
    const path = `vault/finance/${ym}.json`;
    try {
      const result = await GitHubStorage.getFile(path);
      if (!result) return [];
      const data = JSON.parse(result.content);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error(`Finance取得失敗 (${ym}):`, e);
      return [];
    }
  },

  /**
   * 家計データを保存する
   * @param {string} ym - YYYY-MM
   * @param {Array} records - レコード配列
   */
  async saveRecords(ym, records) {
    const path = `vault/finance/${ym}.json`;
    await GitHubStorage.saveFile(path, JSON.stringify(records, null, 2), `💰 家計データ更新: ${ym}`);
  }
};
