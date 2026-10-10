/* =====================================================================================================
   UTILIDADES, ALMACENAMIENTO, AUTENTICACIÓN Y PERMISOS
   ===================================================================================================== */

/* ---------- Helpers de formato ---------- */
function escapeHtml(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmtMoney(n){ return 'S/ ' + (Number(n)||0).toFixed(2); }
function fmtDate(iso){
  if(!iso) return '—';
  const dt = new Date(iso);
  return dt.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function fmtDateTime(iso){
  if(!iso) return '—';
  const dt = new Date(iso);
  return dt.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' }) + ' ' +
         dt.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' });
}
function timeAgo(iso){
  if(!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff/60000);
  if(mins < 1)   return 'hace instantes';
  if(mins < 60)  return 'hace ' + mins + ' min';
  const hrs = Math.floor(mins/60);
  if(hrs < 24)   return 'hace ' + hrs + (hrs===1?' hora':' horas');
  const days = Math.floor(hrs/24);
  if(days < 30)  return 'hace ' + days + (days===1?' día':' días');
  return fmtDate(iso);
}
function normalizeText(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}
function round2(n){ return Math.round((Number(n)||0)*100)/100; }
function pad4(n){ return String(n).padStart(4,'0'); }
function nextId(arr){ return arr.reduce((m,x) => Math.max(m, x.id||0), 0) + 1; }
function initials(name){
  const parts = String(name||'?').trim().split(/\s+/);
  return ((parts[0]||'')[0]||'?').toUpperCase() + ((parts[1]||'')[0]||'').toUpperCase();
}
function parseDigits(s){ return String(s||'').replace(/\D/g,''); }

/* ---------- Persistencia (localStorage · clave falabella_demo_v1) ---------- */
function save(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }
  catch(e){ console.error('No se pudo guardar el estado en localStorage:', e); }
}
function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return null;
    const data = JSON.parse(raw);
    if(data && Array.isArray(data.products) && Array.isArray(data.sales)) return data;
  }catch(e){ console.warn('Estado guardado corrupto; se regenerará la demo.', e); }
  return null;
}

/* ---------- Búsquedas / relaciones entre entidades ---------- */
function byId(arr, id){ return arr.find(x => x.id === id) || null; }
function clientById(id){ return id === 0 ? { id:0, dni:'—', name:'Cliente general', email:'—', phone:'—' } : byId(DB.clients, id); }
function productById(id){ return byId(DB.products, id); }
function categoryById(id){ return byId(DB.categories, id); }
function userById(id){ return byId(DB.users, id); }
function roleById(id){ return byId(DB.roles, id); }
function saleById(id){ return byId(DB.sales, id); }
function saleByCode(code){ return DB.sales.find(s => normalizeText(s.code) === normalizeText(code)) || null; }
function orderById(id){ return byId(DB.orders, id); }
function orderByCode(code){ return DB.orders.find(o => normalizeText(o.code) === normalizeText(code)) || null; }
function orderBySaleId(saleId){ return DB.orders.find(o => o.saleId === saleId) || null; }
function receiptBySaleId(saleId){ return DB.receipts.find(r => r.saleId === saleId) || null; }
function paymentBySaleId(saleId){ return DB.payments.find(p => p.saleId === saleId && p.status === 'Aprobado') || null; }
function saleDetailsOf(saleId){ return DB.saleDetails.filter(dt => dt.saleId === saleId); }
function clientSales(clientId){ return DB.sales.filter(s => s.clientId === clientId).sort((a,b) => b.id - a.id); }
function categoryName(id){ const c = categoryById(id); return c ? c.name : '—'; }

/* ---------- Estado de stock (HU-12, HU-15, RN-18) ---------- */
function stockStatus(p){
  if(p.stock === 0) return { label:'Sin stock',  cls:'b-red',   dot:'#dc2626', icon:'x' };
  if(p.stock <= p.minStock) return { label:'Bajo stock', cls:'b-amber', dot:'#d97706', icon:'alert' };
  return { label:'En stock',  cls:'b-green',  dot:'#0d9488', icon:'check' };
}
function isLowStock(p){ return p.stock <= p.minStock; }

/* ---------- Alertas de stock (HU-15, RN-18) ---------- */
function updateStockAlerts(product){
  if(!product) return;
  const alert = DB.stockAlerts.find(a => a.productId === product.id && !a.resolved);
  if(isLowStock(product)){
    if(!alert){
      DB.stockAlerts.push({ id:nextId(DB.stockAlerts), productId:product.id, code:product.code,
        currentStock:product.stock, minStock:product.minStock, at:new Date().toISOString(), resolved:false });
    }else{
      alert.currentStock = product.stock; alert.minStock = product.minStock;
    }
  }else if(alert){ alert.resolved = true; }
}

/* ---------- Promociones vigentes (HU-19, RN-08, EX-07) ---------- */
function promoStatus(promo){
  const now = new Date();
  const start = new Date(promo.startDate), end = new Date(promo.endDate);
  if(now < start) return 'Programada';
  if(now > end)   return 'Vencida';
  return 'Vigente';
}
function isPromoApplicable(promo, product){
  if(!promo.active) return false;
  if(promoStatus(promo) !== 'Vigente') return false;                    // EX-07: vencida/no aplicable → no se aplica
  if(promo.scope === 'category') return product.categoryId === promo.categoryId;
  if(promo.scope === 'product')  return DB.promotionProducts.some(pp => pp.promotionId === promo.id && pp.productId === product.id);
  return false;
}
function bestPromoFor(product){
  let best = null;
  DB.promotions.forEach(pr => {
    if(isPromoApplicable(pr, product) && (!best || pr.value > best.value)) best = pr;
  });
  return best;
}
/* Cálculo de totales de una venta (HU-18, HU-19) */
function computeSaleTotals(items){
  let subtotal = 0, discount = 0;
  const applied = [];
  items.forEach(it => {
    const p = productById(it.productId);
    if(!p) return;
    const line = p.price * it.qty;
    subtotal += line;
    const promo = bestPromoFor(p);
    if(promo){
      const amount = round2(line * promo.value / 100);
      discount += amount;
      const row = applied.find(a => a.promotionId === promo.id);
      if(row) row.amount = round2(row.amount + amount); else applied.push({ promotionId:promo.id, code:promo.code, name:promo.name, amount });
    }
  });
  return { subtotal:round2(subtotal), discount:round2(discount), total:round2(subtotal - discount), applied };
}

/* ---------- Auditoría (HU-03, RN-03) ---------- */
function audit(operation, detail){
  DB.audits.push({
    id: nextId(DB.audits),
    at: new Date().toISOString(),
    username: session ? session.username : 'sistema',
    user: session ? session.fullName : 'Sistema',
    operation, detail
  });
  if(DB.audits.length > 600) DB.audits = DB.audits.slice(-600);
  save();
}

/* ---------- Autenticación y permisos (EP-01, RN-01, RN-02, EX-01, EX-02) ---------- */
function restoreSession(){
  try{
    const uname = sessionStorage.getItem(SESSION_KEY);
    if(!uname) return null;
    const user = DB.users.find(u => u.username === uname && u.active);
    if(!user) return null;
    const role = roleById(user.roleId);
    return { userId:user.id, username:user.username, fullName:user.fullName, roleId:user.roleId, roleName: role ? role.name : '—' };
  }catch(e){ return null; }
}
function handleLogin(ev){
  if(ev) ev.preventDefault();
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  doLogin(user, pass);
  return false;
}
function doLogin(username, password){
  hideLoginError();
  if(!username || !password){ showLoginError('Ingresa tu usuario y contraseña para continuar.'); return false; }
  const user = DB.users.find(u => normalizeText(u.username) === normalizeText(username));
  if(!user || user.password !== password){
    showLoginError('Usuario o contraseña incorrectos (EX-01). Verifica tus credenciales e inténtalo de nuevo.');
    return false;
  }
  session = { userId:user.id, username:user.username, fullName:user.fullName, roleId:user.roleId, roleName: roleById(user.roleId).name };
  try{ sessionStorage.setItem(SESSION_KEY, user.username); }catch(e){}
  audit('Inicio de sesión', user.username + ' inició sesión (' + session.roleName + ')');
  enterApp();
  toast('success', 'Sesión iniciada como ' + user.fullName + ' — ' + session.roleName + '.');
  return true;
}
function logout(){
  if(session) audit('Cierre de sesión', session.username + ' cerró su sesión');
  session = null;
  try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
  currentView = 'dashboard';
  document.getElementById('appView').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('chatFab').classList.add('hidden');
  document.getElementById('chatPanel').classList.add('hidden');
  document.getElementById('loginPass').value = '';
  toast('info', 'Cerraste tu sesión de forma segura (HU-01).');
}
function hasPerm(code){
  if(!session) return false;
  const perm = DB.permissions.find(p => p.code === code);
  if(!perm) return false;
  return DB.rolePermissions.some(rp => rp.roleId === session.roleId && rp.permissionId === perm.id);
}
function requirePerm(code, msg){
  if(hasPerm(code)) return true;
  toast('error', msg || 'No cuentas con autorización para esta función (EX-02).');
  return false;
}
function fillLogin(u, p){
  document.getElementById('loginUser').value = u;
  document.getElementById('loginPass').value = p;
  hideLoginError();
  document.getElementById('loginPass').focus();
}
function showLoginError(msg){
  const box = document.getElementById('loginError');
  document.getElementById('loginErrorMsg').textContent = msg;
  document.getElementById('loginErrorIcon').innerHTML = icon('alert','w-4 h-4');
  box.classList.remove('hidden');
}
function hideLoginError(){ document.getElementById('loginError').classList.add('hidden'); }

function enterApp(){
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  document.getElementById('chatFab').classList.remove('hidden');
  renderAll();
}

/* ---------- Toasts (notificaciones modernas) ---------- */
const TOAST_META = {
  success:{ icon:'check',  color:'text-teal-700',  bg:'bg-teal-50'  },
  error:{   icon:'x',     color:'text-rose-600',  bg:'bg-rose-50'  },
  warning:{ icon:'alert', color:'text-amber-600',  bg:'bg-amber-50' },
  info:{    icon:'info',  color:'text-teal-700',  bg:'bg-teal-50'  }
};
function toast(type, msg){
  const root = document.getElementById('toastRoot');
  const meta = TOAST_META[type] || TOAST_META.info;
  const el = document.createElement('div');
  el.className = 'toast-card ' + type;
  el.setAttribute('role','status');
  el.innerHTML =
    '<span class="' + meta.bg + ' ' + meta.color + ' w-7 h-7 rounded-full grid place-items-center flex-shrink-0">' + icon(meta.icon,'w-4 h-4') + '</span>' +
    '<div class="text-[13px] leading-relaxed text-slate-700 pt-0.5">' + escapeHtml(msg) + '</div>';
  root.appendChild(el);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 320); }, 4200);
  if(root.childElementCount > 4) root.firstElementChild.remove();
}

/* ---------- Sistema de modales ---------- */
function openModal(html, opts){
  opts = opts || {};
  const root = document.getElementById('modalRoot');
  root.innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this) closeModal()">' +
      '<div class="modal-card" style="max-width:' + (opts.maxWidth || '560px') + '" role="dialog" aria-modal="true">' + html + '</div>' +
    '</div>';
  document.body.style.overflow = 'hidden';
}
function closeModal(){
  document.getElementById('modalRoot').innerHTML = '';
  document.body.style.overflow = '';
  SALE = null; CLIENT_EDIT = null; PRODUCT_EDIT = null; ADJUST_PRODUCT = null;
  RETURN_CTX = { saleId:null }; CHANGE_CTX = { saleId:null }; EVALUATE_CTX = null;
}
function modalHead(title, subtitle, opts){
  opts = opts || {};
  return '<div class="modal-head">' +
    '<div class="min-w-0">' +
      '<h3 class="text-[16px] font-bold text-slate-900 leading-tight">' + title + '</h3>' +
      (subtitle ? '<p class="text-[12px] text-slate-500 mt-0.5 leading-snug">' + subtitle + '</p>' : '') +
    '</div>' +
    '<button class="btn btn-outline btn-icon no-print" onclick="closeModal()" aria-label="Cerrar" title="Cerrar (Esc)">' + icon('x','w-4 h-4') + '</button>' +
  '</div>';
}
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && document.getElementById('modalRoot').firstChild) closeModal();
});

/* ---------- Sidebar móvil ---------- */
function toggleSidebar(force){
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebarBackdrop');
  const open = typeof force === 'boolean' ? force : sb.classList.contains('-translate-x-full');
  if(open){ sb.classList.remove('-translate-x-full'); bd.classList.remove('hidden'); }
  else{ sb.classList.add('-translate-x-full'); bd.classList.add('hidden'); }
}
