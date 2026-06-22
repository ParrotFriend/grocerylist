// ============================================================
// INVENTORY MODULE
// ============================================================

const Inventory = (() => {

  // ── Render Table ──
  async function load() {
    const { data, error } = await db.from('products').select('*').order('name');
    if (error) return toast('Failed to load inventory.', 'error');
    const tbody = document.getElementById('inventoryBody');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-td">No products yet. Add your first product!</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(p => {
      const qtyClass = p.quantity === 0 ? 'badge-red' : p.quantity <= 5 ? 'badge-yellow' : 'badge-green';
      const qtyLabel = p.quantity === 0 ? 'Out of Stock' : p.quantity <= 5 ? 'Low Stock' : 'In Stock';
      return `<tr>
        <td><strong>${esc(p.name)}</strong>${p.description ? `<br><span style="font-size:12px;color:var(--text-muted)">${esc(p.description)}</span>` : ''}</td>
        <td>₱${parseFloat(p.price).toFixed(2)}</td>
        <td>${p.quantity}</td>
        <td><span class="badge ${qtyClass}">${qtyLabel}</span></td>
        <td>
          <button class="action-btn edit" onclick="Inventory.openEdit(${JSON.stringify(p).split('"').join('&quot;')})">✏ Edit</button>
          <button class="action-btn delete" onclick="Inventory.delete('${p.id}')">🗑 Delete</button>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Open Add Modal ──
  function openAdd() {
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('productId').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productQty').value = '';
    document.getElementById('productDesc').value = '';
    document.getElementById('productModal').classList.remove('hidden');
  }

  // ── Open Edit Modal ──
  function openEdit(product) {
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productQty').value = product.quantity;
    document.getElementById('productDesc').value = product.description || '';
    document.getElementById('productModal').classList.remove('hidden');
  }

  // ── Save (Add or Update) ──
  async function save() {
    const id = document.getElementById('productId').value;
    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value);
    const quantity = parseInt(document.getElementById('productQty').value);
    const description = document.getElementById('productDesc').value.trim();

    if (!name || isNaN(price) || isNaN(quantity)) return toast('Please fill in all required fields.', 'error');

    let error;
    if (id) {
      ({ error } = await db.from('products').update({ name, price, quantity, description }).eq('id', id));
    } else {
      ({ error } = await db.from('products').insert({ name, price, quantity, description }));
    }
    if (error) return toast('Error saving product.', 'error');
    toast(id ? 'Product updated!' : 'Product added!', 'success');
    document.getElementById('productModal').classList.add('hidden');
    load();
  }

  // ── Delete ──
  async function del(id) {
    if (!confirm('Delete this product?')) return;
    const { error } = await db.from('products').delete().eq('id', id);
    if (error) return toast('Error deleting product.', 'error');
    toast('Product deleted.', 'success');
    load();
  }

  return { load, openAdd, openEdit, save, delete: del };
})();