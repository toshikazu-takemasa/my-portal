// =====================
// 家計記録
// =====================

function getFinanceMonthKey() {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `finance-records_${ym}`;
}

function getFinanceRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getFinanceMonthKey()) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFinanceRecords(records) {
  localStorage.setItem(getFinanceMonthKey(), JSON.stringify(records));
}

function formatYen(value) {
  return `${Number(value || 0).toLocaleString('ja-JP')}円`;
}

async function registerFinanceRecord() {
  const type = document.getElementById('fi-type').value;
  const category = document.getElementById('fi-category').value;
  const amount = Number(document.getElementById('fi-amount').value);
  const note = document.getElementById('fi-note').value.trim();

  if (!amount) return;

  const btn = document.querySelector('.finance-form button');
  btn.disabled = true;

  try {
    await FinanceService.addRecord({ type, category, amount, note });
    
    // UIリセット
    document.getElementById('fi-amount').value = '';
    document.getElementById('fi-note').value = '';
    
    const status = document.getElementById('finance-status');
    status.textContent = '✅ 登録しました（リポジトリ同期完了）';
    status.style.color = '#1a7f37';
    setTimeout(() => { status.textContent = ''; }, 3000);
    
    // リスト再描画
    renderFinanceList();
  } catch (e) {
    alert('登録エラー: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

function renderFinanceRecords() {
  const listEl = document.getElementById('finance-list');
  const incomeEl = document.getElementById('finance-total-income');
  const expenseEl = document.getElementById('finance-total-expense');
  const balanceEl = document.getElementById('finance-total-balance');
  if (!listEl || !incomeEl || !expenseEl || !balanceEl) return;

  const records = getFinanceRecords();
  const income = records
    .filter(record => record.type === 'income')
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const expense = records
    .filter(record => record.type === 'expense')
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const balance = income - expense;

  incomeEl.textContent = formatYen(income);
  expenseEl.textContent = formatYen(expense);
  balanceEl.textContent = formatYen(balance);
  balanceEl.style.color = balance >= 0 ? '#1a7f37' : '#cf222e';

  if (records.length === 0) {
    listEl.innerHTML = '<p style="font-size:0.76rem;color:#8e8e8e;">まだ記録がありません</p>';
    return;
  }

  listEl.innerHTML = '';
  records
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 12)
    .forEach(record => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;border:2px solid #111;background:var(--section-bg);';

      const left = document.createElement('div');
      left.style.cssText = 'min-width:0;display:flex;flex-direction:column;gap:2px;';
      const typeLabel = record.type === 'income' ? '収入' : '支出';
      const memo = record.note ? ` · ${record.note}` : '';
      left.innerHTML = `<span style="font-size:0.74rem;color:#666;">${record.date} / ${typeLabel} / ${record.category}</span><span style="font-size:0.78rem;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${memo || '　'}</span>`;

      const right = document.createElement('div');
      right.style.cssText = 'display:flex;align-items:center;gap:8px;';
      const amount = document.createElement('strong');
      amount.textContent = formatYen(record.amount);
      amount.style.color = record.type === 'income' ? '#1a7f37' : '#c6002b';
      amount.style.fontSize = '0.8rem';

      const del = document.createElement('button');
      del.textContent = '✕';
      del.style.cssText = 'border:0;background:none;color:#666;cursor:pointer;font-size:0.9rem;line-height:1;';
      del.addEventListener('click', () => removeFinanceRecord(record.id));

      right.appendChild(amount);
      right.appendChild(del);

      row.appendChild(left);
      row.appendChild(right);
      listEl.appendChild(row);
    });
}

function addFinanceRecord() {
  const statusEl = document.getElementById('finance-status');
  const date = (document.getElementById('finance-date')?.value || '').trim();
  const type = (document.getElementById('finance-type')?.value || 'expense').trim();
  const category = (document.getElementById('finance-category')?.value || '').trim();
  const amount = Number((document.getElementById('finance-amount')?.value || '0').trim());
  const note = (document.getElementById('finance-note')?.value || '').trim();

  if (!date || !category || !Number.isFinite(amount) || amount <= 0) {
    if (statusEl) {
      statusEl.style.color = '#cf222e';
      statusEl.textContent = '日付・カテゴリ・金額（1以上）を入力してください';
    }
    return;
  }

  const records = getFinanceRecords();
  records.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date,
    type: type === 'income' ? 'income' : 'expense',
    category,
    amount,
    note,
  });
  saveFinanceRecords(records);
  clearFinanceInputs();
  renderFinanceRecords();

  if (statusEl) {
    statusEl.style.color = '#1a7f37';
    statusEl.textContent = '✅ 家計記録を追加しました';
  }
}

function removeFinanceRecord(id) {
  const next = getFinanceRecords().filter(record => record.id !== id);
  saveFinanceRecords(next);
  renderFinanceRecords();
}

function clearFinanceInputs() {
  const fields = ['finance-date', 'finance-type', 'finance-category', 'finance-amount', 'finance-note'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
  // 日付は今日をデフォルト設定
  const dateEl = document.getElementById('finance-date');
  if (dateEl && !dateEl.value) {
    const today = new Date();
    dateEl.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
}

window.addFinanceRecord = addFinanceRecord;
window.clearFinanceInputs = clearFinanceInputs;
window.removeFinanceRecord = removeFinanceRecord;
window.renderFinanceRecords = renderFinanceRecords;

document.addEventListener('DOMContentLoaded', () => {
  clearFinanceInputs();
  renderFinanceRecords();
});
