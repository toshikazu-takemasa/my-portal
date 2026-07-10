/**
 * Gemini Tool Definitions
 * Gemini に渡す function_declarations の配列です。
 */

window.ToolDefinitions = [
  {
    function_declarations: [
      {
        name: "save_file",
        description: "リポジトリ内のファイルを保存または更新します。日記やナレッジの作成・編集に使用します。",
        parameters: {
          type: "OBJECT",
          properties: {
            path: { type: "STRING", description: "ファイルパス (例: vault/knowledge/memo.md)" },
            content: { type: "STRING", description: "保存する内容全文（差分ではなく全て）" },
            message: { type: "STRING", description: "コミットメッセージ" }
          },
          required: ["path", "content"]
        }
      },
      {
        name: "read_file",
        description: "リポジトリ内のファイル内容を読み取ります。特定の情報を詳しく確認したい時に使用します。",
        parameters: {
          type: "OBJECT",
          properties: {
            path: { type: "STRING", description: "ファイルパス" }
          },
          required: ["path"]
        }
      },
      {
        name: "list_files",
        description: "指定したディレクトリ内のファイル一覧を取得します。どのようなファイルがあるか把握するために使用します。",
        parameters: {
          type: "OBJECT",
          properties: {
            directory: { type: "STRING", description: "ディレクトリパス (例: vault/diary)" }
          },
          required: ["directory"]
        }
      },
      {
        name: "get_tasks",
        description: "現在の未完了タスク一覧を取得します。",
        parameters: { type: "OBJECT", properties: {} }
      },
      {
        name: "add_task",
        description: "新しいタスクを追加します。",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "タスク名" },
            priority: { type: "STRING", enum: ["P1", "P2", "P3"], description: "優先度" },
            description: { type: "STRING", description: "詳細メモ" }
          },
          required: ["title"]
        }
      },
      {
        name: "update_task",
        description: "既存のタスクのステータスや内容を更新します。完了にする場合もこれを使用します。",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "タスクID" },
            status: { type: "STRING", enum: ["todo", "doing", "done", "archived"], description: "ステータス" },
            priority: { type: "STRING", enum: ["P1", "P2", "P3"], description: "優先度" },
            title: { type: "STRING", description: "タイトル" }
          },
          required: ["id"]
        }
      },
      {
        name: "merge_journals",
        description: "指定期間の日記を統合してエクスポート用テキストを生成します。他のAIに渡すためのバッチ出力用です。",
        parameters: {
          type: "OBJECT",
          properties: {
            days: { type: "NUMBER", description: "遡る日数 (デフォルト7)" }
          }
        }
      }
    ]
  }
];
