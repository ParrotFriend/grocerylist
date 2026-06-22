// ============================================================
// ADMIN.JS — Login, Tab Navigation, Event Listeners
// ============================================================

// ── Utility: escape HTML ──
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Utility: Toast notification ──
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ══════════════════════════════════════════════════════════
//  ADMIN LOGIN
// ══════════════════════════════════════════════════════════

const ADMIN_SESSION_KEY = 'hh_admin_session';

document.getElementById('adminLoginBtn').addEventListener('click', async () => {
  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');

  const { data, error } = await db
    .from('admin_users')
    .select('*')
    .eq('username', username)
    .eq('password_hash', password) // NOTE: In production use hashed passwords
    .single();

  if (error || !data) {
    errEl.classList.remove('hidden');
    return;
  }

  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ id: data.id, username: data.username }));
  showPanel();
});

document.getElementById('adminLogoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('adminLoginScreen').classList.remove('hidden');
});

function showPanel() {
  document.getElementById('adminLoginScreen').classList.add('hidden');
  document.getElementById('adminPanel').classList.remove('hidden');
  initAdmin();
}

// Check existing session
window.addEventListener('DOMContentLoaded', () => {
  const session = sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (session) { showPanel(); } 
});

// ══════════════════════════════════════════════════════════
//  TAB NAVIGATION
// ══════════════════════════════════════════════════════════

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    // Load data for this tab
    if (tab === 'inventory') Inventory.load();
    if (tab === 'customers') { Customers.load(); Customers.loadDebt(); }
    if (tab === 'finance') {
      Finance.setDefaultDates();
      Finance.loadEntries();
      Finance.loadOrders();
      Finance.loadAccounts();
      Finance.loadSummaryTotals();
      Finance.loadTransfers();
      Finance.loadAccountDropdowns();
    }
  });
});

// ── Sub-tab navigation ──
document.querySelectorAll('.sub-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const sub = btn.dataset.sub;
    const parent = btn.closest('section');
    parent.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
    parent.querySelectorAll('.sub-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`sub-${sub}`).classList.add('active');
    // Load when switching to summary/transfers
    if (sub === 'fin-summary') { Finance.loadAccounts(); Finance.loadSummaryTotals(); }
    if (sub === 'fin-transfers') { Finance.loadTransfers(); Finance.loadAccountDropdowns(); }
    if (sub === 'debt') Customers.loadDebt();
  });
});

// ══════════════════════════════════════════════════════════
//  INIT ADMIN — Load first tab
// ══════════════════════════════════════════════════════════

function initAdmin() {
  Inventory.load();
}

// ══════════════════════════════════════════════════════════
//  INVENTORY EVENTS
// ══════════════════════════════════════════════════════════

document.getElementById('openAddProductModal').addEventListener('click', () => Inventory.openAdd());
document.getElementById('closeProductModal').addEventListener('click', () => document.getElementById('productModal').classList.add('hidden'));
document.getElementById('saveProductBtn').addEventListener('click', () => Inventory.save());

// ══════════════════════════════════════════════════════════
//  CUSTOMER EVENTS
// ══════════════════════════════════════════════════════════

document.getElementById('openAddCustomerModal').addEventListener('click', () => {
  document.getElementById('customerName').value = '';
  document.getElementById('customerPhone').value = '';
  document.getElementById('customerModal').classList.remove('hidden');
});
document.getElementById('closeCustomerModal').addEventListener('click', () => document.getElementById('customerModal').classList.add('hidden'));
document.getElementById('saveCustomerBtn').addEventListener('click', () => Customers.add());

document.getElementById('closePointsModal').addEventListener('click', () => document.getElementById('pointsModal').classList.add('hidden'));
document.getElementById('savePointsBtn').addEventListener('click', () => Customers.savePoints());

// Toggle points amount field for redeem
document.getElementById('pointsAction').addEventListener('change', () => {
  const action = document.getElementById('pointsAction').value;
  const group = document.getElementById('pointsAmountGroup');
  group.style.display = action === 'redeem' ? 'none' : 'flex';
});

// Open debt modal from customers tab header
document.getElementById('closeDebtModal').addEventListener('click', () => document.getElementById('debtModal').classList.add('hidden'));
document.getElementById('saveDebtBtn').addEventListener('click', () => Customers.saveDebt());

// ══════════════════════════════════════════════════════════
//  FINANCE EVENTS
// ══════════════════════════════════════════════════════════

document.getElementById('addEntryBtn').addEventListener('click', () => Finance.addEntry());
document.getElementById('addOrderBtn').addEventListener('click', () => Finance.addOrder());
document.getElementById('addAccountBtn').addEventListener('click', () => Finance.addAccount());
document.getElementById('addTransferBtn').addEventListener('click', () => Finance.addTransfer());

// Close modals when clicking overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});