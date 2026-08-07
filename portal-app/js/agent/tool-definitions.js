/**
 * Gemini Tool Definitions
 * Gemini に渡す function_declarations の配列です。
 */

window.ToolDefinitions = [
  {
    function_declarations: [
      {
        name: "append_to_file",
        description: "既存ファイルの末尾に文章を追記します。**日記やナレッジへの「書いといて」「追記して」は必ずこれを使ってください。**"
          + "既存の内容はアプリ側で保持するので、追記したい文章だけを渡せば済みます。"
          + "ファイルが無ければ作成します（日記なら日付見出しを付けます）。",
        parameters: {
          type: "OBJECT",
          properties: {
            path: { type: "STRING", description: "ファイルパス (例: vault/diary/2026-08-05.md)" },
            text: { type: "STRING", description: "追記する文章。既存の内容は渡さないでください" },
            message: { type: "STRING", description: "コミットメッセージ" }
          },
          required: ["path", "text"]
        }
      },
      {
        name: "save_file",
        description: "ファイルの中身を**丸ごと置き換えます**。既存の内容は消えます。"
          + "追記したいだけなら append_to_file を使ってください。"
          + "既存ファイルを置き換える場合は、必ず先に read_file で現在の中身を取得し、"
          + "残したい部分を含めた全文を content に渡してください。",
        parameters: {
          type: "OBJECT",
          properties: {
            path: { type: "STRING", description: "ファイルパス (例: vault/knowledge/memo.md)" },
            content: { type: "STRING", description: "置き換え後の内容全文（差分ではなく全て）" },
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
        name: "get_today_reminders",
        description: "「今日のタスク」「今日やること」を聞かれたときに使用します。デイリーチェックリストの未完了項目と、当日メモ（memo.md）の未チェック行だけを返します。長期バックログは含まれません。",
        parameters: { type: "OBJECT", properties: {} }
      },
      {
        name: "get_tasks",
        description: "長期的なタスクバックログ（P1〜P3）を取得します。日々のチェックリストや当日メモの積み残しはこちらには含まれません。「今日のタスク」を聞かれた場合は get_today_reminders を使用してください。",
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
        name: "rollup_diary_month",
        description: "指定した月の日別日記（vault/diary/YYYY-MM-DD.md）を、暦年ディレクトリ配下の月次まとめ（vault/diary/YYYY/YYYY-MM.md）へ統合します。当月は対象外です。delete_daily を true にすると統合後に日別ファイルを削除しますが、必ずユーザーに確認してから指定してください。",
        parameters: {
          type: "OBJECT",
          properties: {
            year_month: { type: "STRING", description: "対象月 (YYYY-MM 形式・例: 2026-07)" },
            delete_daily: { type: "BOOLEAN", description: "統合後に日別ファイルを削除するか（既定 false）" }
          },
          required: ["year_month"]
        }
      },
      {
        name: "remember_about_user",
        description: "ユーザーについて覚えておくべきことを記録します。"
          + "**「覚えといて」「これ覚えておいて」と明示的に頼まれたときだけ**使ってください。推測で勝手に記録しないこと。"
          + "記録した内容は以降の対話で毎回参照されます。同時に今日の日記にも根拠として残ります。"
          + "セクションごとに上限があり、超えた分は古いものから自動で落ちます。",
        parameters: {
          type: "OBJECT",
          properties: {
            fact: {
              type: "STRING",
              description: "覚える内容。1行で簡潔に。ユーザーの言葉をそのまま写すのではなく、"
                + "今後の振る舞いに効く形に言い換えること（例:「前置きが長いと読み飛ばす」）"
            },
            section: {
              type: "STRING",
              enum: ["呼び方と距離感", "いま気にかけていること", "触れてほしくないこと", "応答の好み"],
              description: "記録先。「触れてほしくないこと」は明示的に言われた場合のみ使うこと"
            }
          },
          required: ["fact", "section"]
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
