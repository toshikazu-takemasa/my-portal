/**
 * Diary Domain Service
 * 依存関係: js/storage/diary-repository.js, js/domains/task-service.js, js/domains/config-service.js
 */

window.DiaryService = {
  /**
   * 今日の日記データを取得または初期化する
   */
  async getTodayDiary() {
    const today = getJstTodayISO();
    let diary = await DiaryRepository.getDiary(today);
    
    if (!diary) {
      // 存在しない場合はテンプレートを生成
      const content = await this.generateTemplate(today);
      diary = {
        path: `vault/diary/${today}.md`,
        content: content,
        sha: ''
      };
    }
    return diary;
  },

  /**
   * 日記を保存する
   */
  async saveDiary(content, sha = '') {
    const today = getJstTodayISO();
    return await DiaryRepository.saveDiary(today, content, sha);
  },

  /**
   * AIによる振り返りを日記に追記する
   */
  async appendReflection(currentContent, aiComment) {
    const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const reflectionBlock = `\n\n> [!NOTE] AI振り返り (${now})\n> ${aiComment.replace(/\n/g, '\n> ')}\n`;
    
    const newContent = currentContent.trimEnd() + reflectionBlock;
    // UI側の更新を待つためにここでは保存のみ行い、コンテンツを返す
    return newContent;
  },

  /**
   * 日記のテンプレートを生成する
   */
  async generateTemplate(dateISO) {
    const checkedLines = await this.collectCheckedLines();
    const memo = this.collectMemo(dateISO);
    const finance = this.collectFinance(dateISO);

    const checklistBlock = checkedLines.length > 0 ? `${checkedLines.join('  \n')}\n\n` : '';
    const memoBlock = memo ? `## 📝 メモ\n${memo}\n\n` : '';
    const financeBlock = finance ? `## 💴 家計記録\n${finance}\n\n` : '';

    return `# ${dateISO}\n\n${checklistBlock}${memoBlock}${finance}`;
  },

  /**
   * デイリーチェックリストを収集する
   */
  async collectDailyChecklist() {
    const lines = [];
    const checkboxes = document.querySelectorAll('#daily-checklist-list-right .daily-task-check');
    checkboxes.forEach(cb => {
      if (cb.checked) {
        const title = cb.nextElementSibling ? cb.nextElementSibling.textContent.trim() : '';
        if (title) lines.push(`- [x] ${title}`);
      }
    });
    return lines;
  },

  /**
   * 完了済みタスクを収集する
   */
  async collectTasks() {
    const lines = [];
    const rows = document.querySelectorAll('#task-widget-list .task-widget-item');
    rows.forEach(row => {
      const cb = row.querySelector('input[type="checkbox"]');
      if (cb && cb.checked) {
        const titleSpan = row.querySelector('.issue-title');
        if (titleSpan) {
          lines.push(`- [x] ${titleSpan.textContent.trim()}`);
        }
      }
    });
    return lines;
  },

  /**
   * 確認事項（Pillars）を収集する
   */
  async collectPillars() {
    const lines = [];
    const checkboxes = document.querySelectorAll('#pillars-list .pillar-check');
    checkboxes.forEach(cb => {
      if (cb.checked) {
        const title = cb.nextElementSibling ? cb.nextElementSibling.textContent.trim() : '';
        if (title) lines.push(`- [x] ${title}`);
      }
    });
    return lines;
  },

  /**
   * 完了した項目（チェックリスト、タスク）を収集する
   */
  async collectCheckedLines() {
    const daily = await this.collectDailyChecklist();
    const tasks = await this.collectTasks();
    return [...daily, ...tasks];
  },

  /**
   * メモを収集する
   */
  collectMemo(dateISO) {
    return (localStorage.getItem(`daily-memo_${dateISO}`) || '').trim();
  },

  /**
   * 家計記録を収集する
   */
  collectFinance(dateISO) {
    // legacy logic from report.js for now, until FinanceService is ready
    const ym = dateISO.slice(0, 7);
    let records = [];
    try {
      records = JSON.parse(localStorage.getItem(`finance-records_${ym}`) || '[]');
    } catch { records = []; }

    const todayRecords = records.filter(r => r.date === dateISO);
    if (todayRecords.length === 0) return '';

    const lines = todayRecords.map(r => {
      const typeLabel = r.type === 'income' ? '収入' : '支出';
      const note = r.note ? ` (${r.note})` : '';
      return `- ${typeLabel} / ${r.category} / ${Number(r.amount).toLocaleString('ja-JP')}円${note}`;
    });

    const income = todayRecords.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0);
    const expense = todayRecords.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0);
    lines.push(`- 合計: 収入 ${income.toLocaleString('ja-JP')}円 / 支出 ${expense.toLocaleString('ja-JP')}円`);

    return `## 💴 家計記録\n${lines.join('\n')}\n`;
  },

  /**
   * 過去の日記を統合する（AI用）
   */
  async getMergedJournal(days = 7) {
    const files = await GitHubStorage.listFiles('vault/diary');
    const targets = files
      .filter(f => f.name.endsWith('.md'))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, days)
      .reverse();

    let merged = `# Journal Export (Last ${days} days)\n\n`;
    for (const file of targets) {
      const result = await GitHubStorage.getFile(file.path);
      if (result) {
        merged += `## Date: ${file.name}\n\n${result.content}\n\n---\n\n`;
      }
    }
    return merged;
  }
};
