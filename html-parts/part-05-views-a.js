/* =====================================================================================================
   NAVEGACIÓN, VISTAS: DASHBOARD · CLIENTES · PRODUCTOS
   ===================================================================================================== */

/* ---------- Definición de vistas y navegación (RN-02: solo módulos autorizados) ---------- */
const VIEW_DEFS = {
  dashboard: { label:'Dashboard',            icon:'dashboard', perm:'dashboard.view',   render:renderDashboard },
  clients:   { label:'Clientes',             icon:'users',     perm:'clients.view',     render:renderClients },
  products:  { label:'Productos',            icon:'package',   perm:'products.view',    render:renderProducts },
  sales:     { label:'Ventas',               icon:'cart',      perm:'sales.view',       render:renderSales },
  orders:    { label:'Pedidos',              icon:'truck',     perm:'orders.view',      render:renderOrders },
  reports:   { label:'Reportes',             icon:'chart',     perm:null,               render:renderReports },
  promotions:{ label:'Promociones',          icon:'tag',       perm:'promotions.view',  render:renderPromotions },
  returns:   { label:'Cambios y devoluciones', icon:'rotate',  perm:'returns.view',     render:renderReturns },
  support:   { label:'Atención al cliente',  icon:'msg',       perm:'support.view',     render:renderSupport },
  audit:     { label:'Auditoría',            icon:'history',   perm:'audit.view',       render:renderAuditView },
  users:     { label:'Usuarios y roles',     icon:'usercheck', perm:'users.view',       render:renderUsers }
};
const NAV_GROUPS = [
  { label:'Operación',      items:['dashboard','clients','products','sales','orders'] },
  { label:'Análisis',       items:['reports','promotions'] },
  { label:'Postventa',      items:['returns','support'] },
  { label:'Administración', items:['audit','users'] }
];
function canSeeView(key){
  if(key === 'reports') return hasPerm('reports.sales') || hasPerm('reports.stock');
  const def = VIEW_DEFS[key];
  return !!def && (!def.perm || hasPerm(def.perm));
}
function renderNav(){
  let html = '';
  NAV_GROUPS.forEach(group => {
    const visible = group.items.filter(canSeeView);
    if(!visible.length) return;
    html += '<div class="nav-group-label">' + group.label + '</div>';
    visible.forEach(key => {
      const def = VIEW_DEFS[key];
      html += '<div class="nav-item' + (currentView === key ? ' active' : '') + '" onclick="showView(\'' + key + '\')" role="button" tabindex="0" aria-current="' + (currentView === key ? 'page' : 'false') + '">' +
        icon(def.icon, 'w-[18px] h-[18px] flex-shrink-0') + '<span class="truncate">' + def.label + '</span>' +
      '</div>';
    });
  });
  document.getElementById('navMenu').innerHTML = html ||
    '<div class="px-5 py-4 text-white/40 text-xs">No hay módulos disponibles para tu rol.</div>';
}
function showView(key){
  if(!canSeeView(key)){
    toast('error', 'No cuentas con autorización para acceder al módulo «' + (VIEW_DEFS[key] ? VIEW_DEFS[key].label : key) + '» (EX-02 / RN-02).');
    return;
  }
  currentView = key;
  renderCurrentView();
  renderNav();
  if(window.innerWidth < 1024) toggleSidebar(false);
  window.scrollTo({ top:0 });
}
/* Relleno inicial de tablas dinámicas tras renderizar la vista */
const VIEW_AFTER = {
  clients:  function(){ var el = document.getElementById('clientsTableBody');   if(el) el.innerHTML = clientsRows(); },
  products: function(){ var el = document.getElementById('productsTableBody');  if(el) el.innerHTML = productsRows(); },
  sales:    function(){ var el = document.getElementById('salesTableBody');     if(el) el.innerHTML = salesRows(); },
  orders:   function(){ var el = document.getElementById('ordersTableBody');    if(el) el.innerHTML = ordersRows(); },
  audit:    function(){ var el = document.getElementById('auditTableBody');     if(el) el.innerHTML = auditRows(); }
};
function renderCurrentView(){
  const def = VIEW_DEFS[currentView];
  const content = document.getElementById('content');
  if(!def){ content.innerHTML = '<div class="empty-state"><div class="ico">' + icon('alert') + '</div><p class="text-sm font-medium">Vista no disponible.</p></div>'; return; }
  content.innerHTML = '<div class="view-enter">' + def.render() + '</div>';
  if(VIEW_AFTER[currentView]) VIEW_AFTER[currentView]();
  if(currentView === 'support') Chatbot.mountEmbedded('chatMount');
}
function renderAll(){
  if(!session) return;
  // datos de usuario en sidebar y cabecera
  document.getElementById('sbUserInit').textContent = initials(session.fullName);
  document.getElementById('sbUserName').textContent = session.fullName;
  document.getElementById('sbUserRole').textContent = session.roleName;
  document.getElementById('hdUserInit').textContent = initials(session.fullName);
  document.getElementById('hdUserName').textContent = session.fullName;
  document.getElementById('hdUserRole').textContent = session.roleName;
  // botón «Nueva venta» solo para roles autorizados
  document.getElementById('btnNewSale').classList.toggle('hidden', !hasPerm('sales.create'));
  renderNav();
  renderCurrentView();
}

/* ---------- Encabezado estándar de módulo ---------- */
function moduleHead(title, subtitle, actionsHtml, iconName){
  return '<div class="flex flex-wrap items-start justify-between gap-3 mb-5">' +
    '<div class="flex items-start gap-3 min-w-0">' +
      '<div class="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center flex-shrink-0">' + icon(iconName,'w-5 h-5') + '</div>' +
      '<div class="min-w-0">' +
        '<h2 class="text-lg sm:text-xl font-bold text-slate-900 leading-tight">' + title + '</h2>' +
        '<p class="text-[12.5px] text-slate-500 mt-0.5 leading-snug">' + subtitle + '</p>' +
      '</div>' +
    '</div>' +
    (actionsHtml ? '<div class="flex items-center gap-2 flex-wrap">' + actionsHtml + '</div>' : '') +
  '</div>';
}
function emptyRow(cols, msg, iconName){
  return '<tr><td colspan="' + cols + '"><div class="empty-state"><div class="ico">' + icon(iconName||'search') + '</div>' +
    '<p class="text-[13px] font-medium text-slate-500">' + msg + '</p></div></td></tr>';
}
function searchBox(id, placeholder, oninputFn, value){
  return '<div class="relative flex-1 min-w-[220px]">' +
    '<span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">' + icon('search','w-4 h-4') + '</span>' +
    '<input id="' + id + '" class="input !pl-10" placeholder="' + placeholder + '" value="' + escapeHtml(value||'') + '" oninput="' + oninputFn + '" />' +
  '</div>';
}
function paymentBadge(method){
  const map = { 'Efectivo':'b-green', 'Tarjeta':'b-violet', 'Yape/Plin':'b-teal' };
  const ic  = { 'Efectivo':'banknote', 'Tarjeta':'card', 'Yape/Plin':'phone' };
  return '<span class="badge ' + (map[method]||'b-slate') + '">' + icon(ic[method]||'wallet','w-3 h-3') + escapeHtml(method||'—') + '</span>';
}
function orderStateBadge(state){
  const map = { 'Preparando':'b-amber', 'Enviado':'b-teal', 'Entregado':'b-green' };
  return '<span class="badge ' + (map[state]||'b-slate') + '"><span class="dot"></span>' + escapeHtml(state||'—') + '</span>';
}
function requestStatusBadge(status){
  const map = { 'Pendiente':'b-amber', 'Aprobada':'b-green', 'Rechazada':'b-red' };
  return '<span class="badge ' + (map[status]||'b-slate') + '"><span class="dot"></span>' + escapeHtml(status||'—') + '</span>';
}

/* =====================================================================================================
   DASHBOARD (EP-08/HU-34-35 + KPIs, reposición, últimas ventas — actualización automática)
   ===================================================================================================== */
function renderDashboard(){
  const confirmed = DB.sales.filter(s => s.status === 'Confirmada');   // RN-17
  const ingresos  = confirmed.reduce((sum,s) => sum + s.total, 0);
  const lowProducts = DB.products.filter(isLowStock);
  const recentSales = confirmed.slice().sort((a,b) => new Date(b.at) - new Date(a.at)).slice(0,6);
  const stateCount = st => DB.orders.filter(o => o.state === st).length;

  const kpis = [
    { label:'Ventas confirmadas', value:confirmed.length, sub:'transacciones registradas', icon:'cart',   bg:'bg-brand-50',  fg:'text-brand-700' },
    { label:'Ingresos', value:fmtMoney(ingresos), sub:'total de ventas confirmadas', icon:'wallet', bg:'bg-emerald-50', fg:'text-emerald-700' },
    { label:'Productos', value:DB.products.length, sub:'en el catálogo', icon:'package', bg:'bg-violet-50', fg:'text-violet-700' },
    { label:'Stock bajo', value:lowProducts.length, sub:'requieren reposición', icon:'alert',  bg:'bg-amber-50',  fg:'text-amber-600' }
  ];

  let html = moduleHead('Dashboard', 'Resumen comercial en tiempo real — ventas, ingresos, inventario y pedidos.', '', 'dashboard');

  html += '<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">' +
    kpis.map(k =>
      '<div class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow">' +
        '<div class="w-12 h-12 rounded-xl ' + k.bg + ' ' + k.fg + ' grid place-items-center flex-shrink-0">' + icon(k.icon,'w-6 h-6') + '</div>' +
        '<div class="min-w-0">' +
          '<div class="text-[22px] font-extrabold text-slate-900 money leading-none truncate">' + k.value + '</div>' +
          '<div class="text-[12px] font-semibold text-slate-600 mt-1.5">' + k.label + '</div>' +
          '<div class="text-[11px] text-slate-400 mt-0.5">' + k.sub + '</div>' +
        '</div>' +
      '</div>'
    ).join('') + '</div>';

  /* Pedidos por estado */
  html += '<div class="grid grid-cols-3 gap-3 sm:gap-4 mb-6">' +
    ORDER_STATES.map(st => {
      const n = stateCount(st);
      const cls = st === 'Preparando' ? 'text-amber-600 bg-amber-50' : st === 'Enviado' ? 'text-teal-700 bg-teal-50' : 'text-emerald-700 bg-emerald-50';
      return '<div class="card p-4 flex items-center gap-3">' +
        '<div class="w-9 h-9 rounded-lg ' + cls + ' grid place-items-center flex-shrink-0">' + icon('truck','w-[18px] h-[18px]') + '</div>' +
        '<div class="min-w-0"><div class="text-lg font-extrabold text-slate-900 leading-none">' + n + '</div>' +
        '<div class="text-[11px] text-slate-500 font-medium mt-1">Pedidos «' + st + '»</div></div></div>';
    }).join('') + '</div>';

  html += '<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">';

  /* Reposición de inventario (HU-35, RN-18) */
  html += '<div class="card overflow-hidden">' +
    '<div class="px-5 pt-5 pb-3 flex items-center justify-between gap-3">' +
      '<div class="flex items-center gap-2.5">' +
        '<span class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 grid place-items-center">' + icon('bell','w-4 h-4') + '</span>' +
        '<div><h3 class="text-[15px] font-bold text-slate-900 leading-tight">Reposición de inventario</h3>' +
        '<p class="text-[11.5px] text-slate-500">Productos con stock ≤ stock mínimo</p></div>' +
      '</div>' +
      (canSeeView('reports') ? '<button class="btn btn-ghost btn-sm" onclick="showView(\'reports\')">Ver reporte ' + icon('arrowright','w-3.5 h-3.5') + '</button>' : '') +
    '</div>' +
    '<div class="px-5 pb-2 max-h-72 overflow-y-auto scroll-styled"><div class="tblwrap !border-0 !rounded-none">' +
      '<table class="tbl"><thead><tr><th>Producto</th><th class="num">Stock</th><th class="num">Mínimo</th><th>Estado</th>' + (hasPerm('products.adjust') ? '<th></th>' : '') + '</tr></thead><tbody>';
  if(!lowProducts.length){
    html += emptyRow(hasPerm('products.adjust') ? 5 : 4, 'No hay productos que requieran reposición por ahora.', 'check');
  }else{
    lowProducts.forEach(p => {
      const st = stockStatus(p);
      html += '<tr><td><div class="font-semibold">' + escapeHtml(p.name) + '</div><div class="text-[11px] text-slate-400">' + escapeHtml(p.code) + '</div></td>' +
        '<td class="num font-bold ' + (p.stock === 0 ? 'text-rose-600' : 'text-amber-600') + '">' + p.stock + '</td>' +
        '<td class="num text-slate-400">' + p.minStock + '</td>' +
        '<td><span class="badge ' + st.cls + '"><span class="dot"></span>' + st.label + '</span></td>' +
        (hasPerm('products.adjust') ? '<td class="num"><button class="btn btn-outline btn-sm" onclick="openAdjust(' + p.id + ')">' + icon('plus','w-3.5 h-3.5') + ' Ajustar</button></td>' : '') + '</tr>';
    });
  }
  html += '</tbody></table></div></div></div>';

  /* Últimas ventas (actualización automática) */
  html += '<div class="card overflow-hidden">' +
    '<div class="px-5 pt-5 pb-3 flex items-center justify-between gap-3">' +
      '<div class="flex items-center gap-2.5">' +
        '<span class="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 grid place-items-center">' + icon('cart','w-4 h-4') + '</span>' +
        '<div><h3 class="text-[15px] font-bold text-slate-900 leading-tight">Últimas ventas</h3>' +
        '<p class="text-[11.5px] text-slate-500">Operaciones confirmadas más recientes</p></div>' +
      '</div>' +
      (canSeeView('sales') ? '<button class="btn btn-ghost btn-sm" onclick="showView(\'sales\')">Ver todas ' + icon('arrowright','w-3.5 h-3.5') + '</button>' : '') +
    '</div>' +
    '<div class="px-5 pb-4 max-h-72 overflow-y-auto scroll-styled divide-y divide-slate-100">';
  if(!recentSales.length){
    html += '<div class="empty-state"><div class="ico">' + icon('cart') + '</div><p class="text-[13px] font-medium text-slate-500">Aún no hay ventas registradas.</p></div>';
  }else{
    recentSales.forEach(s => {
      const client = clientById(s.clientId);
      const order = orderBySaleId(s.id);
      html += '<div class="flex items-center gap-3 py-3 hover:bg-slate-50/60 rounded-lg px-1 -mx-1 transition">' +
        '<div class="avatar w-9 h-9 text-[12px]">' + initials(client.name) + '</div>' +
        '<div class="min-w-0 flex-1">' +
          '<div class="flex items-center gap-2 flex-wrap"><span class="text-[13px] font-bold text-slate-800">' + escapeHtml(s.code) + '</span>' + paymentBadge(paymentBySaleId(s.id) ? paymentBySaleId(s.id).method : '—') + (order ? orderStateBadge(order.state) : '') + '</div>' +
          '<div class="text-[11.5px] text-slate-500 truncate">' + escapeHtml(client.name) + ' · ' + escapeHtml(s.userName) + ' · ' + timeAgo(s.at) + '</div>' +
        '</div>' +
        '<div class="text-right flex items-center gap-2 flex-shrink-0">' +
          '<span class="text-[14px] font-extrabold text-slate-900 money">' + fmtMoney(s.total) + '</span>' +
          (hasPerm('sales.view') ? '<button class="btn btn-ghost btn-icon" title="Ver comprobante" onclick="openReceipt(' + s.id + ')">' + icon('eye','w-4 h-4') + '</button>' : '') +
        '</div></div>';
    });
  }
  html += '</div></div></div>';
  return html;
}

/* =====================================================================================================
   CLIENTES (EP-02: HU-04 registro, HU-05 búsqueda, HU-06 historial, HU-07 actualización)
   ===================================================================================================== */
function renderClients(){
  let html = moduleHead('Clientes', 'Registro, búsqueda, consulta e historial de compras (EP-02 · HU-04 a HU-07).',
    (hasPerm('clients.create') ? '<button class="btn btn-primary btn-sm" onclick="openClientForm()">' + icon('plus','w-4 h-4') + ' Registrar cliente</button>' : ''),
    'users');

  html += '<div class="flex flex-wrap gap-2 mb-4">' +
    searchBox('clientSearch', 'Buscar por DNI, nombre, teléfono o correo…', 'searchClients()', UI.clientSearch) +
    '<span class="badge b-slate self-center" id="clientsCount"></span>' +
  '</div>';

  html += '<div class="tblwrap"><table class="tbl"><thead><tr>' +
    '<th>DNI</th><th>Cliente</th><th>Correo</th><th>Teléfono</th><th class="num">Compras</th><th>Registrado</th><th class="num">Acciones</th>' +
  '</tr></thead><tbody id="clientsTableBody"></tbody></table></div>';
  return html;
}
function clientsRows(){
  const q = normalizeText(UI.clientSearch);
  const list = DB.clients
    .filter(c => !q || [c.dni, c.name, c.email, c.phone].some(v => normalizeText(v).includes(q)))
    .sort((a,b) => a.name.localeCompare(b.name));
  document.getElementById('clientsCount').textContent = list.length + ' de ' + DB.clients.length + ' clientes';
  if(!list.length){
    return DB.clients.length
      ? emptyRow(7, 'No se encontraron clientes con los criterios de búsqueda (EX-13).', 'search')
      : emptyRow(7, 'Aún no hay clientes registrados. Registra el primero.', 'users');
  }
  return list.map(c => {
    const compras = clientSales(c.id);
    const totalGastado = compras.reduce((s,x) => s + x.total, 0);
    return '<tr>' +
      '<td class="font-mono text-[13px] font-semibold text-slate-600">' + escapeHtml(c.dni) + '</td>' +
      '<td><div class="flex items-center gap-2.5"><div class="avatar w-8 h-8 text-[11px]">' + initials(c.name) + '</div>' +
        '<div class="min-w-0"><div class="font-semibold">' + escapeHtml(c.name) + '</div><div class="text-[11px] text-slate-400">Cliente desde ' + fmtDate(c.createdAt) + '</div></div></div></td>' +
      '<td class="text-slate-600">' + escapeHtml(c.email) + '</td>' +
      '<td class="text-slate-600">' + (c.phone ? escapeHtml(c.phone) : '—') + '</td>' +
      '<td class="num"><span class="font-bold text-slate-800">' + compras.length + '</span>' + (compras.length ? ' <span class="text-[11px] text-slate-400">(' + fmtMoney(totalGastado) + ')</span>' : '') + '</td>' +
      '<td class="text-slate-500 text-[12.5px]">' + fmtDate(c.createdAt) + '</td>' +
      '<td class="num"><div class="flex items-center justify-end gap-1.5">' +
        '<button class="btn btn-outline btn-icon" title="Ver cliente e historial de compras" onclick="openClient(' + c.id + ')">' + icon('eye','w-4 h-4') + '</button>' +
        (hasPerm('clients.edit') ? '<button class="btn btn-outline btn-icon" title="Editar cliente" onclick="openClientForm(' + c.id + ')">' + icon('pencil','w-4 h-4') + '</button>' : '') +
      '</div></td></tr>';
  }).join('');
}
function searchClients(){
  UI.clientSearch = document.getElementById('clientSearch').value;
  document.getElementById('clientsTableBody').innerHTML = clientsRows();
}

/* =====================================================================================================
   PRODUCTOS E INVENTARIO (EP-03 + EP-04: registro, búsqueda, consulta, stock, mínimo, origen)
   ===================================================================================================== */
function renderProducts(){
  let html = moduleHead('Productos e inventario', 'Catálogo, precios, stock, stock mínimo y origen (EP-03 · EP-04 · RN-04, RN-05, RN-18).',
    (hasPerm('products.create') ? '<button class="btn btn-primary btn-sm" onclick="openProduct()">' + icon('plus','w-4 h-4') + ' Registrar producto</button>' : ''),
    'package');

  html += '<div class="flex flex-wrap gap-2 mb-4">' +
    searchBox('productSearch', 'Buscar por nombre, código o categoría (HU-09)…', 'searchProducts()', UI.productSearch) +
    '<select class="select !w-auto min-w-[170px]" id="productCategory" onchange="searchProducts()">' +
      '<option value="">Todas las categorías</option>' +
      DB.categories.map(c => '<option value="' + c.id + '"' + (String(UI.productCategory) === String(c.id) ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>').join('') +
    '</select>' +
    '<span class="badge b-slate self-center" id="productsCount"></span>' +
  '</div>';

  html += '<div class="tblwrap"><table class="tbl"><thead><tr>' +
    '<th>Código</th><th>Producto</th><th>Categoría</th><th class="num">Precio</th><th class="num">Stock / Mín.</th><th>Origen</th><th>Estado</th><th class="num">Acciones</th>' +
  '</tr></thead><tbody id="productsTableBody"></tbody></table></div>';
  return html;
}
function productsRows(){
  const q = normalizeText(UI.productSearch);
  const cat = UI.productCategory;
  const list = DB.products.filter(p => {
    const okCat = !cat || String(p.categoryId) === String(cat);
    const okQ = !q || [p.name, p.code, categoryName(p.categoryId), p.description].some(v => normalizeText(v).includes(q));
    return okCat && okQ;
  });
  document.getElementById('productsCount').textContent = list.length + ' de ' + DB.products.length + ' productos';
  if(!list.length){
    return DB.products.length
      ? emptyRow(8, 'No se encontraron productos con los criterios de búsqueda (EX-03).', 'search')
      : emptyRow(8, 'Aún no hay productos registrados en el catálogo.', 'package');
  }
  return list.map(p => {
    const st = stockStatus(p);
    const promo = bestPromoFor(p);
    return '<tr>' +
      '<td class="font-mono text-[12.5px] font-bold text-brand-700">' + escapeHtml(p.code) + '</td>' +
      '<td><div class="font-semibold leading-tight">' + escapeHtml(p.name) + '</div>' +
        '<div class="text-[11px] text-slate-400 line-clamp-1 max-w-[260px]">' + escapeHtml(p.description || '') + '</div>' +
        (promo ? '<div class="mt-1"><span class="badge b-teal">' + icon('percent','w-3 h-3') + escapeHtml(promo.name) + ' vigente</span></div>' : '') + '</td>' +
      '<td><span class="badge b-slate">' + escapeHtml(categoryName(p.categoryId)) + '</span></td>' +
      '<td class="num font-bold money">' + fmtMoney(p.price) + '</td>' +
      '<td class="num"><span class="font-bold ' + (p.stock === 0 ? 'text-rose-600' : p.stock <= p.minStock ? 'text-amber-600' : 'text-slate-800') + '">' + p.stock + '</span>' +
        '<span class="text-slate-300"> / ' + p.minStock + '</span></td>' +
      '<td><span class="badge ' + (p.origin === 'FALABELLA' ? 'b-teal' : 'b-slate') + '">' + (p.origin === 'FALABELLA' ? icon('store','w-3 h-3') : icon('users','w-3 h-3')) + escapeHtml(p.origin) + '</span></td>' +
      '<td><span class="badge ' + st.cls + '"><span class="dot"></span>' + st.label + '</span></td>' +
      '<td class="num"><div class="flex items-center justify-end gap-1.5">' +
        '<button class="btn btn-outline btn-icon" title="Consultar información del producto (HU-10)" onclick="openProductInfo(' + p.id + ')">' + icon('eye','w-4 h-4') + '</button>' +
        (hasPerm('products.edit') ? '<button class="btn btn-outline btn-icon" title="Editar producto" onclick="openProduct(' + p.id + ')">' + icon('pencil','w-4 h-4') + '</button>' : '') +
        (hasPerm('products.adjust') ? '<button class="btn btn-outline btn-icon" title="Ajustar inventario (HU-13)" onclick="openAdjust(' + p.id + ')">' + icon('repeat','w-4 h-4') + '</button>' : '') +
      '</div></td></tr>';
  }).join('');
}
function searchProducts(){
  UI.productSearch = document.getElementById('productSearch').value;
  UI.productCategory = document.getElementById('productCategory').value;
  document.getElementById('productsTableBody').innerHTML = productsRows();
}
