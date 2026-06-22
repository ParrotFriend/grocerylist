// ============================================================
// FINANCE MODULE — Sales/Expenses, Orders, Accounts, Transfers
// ============================================================

const Finance = (() => {

  // ── Load Accounts into dropdowns ──
  async function loadAccountDropdowns() {
    const { data } = await db.from('accounts').select('*').order('name');
    const selectors = ['#entryAccount', '#transferFrom', '#transferTo'];
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      const current = el.value;
      el.innerHTML = `<option value="">— Select Account —</option>` +
        (data || []).map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
      el.value = current;
    });
  }

  // ════════════════════════════════════════
  //  SALES & EXPENSES
  // ════════════════════════════════════════

  async function loadEntries() {
    const { data, error } = await db
      .from('finance_entries')
      .select('*, accounts(name)')
      .order('entry_date', { ascending: false });
    if (error) return toast('Failed to load entries.', 'error');
    const tbody = document.getElementById('entriesBody');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-td">No entries yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(e => {
      const typeBadge = e.type === 'sales' ? 'badge-green' : 'badge-red';
      const typeLabel = e.type === 'sales' ? '↑ Sales' : '↓ Expense';
      const date = new Date(e.entry_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
      return `<tr>
        <td>${date}</td>
        <td>${esc(e.accounts?.name || '—')}</td>
        <td><span class="badge ${typeBadge}">${typeLabel}</span></td>
        <td>₱${parseFloat(e.amount).toFixed(2)}</td>
        <td>${esc(e.description || '—')}</td>
        <td>${esc(e.customer_name || '—')}</td>
        <td><button class="action-btn delete" onclick="Finance.deleteEntry('${e.id}')">🗑</button></td>
      </tr>`;
    }).join('');
  }

  async function addEntry() {
    const date = document.getElementById('entryDate').value;
    const account_id = document.getElementById('entryAccount').value;
    const type = document.getElementById('entryType').value;
    const amount = parseFloat(document.getElementById('entryAmount').value);
    const description = document.getElementById('entryDesc').value.trim();
    const customer_name = document.getElementById('entryCustomer').value.trim();

    if (!date || !account_id || !type || isNaN(amount) || amount <= 0) {
      return toast('Please fill in all required fields.', 'error');
    }

    // Update account balance
    const { data: acc } = await db.from('accounts').select('balance').eq('id', account_id).single();
    const newBalance = type === 'sales'
      ? parseFloat(acc.balance) + amount
      : parseFloat(acc.balance) - amount;

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      db.from('finance_entries').insert({ entry_date: date, account_id, type, amount, description, customer_name }),
      db.from('accounts').update({ balance: newBalance }).eq('id', account_id)
    ]);

    if (e1 || e2) return toast('Error saving entry.', 'error');
    toast('Entry added!', 'success');
    document.getElementById('entryAmount').value = '';
    document.getElementById('entryDesc').value = '';
    document.getElementById('entryCustomer').value = '';
    loadEntries();
    loadAccounts();
    loadSummaryTotals();
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this entry? This will also reverse the account balance.')) return;
    const { data: entry } = await db.from('finance_entries').select('*, accounts(balance)').eq('id', id).single();
    if (entry) {
      const reversal = entry.type === 'sales' ? -entry.amount : entry.amount;
      await db.from('accounts').update({ balance: parseFloat(entry.accounts.balance) + reversal }).eq('id', entry.account_id);
    }
    const { error } = await db.from('finance_entries').delete().eq('id', id);
    if (error) return toast('Error deleting entry.', 'error');
    toast('Entry deleted.', 'success');
    loadEntries();
    loadAccounts();
    loadSummaryTotals();
  }

  // ════════════════════════════════════════
  //  ORDERS
  // ════════════════════════════════════════

  async function loadOrders() {
    const { data, error } = await db.from('orders').select('*').order('order_date', { ascending: false });
    if (error) return toast('Failed to load orders.', 'error');
    const tbody = document.getElementById('ordersBody');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-td">No orders yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(o => {
      const balance = parseFloat(o.total_amount) - parseFloat(o.amount_paid);
      const statusMap = { pending: 'badge-yellow', partial: 'badge-blue', paid: 'badge-green' };
      const date = new Date(o.order_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
      return `<tr>
        <td>${date}</td>
        <td>${esc(o.customer_name)}</td>
        <td>${esc(o.description)}</td>
        <td>₱${parseFloat(o.total_amount).toFixed(2)}</td>
        <td>₱${parseFloat(o.amount_paid).toFixed(2)}</td>
        <td>₱${balance.toFixed(2)}</td>
        <td><span class="badge ${statusMap[o.status] || 'badge-gray'}">${o.status}</span></td>
        <td>
          <button class="action-btn edit" onclick="Finance.openEditOrder(${JSON.stringify(o).split('"').join('&quot;')})">✏</button>
          <button class="action-btn delete" onclick="Finance.deleteOrder('${o.id}')">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }

  async function addOrder() {
    const order_date = document.getElementById('orderDate').value;
    const customer_name = document.getElementById('orderCustomer').value.trim();
    const description = document.getElementById('orderDesc').value.trim();
    const total_amount = parseFloat(document.getElementById('orderTotal').value);
    const amount_paid = parseFloat(document.getElementById('orderPaid').value) || 0;
    const status = document.getElementById('orderStatus').value;

    if (!order_date || !customer_name || !description || isNaN(total_amount)) {
      return toast('Please fill in all required fields.', 'error');
    }

    const { error } = await db.from('orders').insert({ order_date, customer_name, description, total_amount, amount_paid, status });
    if (error) return toast('Error saving order.', 'error');
    toast('Order added!', 'success');
    ['orderCustomer','orderDesc','orderTotal','orderPaid'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('orderStatus').value = 'pending';
    loadOrders();
  }

  function openEditOrder(order) {
    document.getElementById('orderDate').value = order.order_date;
    document.getElementById('orderCustomer').value = order.customer_name;
    document.getElementById('orderDesc').value = order.description;
    document.getElementById('orderTotal').value = order.total_amount;
    document.getElementById('orderPaid').value = order.amount_paid;
    document.getElementById('orderStatus').value = order.status;
    // Replace Add button temporarily with Update
    const btn = document.getElementById('addOrderBtn');
    btn.textContent = 'Update Order';
    btn.onclick = async () => {
      const total_amount = parseFloat(document.getElementById('orderTotal').value);
      const amount_paid = parseFloat(document.getElementById('orderPaid').value) || 0;
      const status = document.getElementById('orderStatus').value;
      const { error } = await db.from('orders').update({
        order_date: document.getElementById('orderDate').value,
        customer_name: document.getElementById('orderCustomer').value.trim(),
        description: document.getElementById('orderDesc').value.trim(),
        total_amount, amount_paid, status
      }).eq('id', order.id);
      if (error) return toast('Error updating order.', 'error');
      toast('Order updated!', 'success');
      btn.textContent = 'Add Order';
      btn.onclick = addOrder;
      loadOrders();
    };
  }

  async function deleteOrder(id) {
    if (!confirm('Delete this order?')) return;
    const { error } = await db.from('orders').delete().eq('id', id);
    if (error) return toast('Error deleting order.', 'error');
    toast('Order deleted.', 'success');
    loadOrders();
  }

  // ════════════════════════════════════════
  //  ACCOUNTS / SUMMARY
  // ════════════════════════════════════════

  async function loadAccounts() {
    const { data, error } = await db.from('accounts').select('*').order('name');
    if (error) return;
    const list = document.getElementById('accountsList');
    if (!data.length) {
      list.innerHTML = `<div style="color:var(--text-muted);font-size:14px">No accounts yet.</div>`;
      return;
    }
    list.innerHTML = data.map(a => `
      <div class="account-card">
        <div>
          <div class="account-card-name">${esc(a.name)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="account-card-balance">₱${parseFloat(a.balance).toFixed(2)}</div>
          <button class="action-btn delete" onclick="Finance.deleteAccount('${a.id}')">🗑</button>
        </div>
      </div>`).join('');
    loadAccountDropdowns();
  }

  async function addAccount() {
    const name = document.getElementById('accountName').value.trim();
    const balance = parseFloat(document.getElementById('accountBalance').value) || 0;
    if (!name) return toast('Please enter an account name.', 'error');
    const { error } = await db.from('accounts').insert({ name, balance });
    if (error) return toast('Error adding account.', 'error');
    toast(`Account "${name}" added!`, 'success');
    document.getElementById('accountName').value = '';
    document.getElementById('accountBalance').value = '';
    loadAccounts();
    loadSummaryTotals();
  }

  async function deleteAccount(id) {
    if (!confirm('Delete this account? This cannot be undone.')) return;
    const { error } = await db.from('accounts').delete().eq('id', id);
    if (error) return toast('Error deleting account.', 'error');
    toast('Account deleted.', 'success');
    loadAccounts();
  }

  async function loadSummaryTotals() {
    const { data: entries } = await db.from('finance_entries').select('type, amount');
    const totalSales = (entries || []).filter(e => e.type === 'sales').reduce((s, e) => s + parseFloat(e.amount), 0);
    const totalExpenses = (entries || []).filter(e => e.type === 'expense').reduce((s, e) => s + parseFloat(e.amount), 0);
    const net = totalSales - totalExpenses;

    const { data: accs } = await db.from('accounts').select('balance');
    const totalFunds = (accs || []).reduce((s, a) => s + parseFloat(a.balance), 0);

    document.getElementById('summaryTotals').innerHTML = `
      <div class="summary-stat">
        <div class="summary-stat-label">Total Sales</div>
        <div class="summary-stat-value green">₱${totalSales.toFixed(2)}</div>
      </div>
      <div class="summary-stat">
        <div class="summary-stat-label">Total Expenses</div>
        <div class="summary-stat-value red">₱${totalExpenses.toFixed(2)}</div>
      </div>
      <div class="summary-stat">
        <div class="summary-stat-label">Net Profit</div>
        <div class="summary-stat-value ${net >= 0 ? 'green' : 'red'}">₱${net.toFixed(2)}</div>
      </div>
      <div class="summary-stat">
        <div class="summary-stat-label">Total Funds (All Accounts)</div>
        <div class="summary-stat-value gold">₱${totalFunds.toFixed(2)}</div>
      </div>`;
  }

  // ════════════════════════════════════════
  //  TRANSFERS
  // ════════════════════════════════════════

  async function loadTransfers() {
    const { data, error } = await db
      .from('transfers')
      .select('*, from_account:accounts!transfers_from_account_id_fkey(name), to_account:accounts!transfers_to_account_id_fkey(name)')
      .order('transfer_date', { ascending: false });
    if (error) return toast('Failed to load transfers.', 'error');
    const tbody = document.getElementById('transfersBody');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-td">No transfers yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(t => {
      const date = new Date(t.transfer_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
      return `<tr>
        <td>${date}</td>
        <td>${esc(t.from_account?.name || '—')}</td>
        <td>${esc(t.to_account?.name || '—')}</td>
        <td>₱${parseFloat(t.amount).toFixed(2)}</td>
        <td>${esc(t.note || '—')}</td>
        <td><button class="action-btn delete" onclick="Finance.deleteTransfer('${t.id}')">🗑</button></td>
      </tr>`;
    }).join('');
  }

  async function addTransfer() {
    const transfer_date = document.getElementById('transferDate').value;
    const from_account_id = document.getElementById('transferFrom').value;
    const to_account_id = document.getElementById('transferTo').value;
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const note = document.getElementById('transferNote').value.trim();

    if (!transfer_date || !from_account_id || !to_account_id || isNaN(amount) || amount <= 0) {
      return toast('Please fill in all required fields.', 'error');
    }
    if (from_account_id === to_account_id) return toast('Cannot transfer to the same account.', 'error');

    const { data: fromAcc } = await db.from('accounts').select('balance').eq('id', from_account_id).single();
    const { data: toAcc } = await db.from('accounts').select('balance').eq('id', to_account_id).single();

    if (parseFloat(fromAcc.balance) < amount) return toast('Insufficient balance in source account.', 'error');

    const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
      db.from('accounts').update({ balance: parseFloat(fromAcc.balance) - amount }).eq('id', from_account_id),
      db.from('accounts').update({ balance: parseFloat(toAcc.balance) + amount }).eq('id', to_account_id),
      db.from('transfers').insert({ transfer_date, from_account_id, to_account_id, amount, note })
    ]);

    if (e1 || e2 || e3) return toast('Error processing transfer.', 'error');
    toast('Transfer complete!', 'success');
    document.getElementById('transferAmount').value = '';
    document.getElementById('transferNote').value = '';
    loadTransfers();
    loadAccounts();
  }

  async function deleteTransfer(id) {
    if (!confirm('Delete this transfer? Account balances will NOT be reversed automatically.')) return;
    const { error } = await db.from('transfers').delete().eq('id', id);
    if (error) return toast('Error deleting transfer.', 'error');
    toast('Transfer record deleted.', 'success');
    loadTransfers();
  }

  // ── Init: set today's date on all date fields ──
  function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    ['entryDate','orderDate','transferDate'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.value) el.value = today;
    });
  }

  return {
    loadEntries, addEntry, deleteEntry,
    loadOrders, addOrder, openEditOrder, deleteOrder,
    loadAccounts, addAccount, deleteAccount, loadSummaryTotals,
    loadTransfers, addTransfer, deleteTransfer,
    setDefaultDates, loadAccountDropdowns
  };
})();