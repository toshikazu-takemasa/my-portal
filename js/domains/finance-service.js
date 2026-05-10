/**
 * Finance Domain Service
 * 依存関係: js/storage/finance-repository.js
 */

window.FinanceService = {
  /**
   * 今日のレコードを追加する
   */
  async addRecord(record) {
    const today = getJstTodayISO();
    const ym = today.slice(0, 7);
    
    // 既存の取得（リポジトリ優先、なければlocalStorage）
    let records = await FinanceRepository.getRecords(ym);
    if (records.length === 0) {
      records = JSON.parse(localStorage.getItem(`finance-records_${ym}`) || '[]');
    }

    const newRecord = {
      id: Date.now().toString(),
      date: today,
      ...record
    };

    records.push(newRecord);
    
    // 保存（リポジトリとlocalStorage両方）
    await FinanceRepository.saveRecords(ym, records);
    localStorage.setItem(`finance-records_${ym}`, JSON.stringify(records));
    
    return newRecord;
  },

  /**
   * 指定した日のレコードを収集してテキスト化する（日記用）
   */
  async getSummaryText(dateISO) {
    const ym = dateISO.slice(0, 7);
    const records = await FinanceRepository.getRecords(ym);
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
  }
};
