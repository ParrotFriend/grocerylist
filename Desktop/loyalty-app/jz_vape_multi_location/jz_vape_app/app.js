// ─── CONFIG ───────────────────────────────────────────
const MAX_STAMPS = 10;
const SHOP_NAME  = "JZ_VAPE";
const MAX_LOCATIONS = 3;
const SUPA_URL   = "https://qpaxmazdphtgismkavuq.supabase.co";
const SUPA_KEY   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwYXhtYXpkcGh0Z2lzbWthdnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODY2NzIsImV4cCI6MjA5MTA2MjY3Mn0.A2AAVq_ICJcnFcqCiOZWLk59hWfyh1BCIZ5td86FokY";
// ─────────────────────────────────────────────────────

const sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);

let customers = [];
let inventory = [];
let locations = [];
let state = {
  view:"loading",          // loading | public | login | main
  role:null,
  customerId:null,
  customerLocation:null,   // for customer view - their assigned location
  tab:"customers",
  search:"",
  previewCode:null,
  loginMode:"customer",
  busy:false,
  modal:null,
  showDebt:false,
  // public + customer inventory drill-down
  pubInvView:"categories",
  pubInvCategory:null,
  pubInvBrand:null,
  // admin inventory drill-down
  adminInvView:"categories",
  adminInvCategory:null,
  adminInvBrand:null,
  selectedLocation:null,   // for admin filtering
};

// ─── HELPERS ─────────────────────────────────────────
function initials(n) { return n.trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
function dateNow() { return new Date().toLocaleDateString("fil-PH",{month:"short",day:"numeric",year:"numeric"}); }
function uid() { return Math.random().toString(36).slice(2,10); }
function peso(n) { return '₱'+Number(n).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function totalUtang(c) { return (c.utang||[]).reduce((sum,u)=>sum+(u.remaining??u.amount),0); }
function genCode() {
  const used = new Set(customers.map(c=>c.phone));
  let code;
  do { code = String(Math.floor(10000000 + Math.random()*90000000)); } while(used.has(code));
  return code;
}
function getCatLabel(cat) { return (!cat||cat==='UNCATEGORIZED') ? 'IBA PA' : cat; }
function getCategories(items) { return [...new Set(items.map(i=>getCatLabel(i.category)))].sort(); }
function getBrands(items, catLabel) { return [...new Set(items.filter(i=>getCatLabel(i.category)===catLabel).map(i=>i.brand))].sort(); }
function getAllBrands() { return [...new Set(inventory.map(i=>i.brand))].sort(); }
function getLocationName(locationId) {
  if (!locationId) return "No Location";
  const loc = locations.find(l => l.id === locationId);
  return loc ? loc.name : "Unknown";
}
function filterByLocation(items, locationId) {
  if (!locationId) return items;
  return items.filter(i => i.location_id === locationId);
}

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove("show"), 2800);
}
function render() {
  document.getElementById("app").innerHTML = buildApp();
  const old = document.getElementById("modal-root");
  if (old) old.remove();
  if (state.modal) {
    const d = document.createElement("div");
    d.id = "modal-root";
    d.innerHTML = typeof state.modal === "function" ? state.modal() : buildModal();
    document.body.appendChild(d);
  }
  bindEvents();
}

// ─── DATABASE ─────────────────────────────────────────
async function dbLoad() {
  const {data,error} = await sb.from("customers").select("*").order("created_at",{ascending:true});
  if (error) { console.error(error); return false; }
  customers = data||[]; return true;
}
async function dbLoadInventory() {
  const {data,error} = await sb.from("inventory").select("*").order("brand",{ascending:true});
  if (error) { console.error(error); return; }
  inventory = data||[];
}
async function dbLoadLocations() {
  const {data,error} = await sb.from("locations").select("*").order("created_at",{ascending:true});
  if (error) { console.error(error); return; }
  locations = data||[];
}
async function dbAddLocation(name) {
  const {data,error} = await sb.from("locations").insert([{name}]).select().single();
  if (error) throw error; return data;
}
async function dbUpdateLocation(id, fields) {
  const {error} = await sb.from("locations").update(fields).eq("id",id);
  if (error) throw error;
}
async function dbDeleteLocation(id) {
  const {error} = await sb.from("locations").delete().eq("id",id);
  if (error) throw error;
}
async function dbAddInventory(item) {
  const {data,error} = await sb.from("inventory").insert([item]).select().single();
  if (error) throw error; return data;
}
async function dbUpdateInventory(id, fields) {
  const {error} = await sb.from("inventory").update(fields).eq("id",id);
  if (error) throw error;
}
async function dbDeleteInventory(id) {
  const {error} = await sb.from("inventory").delete().eq("id",id);
  if (error) throw error;
}
async function dbAdd(name, code, location_id) {
  const {data,error} = await sb.from("customers")
    .insert([{name, phone:code, stamps:0, history:[], utang:[], location_id}]).select().single();
  if (error) throw error; return data;
}
async function dbUpdate(id, fields) {
  const {error} = await sb.from("customers").update(fields).eq("id", id);
  if (error) throw error;
}
async function dbGetByCode(code) {
  const {data,error} = await sb.from("customers")
    .select("*").eq("phone", code.replace(/\D/g,"")).maybeSingle();
  if (error) return null; return data;
}

// ─── BUILD APP ────────────────────────────────────────
function buildApp() {
  if (state.view==="loading") return `<div class="loading-screen"><div class="spinner"></div><div class="loading-text">Naglo-load...</div></div>`;
  if (state.view==="public") return buildPublic();
  if (state.view==="login") return buildLogin();
  return `
    <div class="topbar">
      <div class="topbar-logo"><div class="logo-mark">★</div><span>${SHOP_NAME}</span></div>
      <div class="topbar-right">
        <span class="role-pill">${state.role==="admin"?"Admin":"Customer"}</span>
        <button class="logout-btn" id="btn-logout">Logout</button>
      </div>
    </div>
    <div class="page">${state.role==="admin"?buildAdmin():buildCustomer()}</div>`;
}

// ─── PUBLIC LANDING PAGE ──────────────────────────────
function buildPublic() {
  const avail = inventory.filter(i=>i.quantity>0);

  // FLAVOR LEVEL
  if (state.pubInvView==="flavors" && state.pubInvBrand) {
    const items = avail.filter(i=>getCatLabel(i.category)===state.pubInvCategory && i.brand===state.pubInvBrand);
    const puffs = items[0]?.puffs||"";
    return `
      <div class="public-hero">
        <div class="public-hero-logo">★</div>
        <div class="public-hero-title">${SHOP_NAME}</div>
        <div class="public-hero-sub">Loyalty & Rewards</div>
      </div>
      <div class="public-content">
        <button class="back-btn" id="btn-pub-back-brands">← ${state.pubInvCategory}</button>
        <div class="public-section-title">${state.pubInvBrand}</div>
        <div class="public-section-sub">${puffs?puffs+' puffs · ':''}Available flavors</div>
        <div class="flavor-list">
          ${items.map(item=>`
            <div class="flavor-row">
              <div class="flavor-info">
                <div class="flavor-name">${item.flavor||'—'}</div>
                <div class="flavor-meta">
                  <span class="flavor-price">${peso(item.amount)}</span>
                  <span class="flavor-qty in">${item.quantity} left</span>
                </div>
              </div>
            </div>`).join("")}
        </div>
        ${buildLoginCTA()}
      </div>`;
  }

  // BRAND LEVEL
  if (state.pubInvView==="brands" && state.pubInvCategory) {
    const brands = getBrands(avail, state.pubInvCategory);
    return `
      <div class="public-hero">
        <div class="public-hero-logo">★</div>
        <div class="public-hero-title">${SHOP_NAME}</div>
        <div class="public-hero-sub">Loyalty & Rewards</div>
      </div>
      <div class="public-content">
        <button class="back-btn" id="btn-pub-back-cats">← Lahat ng Categories</button>
        <div class="public-section-title">${state.pubInvCategory}</div>
        <div class="public-section-sub">Available brands</div>
        <div class="brand-grid">
          ${brands.map(brand=>{
            const items = avail.filter(i=>getCatLabel(i.category)===state.pubInvCategory && i.brand===brand);
            const puffs = items[0]?.puffs||"";
            return `<div class="brand-card" data-pub-brand="${brand}">
              <div>
                <div class="brand-card-name">${brand}</div>
                <div class="brand-card-sub">${puffs?puffs+' puffs · ':''}${items.length} flavor${items.length!==1?'s':''} available</div>
              </div>
              <div class="brand-card-arrow">›</div>
            </div>`;
          }).join("")}
        </div>
        ${buildLoginCTA()}
      </div>`;
  }

  // CATEGORY LEVEL (default)
  const cats = getCategories(avail);
  const catContent = !cats.length
    ? `<div class="empty"><div class="empty-icon">😔</div>Walang available na products ngayon.</div>`
    : `<div class="cat-btn-grid">
        ${cats.map(cat=>{
          const count = getBrands(avail, cat).length;
          return `<button class="cat-btn" data-pub-cat="${cat}">
            <div>
              <div class="cat-btn-name">${cat}</div>
              <div class="cat-btn-count">${count} brand${count!==1?'s':''} available</div>
            </div>
            <div style="font-size:18px;color:var(--muted)">›</div>
          </button>`;
        }).join("")}
      </div>`;

  return `
    <div class="public-hero">
      <div class="public-hero-logo">★</div>
      <div class="public-hero-title">${SHOP_NAME}</div>
      <div class="public-hero-sub">Loyalty & Rewards</div>
    </div>
    <div class="public-content">
      <div class="public-section-title">📦 What's Available Now?</div>
      <div class="public-section-sub">Piliin ang category para makita ang mga produkto</div>
      ${catContent}
      ${buildLoginCTA()}
    </div>`;
}

function buildLoginCTA() {
  return `
    <div class="login-cta-card">
      <div class="login-cta-title">🌟 May Loyalty Card ka na ba?</div>
      <div class="login-cta-sub">Mag-login para makita ang iyong stamps, rewards, at utang.</div>
      <button class="login-cta-btn" id="btn-go-login">Mag-Login →</button>
    </div>`;
}

// ─── LOGIN PAGE ───────────────────────────────────────
function buildLogin() {
  if (state.loginMode==="admin") {
    return `
      <div class="login-wrap"><div class="login-box">
        <div class="login-logo"><div class="login-logo-mark">★</div><span class="login-logo-text">${SHOP_NAME}</span></div>
        <p style="font-size:12px;color:var(--muted);text-align:center;margin-bottom:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Admin Login</p>
        <input style="width:100%;height:44px;border:1px solid var(--border-med);border-radius:var(--radius-sm);padding:0 14px;font-size:15px;font-family:inherit;background:var(--bg);color:var(--text);outline:none;margin-bottom:10px" id="inp-email" type="email" placeholder="Email" autocomplete="off" />
        <input style="width:100%;height:44px;border:1px solid var(--border-med);border-radius:var(--radius-sm);padding:0 14px;font-size:15px;font-family:inherit;background:var(--bg);color:var(--text);outline:none" id="inp-password" type="password" placeholder="Password" />
        <div class="login-err" id="login-err">Mali ang email o password.</div>
        <button class="login-btn" id="btn-login">Mag-login bilang Admin</button>
        <p style="font-size:12px;color:var(--accent);margin-top:14px;text-align:center;cursor:pointer;text-decoration:underline" id="switch-mode">← Customer login</p>
        <a class="back-to-home" id="btn-back-home">← Bumalik sa Products</a>
      </div></div>`;
  }
  return `
    <div class="login-wrap"><div class="login-box">
      <div class="login-logo"><div class="login-logo-mark">★</div><span class="login-logo-text">${SHOP_NAME}</span></div>
      <label class="login-label">I-enter ang iyong 8-digit loyalty code</label>
      <input class="login-input" id="inp-login" type="number" inputmode="numeric" placeholder="00000000" autocomplete="off" />
      <div class="login-err" id="login-err">Code not found. Makipag-usap sa staff.</div>
      <button class="login-btn" id="btn-login">Enter</button>
      <p class="login-hint">Wala pang code? Makipag-usap sa staff.</p>
      <p style="font-size:12px;color:var(--accent);margin-top:14px;text-align:center;cursor:pointer;text-decoration:underline" id="switch-mode">Staff / Admin login →</p>
      <a class="back-to-home" id="btn-back-home">← Bumalik sa Products</a>
    </div></div>`;
}

// ─── ADMIN PAGE ───────────────────────────────────────
function buildAdmin() {
  const total = customers.length;
  const totalStamps = customers.reduce((a,c)=>a+(c.stamps||0),0);
  const totalDebt = customers.reduce((a,c)=>a+totalUtang(c),0);
  const stats = `
    <div class="stats-grid">
      <div class="stat"><div class="stat-n">${total}</div><div class="stat-l">Customers</div></div>
      <div class="stat"><div class="stat-n">${totalStamps}</div><div class="stat-l">Total Stamps</div></div>
      <div class="stat" style="border-color:rgba(180,83,9,0.3);background:var(--orange-light)">
        <div class="stat-n" style="color:var(--orange);font-size:18px">${peso(totalDebt)}</div>
        <div class="stat-l">Total Utang</div>
      </div>
    </div>`;
  const tabs = `
    <div class="tabs">
      <button class="tab ${state.tab==="customers"?"active":""}" data-tab="customers">Customers</button>
      <button class="tab ${state.tab==="add"?"active":""}" data-tab="add">+ Dagdag</button>
      <button class="tab ${state.tab==="inventory"?"active":""}" data-tab="inventory">📦 Inventory</button>
      <button class="tab ${state.tab==="locations"?"active":""}" data-tab="locations">📍 Locations</button>
      <button class="tab ${state.tab==="finance-tracker"?"active":""}" onclick="window.location.href='https://finance-tracker-tau-coral.vercel.app/'">Finance Tracker</button>
    </div>`;
  if (state.tab==="locations") return stats+tabs+buildLocations();
  if (state.tab==="inventory") return stats+tabs+buildAdminInventory();
  if (state.tab==="add") {
    if (!state.previewCode) state.previewCode = genCode();
    return stats+tabs+`
      <div class="card">
        <div class="section-label">Bagong Customer</div>
        <div class="field"><label>Pangalan</label><input id="inp-name" placeholder="Juan Santos" /></div>
        <div class="field">
          <label>Location</label>
          <select id="inp-location">
            <option value="">Piliin ang location...</option>
            ${locations.map(loc=>`<option value="${loc.id}">${loc.name}</option>`).join("")}
          </select>
        </div>
        <div class="code-box">
          <div class="code-box-label">Auto-generated loyalty code</div>
          <div class="code-box-num" id="code-preview">${state.previewCode}</div>
        </div>
        <div class="btn-row">
          <button class="regen-btn" id="btn-regen">🔄 Bago</button>
          <button class="add-btn" id="btn-add" ${state.busy?"disabled":""}>${state.busy?"Nag-sasave...":"Idagdag"}</button>
        </div>
      </div>`;
  }
  const q = state.search.toLowerCase();
  const list = q ? customers.filter(c=>c.name.toLowerCase().includes(q)||(c.phone||"").includes(q)) : customers;
  const searchBar = `<div class="search-wrap"><span class="search-icon">🔍</span><input class="search-input" id="inp-search" placeholder="Hanapin..." value="${state.search}" /></div>`;
  if (!list.length) return stats+tabs+searchBar+`<div class="empty"><div class="empty-icon">👥</div>${customers.length===0?"Walang customers pa.":"Walang nahanap."}</div>`;
  const rows = list.map(c=>{
    const stamps=c.stamps||0, full=stamps>=MAX_STAMPS, debt=totalUtang(c);
    const dots=Array.from({length:MAX_STAMPS},(_,i)=>`<div class="dot ${i<stamps?(full?"full":"on"):"off"}"></div>`).join("");
    const locationName = getLocationName(c.location_id);
    return `<div class="cust-row">
      <div class="avatar">${initials(c.name)}</div>
      <div class="cust-body">
        <div class="cust-name">${c.name}</div>
        <div class="cust-code"># ${c.phone||"—"} · 📍 ${locationName}</div>
        <div class="stamp-dots">${dots}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px">
          ${full?`<div class="ready-tag">✓ Ready na para sa reward!</div>`:`<div style="font-size:11px;color:var(--muted)">${stamps}/${MAX_STAMPS} stamps</div>`}
          ${debt>0?`<div class="utang-tag">Utang: ${peso(debt)}</div>`:""}
        </div>
      </div>
      <div class="cust-actions">
        ${full
          ?`<button class="stamp-btn redeem-btn" data-id="${c.id}" data-action="redeem" ${state.busy?"disabled":""}>🎁 Redeem</button>`
          :`<button class="stamp-btn" data-id="${c.id}" data-action="stamp" ${state.busy?"disabled":""}>+ Stamp</button>`}
        <button class="utang-btn" data-id="${c.id}" data-action="utang">💰 Utang</button>
      </div>
    </div>`;
  }).join("");
  return stats+tabs+searchBar+`<div class="cust-list">${rows}</div>`;
}

function buildAdminInventory() {
  const allBrands = getAllBrands();
  const brandDL = `<datalist id="dl-brand">${allBrands.map(b=>`<option value="${b}">`).join("")}</datalist>`;
  const addForm = `${brandDL}
    <div class="card">
      <div class="section-label">Mag-add ng Product</div>
      <div class="form-row">
        <div class="field"><label>Category</label><input id="inv-category" list="dl-category" placeholder="V2 PODS" autocomplete="off" /></div>
        <div class="field"><label>Brand Name</label><input id="inv-brand" list="dl-brand" placeholder="Nox Elite" autocomplete="off" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Puffs</label><input id="inv-puffs" placeholder="25000" /></div>
        <div class="field"><label>Flavor</label><input id="inv-flavor" placeholder="Mango Ice" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Amount (₱)</label><input id="inv-amount" type="number" placeholder="285" /></div>
        <div class="field"><label>Quantity</label><input id="inv-qty" type="number" placeholder="5" /></div>
      </div>
      <div class="field">
        <label>Location</label>
        <select id="inv-location">
          <option value="">Piliin ang location...</option>
          ${locations.map(loc=>`<option value="${loc.id}">${loc.name}</option>`).join("")}
        </select>
      </div>
      <button class="add-btn" id="btn-add-inv" style="width:100%">+ I-add ang Product</button>
    </div>`;
  if (!inventory.length) return addForm+`<div class="empty"><div class="empty-icon">📦</div>Walang products pa.</div>`;

  if (state.adminInvView==="flavors" && state.adminInvCategory && state.adminInvBrand) {
    const items = inventory.filter(i=>getCatLabel(i.category)===state.adminInvCategory && i.brand===state.adminInvBrand);
    const flavors = items.map(item=>`
      <div class="flavor-row">
        <div class="flavor-info">
          <div class="flavor-name">${item.flavor||'—'}</div>
          <div class="flavor-meta">
            <span class="flavor-price">${peso(item.amount)}</span>
            <span class="flavor-qty ${item.quantity>0?'in':'out'}">${item.quantity>0?item.quantity+' in stock':'Out of stock'}</span>
          </div>
        </div>
        <div class="flavor-actions">
          <button class="utang-btn" style="height:30px;font-size:12px" data-inv-edit="${item.id}">Edit</button>
          <button class="danger-btn" data-inv-del="${item.id}">Bura</button>
        </div>
      </div>`).join("");
    return addForm+`
      <button class="back-btn" id="btn-inv-back-brands">← ${state.adminInvCategory}</button>
      <div class="section-label">${state.adminInvBrand} ${items[0]?.puffs?'· '+items[0].puffs+' puffs':''}</div>
      <div class="flavor-list">${flavors||`<div class="empty" style="padding:20px 0">Walang flavors pa.</div>`}</div>`;
  }

  if (state.adminInvView==="brands" && state.adminInvCategory) {
    const brands = getBrands(inventory, state.adminInvCategory);
    const brandCards = brands.map(brand=>{
      const items = inventory.filter(i=>getCatLabel(i.category)===state.adminInvCategory && i.brand===brand);
      const inStock = items.filter(i=>i.quantity>0).length;
      const puffs = items[0]?.puffs||"";
      return `<div class="brand-card" data-adm-brand="${brand}">
        <div>
          <div class="brand-card-name">${brand}</div>
          <div class="brand-card-sub">${puffs?puffs+' puffs · ':''} ${inStock}/${items.length} flavors in stock</div>
        </div>
        <div class="brand-card-arrow">›</div>
      </div>`;
    }).join("");
    return addForm+`
      <button class="back-btn" id="btn-inv-back-cats">← Lahat ng Categories</button>
      <div class="section-label">${state.adminInvCategory}</div>
      <div class="brand-grid">${brandCards}</div>`;
  }

  const categories = getCategories(inventory);
  const catSections = categories.map(cat=>{
    const brands = getBrands(inventory, cat);
    const totalItems = inventory.filter(i=>getCatLabel(i.category)===cat).length;
    const brandCards = brands.map(brand=>{
      const items = inventory.filter(i=>getCatLabel(i.category)===cat && i.brand===brand);
      const inStock = items.filter(i=>i.quantity>0).length;
      const puffs = items[0]?.puffs||"";
      return `<div class="brand-card" data-adm-cat="${cat}" data-adm-brand="${brand}">
        <div>
          <div class="brand-card-name">${brand}</div>
          <div class="brand-card-sub">${puffs?puffs+' puffs · ':''} ${inStock}/${items.length} flavors in stock</div>
        </div>
        <div class="brand-card-arrow">›</div>
      </div>`;
    }).join("");
    return `<div class="cat-section">
      <div class="cat-header">${cat} <span class="cat-badge">${totalItems} items</span></div>
      <div class="brand-grid">${brandCards}</div>
    </div>`;
  }).join("");
  return addForm+catSections;
}

function buildLocations() {
  const addForm = `
    <div class="card">
      <div class="section-label">Mag-add ng Location (Max ${MAX_LOCATIONS})</div>
      <div class="field"><label>Location Name</label><input id="loc-name" placeholder="PPC, El Nido, etc." /></div>
      <button class="add-btn" id="btn-add-location" style="width:100%" ${locations.length >= MAX_LOCATIONS ? "disabled" : ""}>
        ${locations.length >= MAX_LOCATIONS ? `Maximum ${MAX_LOCATIONS} na ang locations` : "+ I-add ang Location"}
      </button>
    </div>`;
  
  if (!locations.length) {
    return addForm + `<div class="empty"><div class="empty-icon">📍</div>Walang locations pa. Mag-add ng una!</div>`;
  }
  
  const locationsList = locations.map(loc => {
    const customersCount = customers.filter(c => c.location_id === loc.id).length;
    const inventoryCount = inventory.filter(i => i.location_id === loc.id).length;
    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <div style="font-size:16px;font-weight:600;margin-bottom:4px">📍 ${loc.name}</div>
            <div style="font-size:12px;color:var(--muted)">
              ${customersCount} customers · ${inventoryCount} inventory items
            </div>
          </div>
          <button class="danger-btn" data-loc-del="${loc.id}" style="margin-left:10px">Bura</button>
        </div>
      </div>`;
  }).join("");
  
  return addForm + locationsList;
}

// ─── CUSTOMER PAGE ────────────────────────────────────
function buildCustomer() {
  const c = customers.find(x=>String(x.id)===String(state.customerId));
  if (!c) return `<div class="empty">Account not found.</div>`;
  const stamps=c.stamps||0, full=stamps>=MAX_STAMPS;
  const pct=Math.min(100,Math.round((stamps/MAX_STAMPS)*100));
  const grid=Array.from({length:MAX_STAMPS},(_,i)=>`<div class="lc-dot ${i<stamps?"on":""}">${i<stamps?"★":""}</div>`).join("");
  const hist=Array.isArray(c.history)?c.history:[];
  const debt=totalUtang(c);
  const debtPanel = state.showDebt ? buildDebtPanel(c) : "";
  return `
    <div class="loyalty-card-visual">
      <div class="lc-shop">${SHOP_NAME}</div>
      <div class="lc-name">${c.name}</div>
      <div class="lc-code"># ${c.phone||"—"}</div>
      <div class="lc-bottom">
        <div class="lc-grid">${grid}</div>
        <div class="lc-count"><div class="lc-num">${stamps}</div><div class="lc-denom">/ ${MAX_STAMPS}</div></div>
      </div>
    </div>
    ${full?`<div class="reward-banner">🎁 Kumpleto na ang iyong card! Pumunta sa counter para i-claim ang reward.</div>`:""}
    <div class="progress-wrap">
      <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      <div class="progress-label">${full?"🎉 Kumpleto na!":MAX_STAMPS-stamps+" stamps pa para sa iyong libre!"}</div>
    </div>
    <button class="action-btn debt-view-btn" id="btn-toggle-debt">
      💰 ${state.showDebt?"Itago ang":"Tingnan ang"} Utang ${debt>0?`— ${peso(debt)} natitira`:"— Wala kang utang"}
    </button>
    ${debtPanel}
    <button class="action-btn inventory-view-btn" id="btn-show-inv">📦 What's Available Now?</button>
    <div class="section-label">History</div>
    ${hist.length===0
      ?`<div class="empty" style="padding:20px 0"><div class="empty-icon">📋</div>Wala pang history.</div>`
      :`<div class="hist-list">${hist.map(h=>`
        <div class="hist-item">
          <div class="hist-left">
            <div class="hist-icon ${h.type}">${h.type==="reward"?"🎁":"★"}</div>
            <div><div class="hist-text">${h.type==="reward"?"Reward na-redeem":"Stamp na-dagdag"}</div><div class="hist-date">${h.date}</div></div>
          </div>
          <span class="hist-badge ${h.type}">${h.type==="reward"?"Reward":"+1 stamp"}</span>
        </div>`).join("")}</div>`}`;
}

function buildDebtPanel(c) {
  const utang=Array.isArray(c.utang)?c.utang:[];
  const debt=totalUtang(c);
  if (!utang.length) return `<div class="empty" style="padding:16px 0;margin-bottom:12px"><div class="empty-icon">✅</div>Walang utang. Magaling!</div>`;
  const summary = debt>0?`
    <div class="utang-summary" style="margin-bottom:12px">
      <div class="utang-summary-label">💰 Kabuuang Utang</div>
      <div class="utang-summary-amount">${peso(debt)}</div>
    </div>`:`
    <div class="utang-summary" style="margin-bottom:12px;background:var(--green-light);border-color:rgba(26,107,58,0.2)">
      <div class="utang-summary-label" style="color:var(--green)">✓ Bayad na lahat!</div>
      <div class="utang-summary-amount" style="color:var(--green)">₱0.00</div>
    </div>`;
  const items=utang.map(u=>{
    const remaining=u.remaining??u.amount, paid=u.amount-remaining;
    const pct=Math.round((paid/u.amount)*100), payments=u.payments||[], isPaid=remaining<=0;
    return `<div class="utang-item">
      <div class="utang-item-header">
        <div>
          <div class="utang-item-amount" style="color:${isPaid?'var(--green)':'var(--orange)'}">${peso(u.amount)}</div>
          ${u.note?`<div class="utang-item-note">${u.note}</div>`:""}
        </div>
        <div style="text-align:right">
          <div class="utang-item-date">${u.date}</div>
          ${isPaid?`<span class="utang-paid-badge">Bayad na ✓</span>`:""}
        </div>
      </div>
      ${!isPaid?`<div class="utang-progress-bg"><div class="utang-progress-fill" style="width:${pct}%"></div></div>
        <div class="utang-progress-label"><span>Nabayad: ${peso(paid)}</span><span>Natitira: ${peso(remaining)}</span></div>`:""}
      ${payments.map(p=>`<div class="payment-item">
        <span style="font-size:12px;color:var(--muted)">Bayad</span>
        <span class="payment-item-amount">+${peso(p.amount)}</span>
        <span class="payment-item-date">${p.date}</span>
      </div>`).join("")}
    </div>`;
  }).join("");
  return `<div style="margin-bottom:12px">${summary}${items}</div>`;
}

// Customer inventory modal (after login)
function buildCustInvModal() {
  // Filter inventory by customer's location
  const avail = inventory.filter(i=>i.quantity>0 && i.location_id === state.customerLocation);
  if (state.pubInvView==="flavors" && state.pubInvBrand) {
    const items = avail.filter(i=>getCatLabel(i.category)===state.pubInvCategory && i.brand===state.pubInvBrand);
    const puffs = items[0]?.puffs||"";
    return `<div class="modal-bg"><div class="modal-box">
      <div class="modal-title">📦 ${state.pubInvBrand}</div>
      ${puffs?`<div style="font-size:13px;color:var(--muted);margin-bottom:12px">${puffs} puffs</div>`:""}
      <button class="back-btn" id="btn-cust-inv-back-brands">← ${state.pubInvCategory}</button>
      <div class="section-label">Available Flavors</div>
      <div class="flavor-list">
        ${items.map(item=>`<div class="flavor-row">
          <div class="flavor-info">
            <div class="flavor-name">${item.flavor||'—'}</div>
            <div class="flavor-meta">
              <span class="flavor-price">${peso(item.amount)}</span>
              <span class="flavor-qty in">${item.quantity} left</span>
            </div>
          </div>
        </div>`).join("")}
      </div>
      <button class="modal-cancel" style="width:100%;margin-top:16px" id="btn-modal-cancel">Isara</button>
    </div></div>`;
  }
  if (state.pubInvView==="brands" && state.pubInvCategory) {
    const brands = getBrands(avail, state.pubInvCategory);
    return `<div class="modal-bg"><div class="modal-box">
      <div class="modal-title">📦 ${state.pubInvCategory}</div>
      <button class="back-btn" id="btn-cust-inv-back-cats">← Lahat ng Categories</button>
      <div class="brand-grid">
        ${brands.map(brand=>{
          const items = avail.filter(i=>getCatLabel(i.category)===state.pubInvCategory && i.brand===brand);
          const puffs = items[0]?.puffs||"";
          return `<div class="brand-card" data-cust-brand="${brand}">
            <div>
              <div class="brand-card-name">${brand}</div>
              <div class="brand-card-sub">${puffs?puffs+' puffs · ':''}${items.length} flavor${items.length!==1?'s':''} available</div>
            </div>
            <div class="brand-card-arrow">›</div>
          </div>`;
        }).join("")}
      </div>
      <button class="modal-cancel" style="width:100%;margin-top:16px" id="btn-modal-cancel">Isara</button>
    </div></div>`;
  }
  const cats = getCategories(avail);
  if (!cats.length) return `<div class="modal-bg"><div class="modal-box">
    <div class="modal-title">📦 What's Available Now?</div>
    <div class="empty"><div class="empty-icon">😔</div>Walang available ngayon.</div>
    <button class="modal-cancel" style="width:100%;margin-top:12px" id="btn-modal-cancel">Isara</button>
  </div></div>`;
  return `<div class="modal-bg"><div class="modal-box">
    <div class="modal-title">📦 What's Available Now?</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:16px">Piliin ang category:</div>
    <div class="cat-btn-grid">
      ${cats.map(cat=>{
        const count = getBrands(avail, cat).length;
        return `<button class="cat-btn" data-cust-cat="${cat}">
          <div><div class="cat-btn-name">${cat}</div><div class="cat-btn-count">${count} brand${count!==1?'s':''} available</div></div>
          <div style="font-size:18px;color:var(--muted)">›</div>
        </button>`;
      }).join("")}
    </div>
    <button class="modal-cancel" style="width:100%;margin-top:16px" id="btn-modal-cancel">Isara</button>
  </div></div>`;
}

// ─── MODAL BUILDERS ───────────────────────────────────
function buildModal() {
  const m=state.modal;
  return `<div class="modal-bg"><div class="modal-box">
    <div class="modal-title">${m.title}</div>
    <div class="modal-body">${m.body}</div>
    <div class="modal-btns">
      <button class="modal-cancel" id="btn-modal-cancel">Kanselahin</button>
      <button class="modal-confirm ${m.danger?'danger':''}" id="btn-modal-confirm">${m.confirmLabel}</button>
    </div>
  </div></div>`;
}

function buildUtangModal(c) {
  const utang=Array.isArray(c.utang)?c.utang:[];
  const unpaid=utang.filter(u=>(u.remaining??u.amount)>0);
  const options=unpaid.map(u=>`<option value="${u.id}">${u.note||'Utang'} — ${peso(u.remaining??u.amount)} natitira (${u.date})</option>`).join("");
  return `<div class="modal-bg"><div class="modal-box">
    <div class="modal-title">💰 Utang ni ${c.name}</div>
    <div style="margin-bottom:20px">
      <div class="section-label">Mag-record ng Bagong Utang</div>
      <label class="modal-label">Amount (₱)</label>
      <input class="modal-input" id="utang-amount" type="number" placeholder="500" inputmode="decimal" />
      <label class="modal-label">Note (optional)</label>
      <input class="modal-input" id="utang-note" type="text" placeholder="2 pods, vape, etc." />
      <button class="modal-confirm orange" style="width:100%;margin-top:4px" id="btn-add-utang">+ Idagdag ang Utang</button>
    </div>
    ${unpaid.length>0?`
    <div>
      <div class="section-label">Mag-record ng Bayad</div>
      <label class="modal-label">Piliin ang utang</label>
      <select class="modal-input" id="pay-utang-id" style="height:44px;padding:0 12px">${options}</select>
      <label class="modal-label">Amount na ibabayad (₱)</label>
      <input class="modal-input" id="pay-amount" type="number" placeholder="200" inputmode="decimal" />
      <button class="modal-confirm" style="width:100%;margin-top:4px" id="btn-add-payment">✓ I-record ang Bayad</button>
    </div>`:""}
    <button class="modal-cancel" style="width:100%;margin-top:12px" id="btn-modal-cancel">Isara</button>
  </div></div>`;
}

function buildEditInvModal(item) {
  return `<div class="modal-bg"><div class="modal-box">
    <div class="modal-title">Edit: ${item.brand}${item.flavor?' - '+item.flavor:''}</div>
    <label class="modal-label">Flavor</label>
    <input class="modal-input" id="edit-flavor" value="${item.flavor||''}" placeholder="Mango Ice" />
    <div class="modal-row" style="margin-bottom:10px">
      <div><label class="modal-label">Amount (₱)</label><input class="modal-input" id="edit-amount" type="number" value="${item.amount}" style="margin-bottom:0" /></div>
      <div><label class="modal-label">Quantity</label><input class="modal-input" id="edit-qty" type="number" value="${item.quantity}" style="margin-bottom:0" /></div>
    </div>
    <div class="modal-btns">
      <button class="modal-cancel" id="btn-modal-cancel">Kanselahin</button>
      <button class="modal-confirm" id="btn-save-inv" data-inv-id="${item.id}">I-save</button>
    </div>
  </div></div>`;
}

// ─── EVENTS ───────────────────────────────────────────
function bindEvents() {
  const on=(id,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener("click",fn);};

  // Public page navigation
  on("btn-go-login",()=>{ state.view="login"; state.loginMode="customer"; render(); });
  on("btn-back-home",()=>{ state.view="public"; render(); });
  on("btn-pub-back-cats",()=>{ state.pubInvView="categories"; state.pubInvCategory=null; state.pubInvBrand=null; render(); });
  on("btn-pub-back-brands",()=>{ state.pubInvView="brands"; state.pubInvBrand=null; render(); });
  document.querySelectorAll("[data-pub-cat]").forEach(el=>el.addEventListener("click",()=>{
    state.pubInvView="brands"; state.pubInvCategory=el.dataset.pubCat; render();
  }));
  document.querySelectorAll("[data-pub-brand]").forEach(el=>el.addEventListener("click",()=>{
    state.pubInvView="flavors"; state.pubInvBrand=el.dataset.pubBrand; render();
  }));

  // Login
  on("btn-login", doLogin);
  document.getElementById("inp-login")?.addEventListener("keydown",e=>{if(e.key==="Enter")doLogin();});
  document.getElementById("inp-login")?.addEventListener("input",e=>{e.target.value=e.target.value.replace(/\D/g,"").slice(0,8);});
  document.getElementById("inp-password")?.addEventListener("keydown",e=>{if(e.key==="Enter")doLogin();});
  on("switch-mode",()=>{state.loginMode=state.loginMode==="admin"?"customer":"admin";render();});
  on("btn-logout",async()=>{
    if(state.role==="admin") await sb.auth.signOut();
    state.role=null;state.customerId=null;state.loginMode="customer";
    state.showDebt=false; state.pubInvView="categories"; state.pubInvCategory=null; state.pubInvBrand=null;
    state.view="public"; render();
  });
  on("btn-toggle-debt",()=>{state.showDebt=!state.showDebt;render();});

  // Customer inventory (after login)
  on("btn-show-inv",async()=>{
    await dbLoadInventory();
    state.pubInvView="categories"; state.pubInvCategory=null; state.pubInvBrand=null;
    state.modal=()=>buildCustInvModal(); render(); bindCustInvEvents();
  });

  // Admin tabs
  document.querySelectorAll("[data-tab]").forEach(el=>el.addEventListener("click",()=>{
    state.tab=el.dataset.tab;
    if(state.tab==="add") state.previewCode=null;
    if(state.tab==="inventory") { state.adminInvView="categories"; state.adminInvCategory=null; state.adminInvBrand=null; }
    render();
  }));
  on("btn-regen",()=>{state.previewCode=genCode();const el=document.getElementById("code-preview");if(el)el.textContent=state.previewCode;});
  on("btn-add", doAddCustomer);
  on("btn-add-inv", doAddInventory);
  on("btn-add-location", doAddLocation);
  document.getElementById("inp-search")?.addEventListener("input",e=>{state.search=e.target.value;render();});

  // Location delete
  document.querySelectorAll("[data-loc-del]").forEach(el=>el.addEventListener("click",()=>{
    const id=el.dataset.locDel, loc=locations.find(l=>l.id===id);
    if(!loc) return;
    state.modal={
      title:"I-delete ang Location?",
      body:`Sigurado ka bang ide-delete ang <strong>${loc.name}</strong>?<br><br>Note: Hindi pwedeng i-delete kung may customers o inventory pa sa location na ito.`,
      confirmLabel:"Delete",
      danger:true,
      onConfirm:()=>doDeleteLocation(id)
    };
    render();
  }));

  // Admin inventory navigation
  on("btn-inv-back-cats",()=>{state.adminInvView="categories";state.adminInvCategory=null;state.adminInvBrand=null;render();});
  on("btn-inv-back-brands",()=>{state.adminInvView="brands";state.adminInvBrand=null;render();});
  document.querySelectorAll("[data-adm-cat]").forEach(el=>el.addEventListener("click",()=>{
    state.adminInvView="flavors"; state.adminInvCategory=el.dataset.admCat; state.adminInvBrand=el.dataset.admBrand; render();
  }));
  document.querySelectorAll("[data-adm-brand]").forEach(el=>el.addEventListener("click",()=>{
    state.adminInvView="flavors"; state.adminInvBrand=el.dataset.admBrand; render();
  }));

  // Inventory edit/delete
  document.querySelectorAll("[data-inv-edit]").forEach(el=>el.addEventListener("click",()=>{
    const id=el.dataset.invEdit, item=inventory.find(i=>i.id===id);
    if(!item) return;
    state.modal=()=>buildEditInvModal(item); render();
    on("btn-modal-cancel",()=>{state.modal=null;render();});
    on("btn-save-inv",async()=>{
      const flavor=(document.getElementById("edit-flavor")?.value||"").trim();
      const qty=parseInt(document.getElementById("edit-qty")?.value)||0;
      const amt=parseFloat(document.getElementById("edit-amount")?.value)||item.amount;
      await dbUpdateInventory(id,{flavor,quantity:qty,amount:amt});
      const idx=inventory.findIndex(i=>i.id===id);
      if(idx>-1){inventory[idx].flavor=flavor;inventory[idx].quantity=qty;inventory[idx].amount=amt;}
      state.modal=null; showToast("Na-update na! ✓"); render();
    });
  }));
  document.querySelectorAll("[data-inv-del]").forEach(el=>el.addEventListener("click",()=>{
    const id=el.dataset.invDel, item=inventory.find(i=>i.id===id);
    if(!item) return;
    state.modal={title:"I-delete ang Product?",body:`Sigurado ka bang ide-delete ang <strong>${item.brand}${item.flavor?' - '+item.flavor:''}</strong>?`,confirmLabel:"Delete",danger:true,onConfirm:async()=>{
      await dbDeleteInventory(id); inventory=inventory.filter(i=>i.id!==id);
      state.modal=null; showToast("Na-delete na!"); render();
    }};
    render();
  }));

  // Stamp/Redeem/Utang
  document.querySelectorAll("[data-action]").forEach(el=>el.addEventListener("click",()=>{
    const id=el.dataset.id, c=customers.find(x=>String(x.id)===String(id));
    if(!c) return;
    if(el.dataset.action==="stamp") {
      doStamp(c);
    } else if(el.dataset.action==="redeem") {
      state.modal={title:"I-redeem ang Reward?",body:`I-re-reset ang card ni <strong>${c.name}</strong>. Sigurado ka?`,confirmLabel:"Oo, I-redeem",onConfirm:()=>doRedeem(c)};
      render();
    } else if(el.dataset.action==="utang") {
      state.modal=()=>buildUtangModal(c); render();
      const onM=(id,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener("click",fn);};
      onM("btn-add-utang",()=>doAddUtang(c));
      onM("btn-add-payment",()=>doAddPayment(c));
      onM("btn-modal-cancel",()=>{state.modal=null;render();});
    }
  }));

  on("btn-modal-cancel",()=>{state.modal=null;render();});
  on("btn-modal-confirm",()=>{if(state.modal?.onConfirm)state.modal.onConfirm();});
}

function bindCustInvEvents() {
  const on=(id,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener("click",fn);};
  on("btn-modal-cancel",()=>{state.modal=null;render();});
  on("btn-cust-inv-back-cats",()=>{state.pubInvView="categories";state.pubInvCategory=null;state.pubInvBrand=null;state.modal=()=>buildCustInvModal();render();bindCustInvEvents();});
  on("btn-cust-inv-back-brands",()=>{state.pubInvView="brands";state.pubInvBrand=null;state.modal=()=>buildCustInvModal();render();bindCustInvEvents();});
  document.querySelectorAll("[data-cust-cat]").forEach(el=>el.addEventListener("click",()=>{state.pubInvView="brands";state.pubInvCategory=el.dataset.custCat;state.modal=()=>buildCustInvModal();render();bindCustInvEvents();}));
  document.querySelectorAll("[data-cust-brand]").forEach(el=>el.addEventListener("click",()=>{state.pubInvView="flavors";state.pubInvBrand=el.dataset.custBrand;state.modal=()=>buildCustInvModal();render();bindCustInvEvents();}));
}

// ─── ACTIONS ──────────────────────────────────────────
async function doLogin() {
  const errEl=document.getElementById("login-err"), btnEl=document.getElementById("btn-login");
  if (state.loginMode==="admin") {
    const email=(document.getElementById("inp-email")?.value||"").trim();
    const password=(document.getElementById("inp-password")?.value||"").trim();
    if(!email||!password) return;
    if(btnEl){btnEl.disabled=true;btnEl.textContent="Naglo-login...";}
    const {error}=await sb.auth.signInWithPassword({email,password});
    if(error){
      if(errEl) errEl.style.display="block";
      if(btnEl){btnEl.disabled=false;btnEl.textContent="Mag-login bilang Admin";}
      return;
    }
    state.view="loading"; render();
    await Promise.all([dbLoad(), dbLoadInventory(), dbLoadLocations()]);
    state.role="admin"; state.view="main"; render();
    return;
  }
  const val=(document.getElementById("inp-login")?.value||"").trim();
  if(!val) return;
  if(errEl) errEl.style.display="none";
  if(btnEl){btnEl.disabled=true;btnEl.textContent="Naghahanap...";}
  const cust=await dbGetByCode(val);
  if(cust){
    await Promise.all([dbLoadInventory(), dbLoadLocations()]);
    customers=[cust]; 
    state.role="customer"; 
    state.customerId=String(cust.id);
    state.customerLocation=cust.location_id;
    state.view="main"; 
    render();
  } else {
    if(errEl) errEl.style.display="block";
    if(btnEl){btnEl.disabled=false;btnEl.textContent="Enter";}
  }
}

async function doAddCustomer() {
  const name=(document.getElementById("inp-name")?.value||"").trim();
  const location_id=document.getElementById("inp-location")?.value||null;
  const code=state.previewCode;
  if(!name){showToast("Lagyan ng pangalan.");return;}
  if(!location_id){showToast("Piliin ang location.");return;}
  if(customers.find(c=>c.phone===code)){showToast("Duplicate code. I-click ang 🔄.");return;}
  state.busy=true; render();
  try {
    const newCust=await dbAdd(name,code,location_id);
    customers.push(newCust); state.previewCode=null; state.tab="customers";
    showToast(`Na-add si ${name}! Code: ${code} ✓`);
  } catch(e){showToast("Error: "+(e.message||"Hindi na-save."));}
  state.busy=false; render();
}

async function doAddInventory() {
  const category=(document.getElementById("inv-category")?.value||"").trim().toUpperCase()||"IBA PA";
  const brand=(document.getElementById("inv-brand")?.value||"").trim();
  const puffs=(document.getElementById("inv-puffs")?.value||"").trim();
  const flavor=(document.getElementById("inv-flavor")?.value||"").trim();
  const amount=parseFloat(document.getElementById("inv-amount")?.value);
  const quantity=parseInt(document.getElementById("inv-qty")?.value)||0;
  const location_id=document.getElementById("inv-location")?.value||null;
  if(!brand){showToast("Lagyan ng brand name.");return;}
  if(!amount||amount<=0){showToast("Lagyan ng tamang amount.");return;}
  if(!location_id){showToast("Piliin ang location.");return;}
  try {
    const newItem=await dbAddInventory({category,brand,puffs,flavor,amount,quantity,location_id});
    inventory.push(newItem);
    showToast(`Na-add ang ${brand}${flavor?' - '+flavor:''}! ✓`);
    ["inv-category","inv-brand","inv-puffs","inv-flavor","inv-amount","inv-qty","inv-location"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
    render();
  } catch(e){showToast("Error: "+(e.message||"Subukan ulit."));}
}

async function doStamp(c) {
  if((c.stamps||0)>=MAX_STAMPS) return;
  try {
    const newStamps=(c.stamps||0)+1, newHistory=[{date:dateNow(),type:"stamp"},...(c.history||[])];
    await dbUpdate(c.id,{stamps:newStamps,history:newHistory});
    c.stamps=newStamps; c.history=newHistory;
    showToast(`Stamp na-add kay ${c.name}! (${c.stamps}/${MAX_STAMPS}) ★`); render();
  } catch(e){showToast("Error: "+(e.message||"Subukan ulit."));}
}

async function doRedeem(c) {
  state.modal=null; render();
  try {
    const newHistory=[{date:dateNow(),type:"reward"},...(c.history||[])];
    await dbUpdate(c.id,{stamps:0,history:newHistory});
    c.stamps=0; c.history=newHistory;
    showToast(`Reward na-redeem ni ${c.name}! Card na-reset. 🎉`); render();
  } catch(e){showToast("Error: "+(e.message||"Subukan ulit."));}
}

async function doAddUtang(c) {
  const amount=parseFloat(document.getElementById("utang-amount")?.value);
  const note=(document.getElementById("utang-note")?.value||"").trim();
  if(!amount||amount<=0){showToast("Ilagay ang tamang amount.");return;}
  const newUtang=[{id:uid(),amount,remaining:amount,note,date:dateNow(),payments:[]},...(c.utang||[])];
  try {
    await dbUpdate(c.id,{utang:newUtang}); c.utang=newUtang;
    showToast(`Nai-record ang utang na ${peso(amount)} ni ${c.name}.`);
    state.modal=()=>buildUtangModal(c); render();
    const on=(id,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener("click",fn);};
    on("btn-add-utang",()=>doAddUtang(c)); on("btn-add-payment",()=>doAddPayment(c));
    on("btn-modal-cancel",()=>{state.modal=null;render();});
  } catch(e){showToast("Error: "+(e.message||"Subukan ulit."));}
}

async function doAddPayment(c) {
  const utangId=document.getElementById("pay-utang-id")?.value;
  const amount=parseFloat(document.getElementById("pay-amount")?.value);
  if(!utangId){showToast("Piliin ang utang.");return;}
  if(!amount||amount<=0){showToast("Ilagay ang tamang amount.");return;}
  const newUtang=(c.utang||[]).map(u=>{
    if(u.id!==utangId) return u;
    return {...u, remaining:Math.max(0,(u.remaining??u.amount)-amount), payments:[...(u.payments||[]),{amount,date:dateNow()}]};
  });
  try {
    await dbUpdate(c.id,{utang:newUtang}); c.utang=newUtang;
    showToast(`Nai-record ang bayad na ${peso(amount)} ni ${c.name}. ✓`);
    state.modal=()=>buildUtangModal(c); render();
    const on=(id,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener("click",fn);};
    on("btn-add-utang",()=>doAddUtang(c)); on("btn-add-payment",()=>doAddPayment(c));
    on("btn-modal-cancel",()=>{state.modal=null;render();});
  } catch(e){showToast("Error: "+(e.message||"Subukan ulit."));}
}

async function doAddLocation() {
  const name=(document.getElementById("loc-name")?.value||"").trim();
  if(!name){showToast("Lagyan ng location name.");return;}
  if(locations.length >= MAX_LOCATIONS){showToast(`Maximum ${MAX_LOCATIONS} locations lang pwede.`);return;}
  try {
    const newLoc=await dbAddLocation(name);
    locations.push(newLoc);
    showToast(`Na-add ang location: ${name} ✓`);
    document.getElementById("loc-name").value="";
    render();
  } catch(e){showToast("Error: "+(e.message||"Hindi na-save."));}
}

async function doDeleteLocation(id) {
  const customersInLocation = customers.filter(c => c.location_id === id);
  const inventoryInLocation = inventory.filter(i => i.location_id === id);
  
  if(customersInLocation.length > 0 || inventoryInLocation.length > 0) {
    showToast("Hindi pwedeng i-delete. May customers o inventory pa sa location.");
    return;
  }
  
  try {
    await dbDeleteLocation(id);
    locations = locations.filter(l => l.id !== id);
    showToast("Location na-delete ✓");
    state.modal=null;
    render();
  } catch(e){showToast("Error: "+(e.message||"Subukan ulit."));}
}

// ─── START ────────────────────────────────────────────
sb.auth.getSession().then(async ({data:{session}})=>{
  await dbLoadLocations();
  await dbLoadInventory();
  if(session){
    await dbLoad();
    state.role="admin"; state.view="main"; render();
  } else {
    state.view="public"; render();
  }
});
