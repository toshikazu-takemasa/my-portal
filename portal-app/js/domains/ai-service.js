/**
 * AI Domain Service
 * 依存関係: js/storage/github-storage.js, js/domains/task-service.js
 */

window.AiService = {
  /**
   * AIに渡す最新の文脈（日記、タスク等）を収集して文字列にする
   */
  async getLatestContext() {
    const contextParts = [];

    // 1. 直近の日記（当月の日別 + 年ディレクトリ内の月次まとめ / ADR-035 決定事項3）
    try {
      const latestDiaries = await DiaryRepository.listEntries(3);

      for (const file of latestDiaries) {
        const result = await GitHubStorage.getFile(file.path);
        if (result) {
          contextParts.push(`### 日記: ${file.name}\n${result.content.slice(0, 500)}...`);
        }
      }
    } catch (e) { console.warn('Diary context fetch error:', e); }

    // 2. 現在のタスク
    try {
      const tasks = await TaskService.getActiveTasks();
      const taskStr = tasks.map(t => `- [ ] ${t.title} (${t.priority || 'P2'})`).join('\n');
      contextParts.push(`### アクティブなタスク:\n${taskStr || 'なし'}`);
    } catch (e) { console.warn('Task context fetch error:', e); }

    // 3. ADR (設計意図) - 最新のもの
    try {
      const adrFiles = await GitHubStorage.listFiles('vault/docs/adr');
      const latestAdr = adrFiles
        // 連番のADRのみ（INDEX.md のような索引を「最新の決定」と誤認しないため）
        .filter(f => /^\d{3}.*\.md$/.test(f.name))
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(0, 1);
      
      if (latestAdr.length > 0) {
        const result = await GitHubStorage.getFile(latestAdr[0].path);
        contextParts.push(`### 最新の設計決定(ADR):\n${result.content.slice(0, 300)}...`);
      }
    } catch (e) { }

    return contextParts.join('\n\n');
  }
};
