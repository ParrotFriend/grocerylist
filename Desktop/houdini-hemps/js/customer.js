// ============================================================
// CUSTOMER.JS — Public product display + Member login
// ============================================================

// ── Escape HTML ──
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const SESSION_KEY = 'hh_member';

// ══════════════════════════════════════════════════════════
//  PRODUCTS — Public, no login required
// ══════════════════════════════════════════════════════════

async function loadProducts() {
  const { data, error } = await db.from('products').select('*').order('name');
  const grid = document.getElementById('productsGrid');

  if (error || !data.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:48px 0">
      No products available right now. Check back soon!
    </div>`;
    return;
  }

  grid.innerHTML = data.map(p => {
    const isOut = p.quantity === 0;
    return `<div class="product-card${isOut ? ' out' : ''}">
      <div class="product-card-name">${esc(p.name)}</div>
      ${p.description ? `<div class="product-card-desc">${esc(p.description)}</div>` : ''}
      <div class="product-card-footer">
        <div class="product-price">₱${parseFloat(p.price).toFixed(2)}</div>
        <div class="product-qty ${isOut ? 'out' : p.quantity <= 5 ? 'low' : ''}">
          ${isOut ? 'Out of stock' : `${p.quantity} left`}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════
//  MEMBER LOGIN MODAL
// ══════════════════════════════════════════════════════════

const openBtn = document.getElementById('openLoginBtn');
const closeBtn = document.getElementById('closeLoginBtn');
const modal = document.getElementById('loginModal');

openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

// ── Attempt login ──
document.getElementById('loginBtn').addEventListener('click', async () => {
  const code = document.getElementById('memberCodeInput').value.trim().toUpperCase();
  if (!code) return;

  const { data, error } = await db
    .from('customers')
    .select('*')
    .eq('member_code', code)
    .single();

  if (error || !data) {
    alert('Invalid member code. Please check and try again, or ask us in-store!');
    return;
  }

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  showMemberView(data);
});

// ── Logout ──
document.getElementById('logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('memberView').classList.add('hidden');
  document.getElementById('memberCodeInput').value = '';
});

// ── Show member info ──
async function showMemberView(customer) {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('memberView').classList.remove('hidden');

  // Refresh from DB to get latest points
  const { data: fresh } = await db.from('customers').select('*').eq('id', customer.id).single();
  const c = fresh || customer;

  document.getElementById('memberAvatar').textContent = c.name.charAt(0).toUpperCase();
  document.getElementById('memberName').textContent = c.name;
  document.getElementById('memberCodeDisplay').textContent = c.member_code;
  document.getElementById('memberPoints').textContent = c.points;

  const needed = 10 - (c.points % 10);
  const freeItems = Math.floor(c.points / 10);

  if (freeItems > 0) {
    document.getElementById('pointsHeadline').textContent = `🎁 ${freeItems} free item${freeItems > 1 ? 's' : ''} ready!`;
    document.getElementById('pointsSub').innerHTML = `You have redeemable points. Ask us in-store!`;
  } else {
    document.getElementById('pointsHeadline').textContent = needed === 10 ? 'Keep it up!' : `Almost there!`;
    document.getElementById('pointsSub').innerHTML = `You need <span id="pointsNeeded">${needed}</span> more point${needed !== 1 ? 's' : ''} for a free item.`;
  }

  // Check debt
  const { data: debts } = await db
    .from('debt_records')
    .select('amount')
    .eq('customer_id', c.id)
    .eq('status', 'unpaid');

  const totalDebt = (debts || []).reduce((s, d) => s + parseFloat(d.amount), 0);
  const debtBanner = document.getElementById('debtBanner');
  if (totalDebt > 0) {
    debtBanner.classList.remove('hidden');
    document.getElementById('debtAmount').textContent = `₱${totalDebt.toFixed(2)}`;
  } else {
    debtBanner.classList.add('hidden');
  }

  // Points history
  const { data: history } = await db
    .from('points_history')
    .select('*')
    .eq('customer_id', c.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const historyList = document.getElementById('pointsHistory');
  if (!history || !history.length) {
    historyList.innerHTML = `<p class="empty-state">No history yet.</p>`;
  } else {
    historyList.innerHTML = history.map(h => {
      const date = new Date(h.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      const isPos = h.delta > 0;
      return `<div class="history-item">
        <div>
          <div class="h-note">${esc(h.note || 'Points updated')}</div>
          <div class="h-date">${date} · ${h.points_after} pts total</div>
        </div>
        <div class="h-pts ${isPos ? 'pos' : 'neg'}">${isPos ? '+' : ''}${h.delta}</div>
      </div>`;
    }).join('');
  }
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  // Restore session
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (saved) {
    showMemberView(JSON.parse(saved));
  }
});