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

    // 3. アーキテクチャ全体像（ハンドブックの overview。2026-08-15 に ADR 運用を廃止し、
    //    「最新ADR先頭300字」の注入をやめた——最新の1件だけでは全体像にならないため）。
    //    ドキュメントは本リポジトリ docs/architecture/ にあるので、PAT 不要の相対 fetch で読む
    try {
      const res = await fetch('../docs/architecture/README.md');
      if (res.ok) {
        const text = await res.text();
        contextParts.push(`### アプリの全体像（設計ドキュメントの抜粋）:\n${text.slice(0, 1200)}...`);
      }
    } catch (e) { console.warn('Architecture context fetch error:', e); }

    return contextParts.join('\n\n');
  }
};
