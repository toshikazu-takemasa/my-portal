/**
 * Task Domain Service
 * 依存関係: js/storage/task-repository.js, js/storage/memo-repository.js
 */

window.TaskService = {
  /**
   * 「今日のリマインド」を取得する（ADR-033 決定事項1）
   *
   * デイリーチェックリストの未完了項目と vault/task/memo.md の未チェック行のみを返す。
   * tasks.json の P1〜P3 バックログは意図的に含めない（そちらは getActiveTasks が担当）。
   * 「今日のタスクは？」に積み残しバックログが混入するのを防ぐのが目的。
   */
  async getTodayReminders() {
    const [checklist, memo] = [this.getUncheckedDailyTasks(), await this.getUncheckedMemoLines()];
    return {
      checklist,
      memo,
      note: checklist.length === 0 && memo.length === 0
        ? '今日のチェックリスト・メモの積み残しはありません'
        : undefined
    };
  },

  /**
   * デイリーチェックリストの未完了項目（当日の localStorage チェック状態を参照）
   */
  getUncheckedDailyTasks() {
    let tasks = [];
    if (typeof dailyTasks !== 'undefined' && Array.isArray(dailyTasks) && dailyTasks.length > 0) {
      tasks = dailyTasks;                                   // daily-checklist.js がロード済みの値
    } else if (window.PORTAL_CONFIG_INLINE && window.PORTAL_CONFIG_INLINE.dailyTasks) {
      tasks = window.PORTAL_CONFIG_INLINE.dailyTasks;
    } else if (typeof ConfigService !== 'undefined' && ConfigService.data && ConfigService.data.dailyTasks) {
      tasks = ConfigService.data.dailyTasks;
    }

    // work-vault 形式 (label) と my-portal 形式 (title) の両方に対応
    return tasks
      .map(t => ((t.label || t.title) || '').trim())
      .filter(title => title && localStorage.getItem(`daily-task-${title}`) !== 'true');
  },

  /**
   * vault/task/memo.md の未チェック行（`- [ ]`）
   */
  async getUncheckedMemoLines() {
    if (typeof MemoRepository === 'undefined') return [];
    try {
      const md = await MemoRepository.load();
      return md.split('\n')
        .map(line => line.match(/^\s*[-*]\s*\[ \]\s*(.+)$/))
        .filter(Boolean)
        .map(m => m[1].trim())
        .filter(Boolean);
    } catch (e) {
      console.warn('memo.md の読み込みに失敗しました:', e);
      return [];
    }
  },

  /**
   * 未完了のタスク一覧を取得する
   */
  async getActiveTasks() {
    const tasks = await TaskRepository.getAllTasks();
    return tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
  },

  /**
   * 「今日やるべき」タスク（P1）を取得する
   */
  async getTodayTasks() {
    const tasks = await this.getActiveTasks();
    return tasks.filter(t => t.priority === 'P1');
  },

  /**
   * キーワード検索
   */
  async searchTasks(query) {
    const tasks = await TaskRepository.getAllTasks();
    const q = query.toLowerCase();
    return tasks.filter(t => 
      t.title.toLowerCase().includes(q) || 
      (t.description && t.description.toLowerCase().includes(q))
    );
  },

  /**
   * タスクを完了状態にする
   */
  async completeTask(id) {
    return await TaskRepository.updateTask(id, { 
      status: 'done', 
      closedAt: new Date().toISOString() 
    });
  }
};
