/**
 * Task Domain Service
 * 依存関係: js/storage/task-repository.js
 */

window.TaskService = {
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
