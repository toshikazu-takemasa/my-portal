/**
 * Task Repository (File-based)
 * 依存関係: js/storage/github-storage.js
 */

const TASKS_PATH = 'vault/tasks.json';

window.TaskRepository = {
  /**
   * 全タスクを取得する
   * @returns {Promise<Array>}
   */
  async getAllTasks() {
    try {
      const result = await GitHubStorage.getFile(TASKS_PATH);
      if (!result) return [];
      const data = JSON.parse(result.content);
      return data.tasks || [];
    } catch (e) {
      console.error('Task取得失敗:', e);
      return [];
    }
  },

  /**
   * タスクを保存（一括更新）する
   * @param {Array} tasks - 保存するタスク配列
   * @returns {Promise<void>}
   */
  async saveAllTasks(tasks) {
    const data = {
      tasks: tasks,
      lastSync: new Date().toISOString()
    };
    await GitHubStorage.saveFile(TASKS_PATH, JSON.stringify(data, null, 2), '📅 タスクリストを更新');
  },

  /**
   * 単一のタスクを追加する
   * @param {Object} taskData - 追加するタスクのデータ
   */
  async addTask(taskData) {
    const tasks = await this.getAllTasks();
    const newTask = {
      id: Date.now().toString(),
      status: 'todo',
      priority: 'P2',
      labels: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...taskData
    };
    tasks.unshift(newTask);
    await this.saveAllTasks(tasks);
    return newTask;
  },

  /**
   * タスクを更新する
   * @param {string} id - タスクID
   * @param {Object} updates - 更新内容
   */
  async updateTask(id, updates) {
    const tasks = await this.getAllTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('タスクが見つかりません');
    
    tasks[idx] = {
      ...tasks[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await this.saveAllTasks(tasks);
    return tasks[idx];
  },

  /**
   * タスクを削除する
   * @param {string} id - タスクID
   */
  async deleteTask(id) {
    const tasks = await this.getAllTasks();
    const filtered = tasks.filter(t => t.id !== id);
    await this.saveAllTasks(filtered);
  }
};
