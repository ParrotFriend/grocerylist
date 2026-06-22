// ============================================================
// CUSTOMERS MODULE — Points + Debt
// ============================================================

const Customers = (() => {

  // ── Generate unique code ──
  function generateCode() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = Math.floor(1000 + Math.random() * 9000);
    const letter = letters[Math.floor(Math.random() * letters.length)];
    return `HH-${letter}${nums}`;
  }

  // ── Load Customers Table ──
  async function load() {
    const { data, error } = await db.from('customers').select('*').order('name');
    if (error) return toast('Failed to load customers.', 'error');
    const tbody = document.getElementById('customersBody');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-td">No customers yet. Add your first customer!</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(c => {
      const freeItems = Math.floor(c.points / 10);
      return `<tr>
        <td><strong>${esc(c.name)}</strong>${c.phone ? `<br><span style="font-size:12px;color:var(--text-muted)">${esc(c.phone)}</span>` : ''}</td>
        <td><code style="background:var(--cream);padding:3px 8px;border-radius:4px;font-size:13px">${esc(c.member_code)}</code></td>
        <td><strong>${c.points}</strong> pts</td>
        <td>${freeItems > 0 ? `<span class="badge badge-gold">🎁 ${freeItems} free</span>` : '<span class="badge badge-gray">—</span>'}</td>
        <td>
          <button class="action-btn pts" onclick="Customers.openPoints('${c.id}','${esc(c.name)}',${c.points})">+ Points</button>
          <button class="action-btn debt" onclick="Customers.openDebt('${c.id}','${esc(c.name)}')">+ Debt</button>
          <button class="action-btn delete" onclick="Customers.delete('${c.id}')">🗑</button>
        </td>
      </tr>`;
    }).join('');

    // Also populate debt customer dropdown
    const debtSelect = document.getElementById('debtCustomer');
    debtSelect.innerHTML = data.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  }

  // ── Add Customer ──
  async function add() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    if (!name) return toast('Please enter a customer name.', 'error');

    // Ensure unique code
    let code, exists = true;
    while (exists) {
      code = generateCode();
      const { data } = await db.from('customers').select('id').eq('member_code', code);
      exists = data && data.length > 0;
    }

    const { error } = await db.from('customers').insert({ name, phone, member_code: code, points: 0 });
    if (error) return toast('Error adding customer.', 'error');
    toast(`Customer added! Code: ${code}`, 'success');
    document.getElementById('customerModal').classList.add('hidden');
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    load();
  }

  // ── Delete Customer ──
  async function del(id) {
    if (!confirm('Delete this customer and all their records?')) return;
    await db.from('points_history').delete().eq('customer_id', id);
    await db.from('debt_records').delete().eq('customer_id', id);
    const { error } = await db.from('customers').delete().eq('id', id);
    if (error) return toast('Error deleting customer.', 'error');
    toast('Customer deleted.', 'success');
    load();
  }

  // ── Open Points Modal ──
  function openPoints(id, name, currentPts) {
    document.getElementById('pointsCustomerId').value = id;
    document.getElementById('pointsCustomerLabel').textContent = `${name} — Current: ${currentPts} pts`;
    document.getElementById('pointsAmount').value = '';
    document.getElementById('pointsNote').value = '';
    document.getElementById('pointsModal').classList.remove('hidden');
  }

  // ── Save Points ──
  async function savePoints() {
    const id = document.getElementById('pointsCustomerId').value;
    const action = document.getElementById('pointsAction').value;
    const note = document.getElementById('pointsNote').value.trim();

    const { data: customer } = await db.from('customers').select('points').eq('id', id).single();
    let current = customer.points;
    let delta = 0;
    let histNote = note;

    if (action === 'add') {
      delta = parseInt(document.getElementById('pointsAmount').value);
      if (isNaN(delta) || delta < 1) return toast('Enter a valid points amount.', 'error');
      histNote = histNote || `+${delta} points added`;
    } else if (action === 'redeem') {
      if (current < 10) return toast('Customer needs at least 10 points to redeem.', 'error');
      delta = -10;
      histNote = histNote || 'Redeemed 10 pts for free item 🎁';
    } else if (action === 'deduct') {
      delta = -parseInt(document.getElementById('pointsAmount').value);
      if (isNaN(delta) || delta > 0) return toast('Enter a valid deduction amount.', 'error');
      histNote = histNote || `${delta} points deducted`;
    }

    const newPts = Math.max(0, current + delta);

    const { error: updateErr } = await db.from('customers').update({ points: newPts }).eq('id', id);
    if (updateErr) return toast('Error updating points.', 'error');

    await db.from('points_history').insert({
      customer_id: id,
      delta,
      points_after: newPts,
      note: histNote,
      action_type: action
    });

    toast(`Points updated! New total: ${newPts} pts`, 'success');
    document.getElementById('pointsModal').classList.add('hidden');
    load();
  }

  // ── Load Debt Records ──
  async function loadDebt() {
    const { data, error } = await db
      .from('debt_records')
      .select('*, customers(name)')
      .order('created_at', { ascending: false });
    if (error) return toast('Failed to load debt records.', 'error');
    const tbody = document.getElementById('debtBody');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-td">No debt records.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(d => {
      const statusBadge = d.status === 'paid' ? 'badge-green' : 'badge-red';
      const date = new Date(d.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
      return `<tr>
        <td><strong>${d.customers?.name || '—'}</strong></td>
        <td>${date}</td>
        <td>₱${parseFloat(d.amount).toFixed(2)}</td>
        <td>${esc(d.note || '—')}</td>
        <td><span class="badge ${statusBadge}">${d.status}</span></td>
        <td>
          ${d.status === 'unpaid' ? `<button class="action-btn pay" onclick="Customers.markPaid('${d.id}')">✓ Paid</button>` : ''}
          <button class="action-btn delete" onclick="Customers.deleteDebt('${d.id}')">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Open Debt Modal ──
  function openDebt(customerId, customerName) {
    document.getElementById('debtId').value = '';
    document.getElementById('debtModalTitle').textContent = `Record Debt — ${customerName}`;
    const sel = document.getElementById('debtCustomer');
    if (customerId) {
      // pre-select
      for (const opt of sel.options) { if (opt.value === customerId) opt.selected = true; }
    }
    document.getElementById('debtAmount').value = '';
    document.getElementById('debtNote').value = '';
    document.getElementById('debtModal').classList.remove('hidden');
  }

  // ── Save Debt ──
  async function saveDebt() {
    const customerId = document.getElementById('debtCustomer').value;
    const amount = parseFloat(document.getElementById('debtAmount').value);
    const note = document.getElementById('debtNote').value.trim();
    if (!customerId || isNaN(amount) || amount <= 0) return toast('Please fill in all fields.', 'error');

    const { error } = await db.from('debt_records').insert({
      customer_id: customerId,
      amount,
      note,
      status: 'unpaid'
    });
    if (error) return toast('Error recording debt.', 'error');
    toast('Debt recorded.', 'success');
    document.getElementById('debtModal').classList.add('hidden');
    loadDebt();
  }

  // ── Mark Debt Paid ──
  async function markPaid(id) {
    const { error } = await db.from('debt_records').update({ status: 'paid' }).eq('id', id);
    if (error) return toast('Error updating debt.', 'error');
    toast('Debt marked as paid!', 'success');
    loadDebt();
  }

  // ── Delete Debt ──
  async function deleteDebt(id) {
    if (!confirm('Delete this debt record?')) return;
    const { error } = await db.from('debt_records').delete().eq('id', id);
    if (error) return toast('Error deleting record.', 'error');
    toast('Debt record deleted.', 'success');
    loadDebt();
  }

  return { load, add, delete: del, openPoints, savePoints, loadDebt, openDebt, saveDebt, markPaid, deleteDebt };
})();