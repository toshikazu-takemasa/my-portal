/**
 * Tool Dispatcher
 * AIからの関数呼び出しを具体的な処理に振り分けます。
 */

window.ToolDispatcher = {
  async dispatch(name, args) {
    console.log(`[AI Tool Call] ${name}`, args);
    
    try {
      switch (name) {
        case 'save_file':
          return await GitHubStorage.saveFile(args.path, args.content, args.message || 'Updated by AI Agent');
        
        case 'read_file':
          const res = await GitHubStorage.getFile(args.path);
          return res ? res.content : "エラー: ファイルが見つかりません。";
        
        case 'list_files':
          const files = await GitHubStorage.listFiles(args.directory);
          return files.map(f => ({ name: f.name, path: f.path, type: f.type }));
        
        case 'get_tasks':
          return await TaskService.getActiveTasks();
        
        case 'add_task':
          return await TaskRepository.addTask({
            title: args.title,
            priority: args.priority || 'P2',
            description: args.description || ''
          });
        
        case 'update_task':
          const { id, ...updates } = args;
          return await TaskRepository.updateTask(id, updates);
        
        case 'merge_journals':
          return await DiaryService.getMergedJournal(args.days || 7);
        
        default:
          return `エラー: 未知のツール「${name}」が呼び出されました。`;
      }
    } catch (e) {
      console.error(`Tool Execution Error (${name}):`, e);
      return `エラー: 実行中に問題が発生しました - ${e.message}`;
    }
  }
};
