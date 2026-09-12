/* =====================================================================================================
   VENTAS (EP-05 + EP-06) · PEDIDOS (EP-07: HU-26, HU-27) · REPORTES (EP-08: HU-31 a HU-35)
   ===================================================================================================== */

/* ---------- Ventas: listado ---------- */
function renderSales(){
  let html = moduleHead('Ventas', 'Ventas confirmadas con detalle, pagos, comprobantes y pedidos asociados (EP-05 · EP-06).',
    (hasPerm('sales.create') ? '<button class="btn btn-primary btn-sm" onclick="openSale()">' + icon('plus','w-4 h-4') + ' Nueva venta</button>' : ''),
    'cart');

  html += '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">' +
    kpiMini('Ventas confirmadas', DB.sales.filter(s => s.status === 'Confirmada').length, 'cart', 'bg-brand-50 text-brand-700') +
    kpiMini('Ingresos', fmtMoney(DB.sales.filter(s => s.status === 'Confirmada').reduce((t,s) => t + s.total, 0)), 'wallet', 'bg-emerald-50 text-emerald-700') +
    kpiMini('Descuentos aplicados', fmtMoney(DB.salePromotions.reduce((t,sp) => t + sp.amount, 0)), 'percent', 'bg-violet-50 text-violet-700') +
    kpiMini('Pagos rechazados', DB.payments.filter(p => p.status === 'Rechazado').length, 'x', 'bg-rose-50 text-rose-600') +
  '</div>';

  html += '<div class="flex flex-wrap gap-2 mb-4">' +
    searchBox('salesSearch', 'Buscar por código de venta o cliente…', 'searchSales()', UI.salesSearch) +
    '<span class="badge b-slate self-center" id="salesCount"></span>' +
  '</div>';

  html += '<div class="tblwrap"><table class="tbl"><thead><tr>' +
    '<th>Venta</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Productos</th><th class="num">Total</th><th>Pago</th><th>Pedido</th><th class="num">Acciones</th>' +
  '</tr></thead><tbody id="salesTableBody"></tbody></table></div>';
  return html;
}
function kpiMini(label, value, ic, cls){
  return '<div class="card p-4 flex items-center gap-3">' +
    '<div class="w-9 h-9 rounded-lg ' + cls + ' grid place-items-center flex-shrink-0">' + icon(ic,'w-[18px] h-[18px]') + '</div>' +
    '<div class="min-w-0"><div class="text-[17px] font-extrabold text-slate-900 money leading-none truncate">' + value + '</div>' +
    '<div class="text-[11px] text-slate-500 font-medium mt-1 truncate">' + label + '</div></div></div>';
}
function salesRows(){
  const q = normalizeText(UI.salesSearch);
  const list = DB.sales.slice().sort((a,b) => b.id - a.id)
    .filter(s => !q || [s.code, s.userName, clientById(s.clientId).name].some(v => normalizeText(v).includes(q)));
  document.getElementById('salesCount').textContent = list.length + ' de ' + DB.sales.length + ' ventas';
  if(!list.length){
    return DB.sales.length
      ? emptyRow(9, 'No se encontraron ventas con los criterios de búsqueda.', 'search')
      : emptyRow(9, 'Aún no hay ventas registradas. Confirma tu primera venta.', 'cart');
  }
  return list.map(s => {
    const details = saleDetailsOf(s.id);
    const units = details.reduce((t,dt) => t + dt.qty, 0);
    const pay = paymentBySaleId(s.id);
    const order = orderBySaleId(s.id);
    return '<tr>' +
      '<td><span class="font-bold text-brand-700">' + escapeHtml(s.code) + '</span><div class="text-[10.5px] text-slate-400">' + (receiptBySaleId(s.id) ? escapeHtml(receiptBySaleId(s.id).code) : '') + '</div></td>' +
      '<td class="text-slate-600 text-[12.5px]">' + fmtDateTime(s.at) + '</td>' +
      '<td><div class="flex items-center gap-2"><div class="avatar w-7 h-7 text-[10px]">' + initials(clientById(s.clientId).name) + '</div><span class="font-medium">' + escapeHtml(clientById(s.clientId).name) + '</span></div></td>' +
      '<td class="text-slate-600">' + escapeHtml(s.userName) + '</td>' +
      '<td class="text-slate-600 text-[12.5px]">' + details.length + ' art. · ' + units + ' u.</td>' +
      '<td class="num font-extrabold money">' + fmtMoney(s.total) + (s.discount > 0 ? '<div class="text-[10.5px] text-violet-600 font-semibold">−' + fmtMoney(s.discount) + ' promociones</div>' : '') + '</td>' +
      '<td>' + paymentBadge(pay ? pay.method : '—') + (pay ? '<div class="mt-1 text-[10.5px] font-semibold ' + (pay.status === 'Aprobado' ? 'text-emerald-600' : 'text-rose-600') + '">' + pay.status + '</div>' : '') + '</td>' +
      '<td>' + (order ? orderStateBadge(order.state) + '<div class="text-[10.5px] text-slate-400 mt-1">' + escapeHtml(order.code) + '</div>' : '<span class="text-slate-300">—</span>') + '</td>' +
      '<td class="num"><div class="flex items-center justify-end gap-1.5">' +
        '<button class="btn btn-outline btn-sm" onclick="openReceipt(' + s.id + ')">' + icon('printer','w-3.5 h-3.5') + ' Comprobante</button>' +
      '</div></td></tr>';
  }).join('');
}
function searchSales(){
  UI.salesSearch = document.getElementById('salesSearch').value;
  document.getElementById('salesTableBody').innerHTML = salesRows();
}

/* ---------- Pedidos: listado (HU-26, HU-27, RN-13) ---------- */
function renderOrders(){
  let html = moduleHead('Pedidos', 'Cada venta confirmada genera un pedido con seguimiento de estado (RN-13 · HU-26).', '', 'truck');

  html += '<div class="grid grid-cols-3 gap-3 mb-5">' +
    ORDER_STATES.map(st =>
      '<div class="card p-4 flex items-center gap-3">' +
        '<div class="w-9 h-9 rounded-lg ' + (st === 'Preparando' ? 'bg-amber-50 text-amber-600' : st === 'Enviado' ? 'bg-teal-50 text-teal-700' : 'bg-emerald-50 text-emerald-700') + ' grid place-items-center">' + icon('truck','w-[18px] h-[18px]') + '</div>' +
        '<div><div class="text-lg font-extrabold text-slate-900 leading-none">' + DB.orders.filter(o => o.state === st).length + '</div>' +
        '<div class="text-[11px] text-slate-500 font-medium mt-1">' + st + '</div></div>' +
      '</div>').join('') + '</div>';

  html += '<div class="flex flex-wrap gap-2 mb-4">' +
    searchBox('orderSearch', 'Consultar pedido por código o cliente (HU-27)…', 'searchOrders()', UI.orderSearch) +
    '<span class="badge b-slate self-center" id="ordersCount"></span>' +
  '</div>';

  html += '<div class="tblwrap"><table class="tbl"><thead><tr>' +
    '<th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Productos</th><th class="num">Total</th><th>Estado</th><th class="num">Acciones</th>' +
  '</tr></thead><tbody id="ordersTableBody"></tbody></table></div>';
  return html;
}
function ordersRows(){
  const q = normalizeText(UI.orderSearch);
  const list = DB.orders.slice().sort((a,b) => b.id - a.id)
    .filter(o => !q || [o.code, o.state, clientById(o.clientId).name].some(v => normalizeText(v).includes(q)));
  document.getElementById('ordersCount').textContent = list.length + ' de ' + DB.orders.length + ' pedidos';
  if(!list.length){
    return DB.orders.length
      ? emptyRow(7, 'No se encontró el pedido solicitado (EX-12).', 'search')
      : emptyRow(7, 'Aún no hay pedidos. Se generan automáticamente al confirmar una venta.', 'truck');
  }
  return list.map(o => {
    const items = o.items.map(it => it.qty + '× ' + it.name).join(', ');
    return '<tr>' +
      '<td><span class="font-bold text-brand-700">' + escapeHtml(o.code) + '</span><div class="text-[10.5px] text-slate-400">venta ' + escapeHtml(saleById(o.saleId) ? saleById(o.saleId).code : '—') + '</div></td>' +
      '<td><div class="flex items-center gap-2"><div class="avatar w-7 h-7 text-[10px]">' + initials(clientById(o.clientId).name) + '</div><span class="font-medium">' + escapeHtml(clientById(o.clientId).name) + '</span></div></td>' +
      '<td class="text-slate-600 text-[12.5px]">' + fmtDateTime(o.at) + '</td>' +
      '<td class="text-slate-600 text-[12.5px] max-w-[260px]"><div class="truncate" title="' + escapeHtml(items) + '">' + escapeHtml(items) + '</div></td>' +
      '<td class="num font-extrabold money">' + fmtMoney(o.total) + '</td>' +
      '<td>' + orderStateBadge(o.state) + '</td>' +
      '<td class="num"><div class="flex items-center justify-end gap-1.5">' +
        '<button class="btn btn-outline btn-sm" onclick="openOrderDetail(' + o.id + ')">' + icon('eye','w-3.5 h-3.5') + ' Ver</button>' +
        (hasPerm('orders.advance') && o.state !== 'Entregado'
          ? '<button class="btn btn-primary btn-sm" onclick="nextOrder(' + o.id + ')" title="Preparando → Enviado → Entregado">' + icon('arrowright','w-3.5 h-3.5') + ' Avanzar estado</button>' : '') +
      '</div></td></tr>';
  }).join('');
}
function searchOrders(){
  UI.orderSearch = document.getElementById('orderSearch').value;
  document.getElementById('ordersTableBody').innerHTML = ordersRows();
}

/* ---------- Reportes (EP-08 · RN-17: solo ventas confirmadas · actualización automática) ---------- */
const REPORT_TABS = [
  { key:'bySeller',     label:'Ventas por vendedor', perm:'reports.sales', icon:'usercheck' },
  { key:'topProducts',  label:'Productos más vendidos', perm:'reports.sales', icon:'chart' },
  { key:'byDate',       label:'Ventas por fechas', perm:'reports.sales', icon:'calendar' },
  { key:'stock',        label:'Stock disponible', perm:'reports.stock', icon:'package' },
  { key:'reposition',   label:'Reposición', perm:'reports.stock', icon:'bell' }
];
function renderReports(){
  const available = REPORT_TABS.filter(t => hasPerm(t.perm));
  if(!available.length){
    return moduleHead('Reportes', 'Reportes y consultas del sistema (EP-08).', '', 'chart') +
      '<div class="card p-8"><div class="empty-state"><div class="ico">' + icon('lock') + '</div>' +
      '<p class="text-sm font-medium text-slate-500">No cuentas con autorización para consultar reportes (EX-02).</p></div></div>';
  }
  if(!available.some(t => t.key === UI.reportTab)) UI.reportTab = available[0].key;

  let html = moduleHead('Reportes', 'Análisis comercial construido únicamente con ventas confirmadas (RN-17).', '', 'chart');

  html += '<div class="flex flex-wrap gap-2 mb-5">' + available.map(t =>
    '<button class="btn btn-sm ' + (UI.reportTab === t.key ? 'btn-primary' : 'btn-outline') + '" onclick="switchReportTab(\'' + t.key + '\')">' +
    icon(t.icon,'w-3.5 h-3.5') + t.label + '</button>').join('') + '</div>';

  html += '<div id="reportBody">' + reportBody() + '</div>';
  return html;
}
function switchReportTab(key){ UI.reportTab = key; renderCurrentView(); }
function reportPeriodFilter(){
  return '<div class="flex flex-wrap items-end gap-2 mb-4">' +
    '<div><label class="label">Desde</label><input type="date" id="reportFrom" class="input !w-auto" value="' + (UI.reportFrom||'') + '" /></div>' +
    '<div><label class="label">Hasta</label><input type="date" id="reportTo" class="input !w-auto" value="' + (UI.reportTo||'') + '" /></div>' +
    '<button class="btn btn-primary btn-sm" onclick="applyReportPeriod()">' + icon('filter','w-3.5 h-3.5') + ' Aplicar periodo</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="clearReportPeriod()">Limpiar</button>' +
  '</div>';
}
function applyReportPeriod(){
  UI.reportFrom = document.getElementById('reportFrom').value;
  UI.reportTo = document.getElementById('reportTo').value;
  document.getElementById('reportBody').innerHTML = reportBody();
}
function clearReportPeriod(){ UI.reportFrom = ''; UI.reportTo = ''; UI.reportSeller = ''; renderCurrentView(); }
function salesInPeriod(){
  let from = UI.reportFrom ? new Date(UI.reportFrom + 'T00:00:00') : null;
  let to   = UI.reportTo ? new Date(UI.reportTo + 'T23:59:59') : null;
  return DB.sales.filter(s => {
    if(s.status !== 'Confirmada') return false;                        // RN-17
    const at = new Date(s.at);
    if(from && at < from) return false;
    if(to && at > to) return false;
    return true;
  });
}
function reportBody(){
  switch(UI.reportTab){
    case 'bySeller':    return reportBySeller();
    case 'topProducts': return reportTopProducts();
    case 'byDate':      return reportByDate();
    case 'stock':       return reportStock();
    case 'reposition':  return reportReposition();
  }
  return '';
}

/* HU-33: ventas por vendedor */
function reportBySeller(){
  const sales = salesInPeriod();
  const sellers = {};
  sales.forEach(s => {
    const key = s.userName;
    if(!sellers[key]) sellers[key] = { name:key, count:0, total:0 };
    sellers[key].count++; sellers[key].total += s.total;
  });
  const rows = Object.values(sellers).sort((a,b) => b.total - a.total);
  const maxTotal = Math.max.apply(null, rows.map(r => r.total).concat([1]));
  const sellerNames = [''].concat(rows.map(r => r.name));

  let html = reportPeriodFilter();
  html += '<div class="grid grid-cols-2 gap-3 mb-4">' +
    kpiMini('Vendedores con ventas', rows.length, 'usercheck', 'bg-brand-50 text-brand-700') +
    kpiMini('Total del periodo', fmtMoney(sales.reduce((t,s) => t + s.total, 0)), 'wallet', 'bg-emerald-50 text-emerald-700') +
  '</div>';

  html += '<div class="card p-5 mb-4"><div class="flex flex-wrap items-center gap-2 mb-3">' +
    '<label class="label !mb-0">Filtrar por vendedor (HU-33):</label>' +
    '<select class="select !w-auto" onchange="UI.reportSeller=this.value; document.getElementById(\'reportBody\').innerHTML=reportBody()">' +
      sellerNames.map(n => '<option value="' + escapeHtml(n) + '"' + (UI.reportSeller === n ? ' selected' : '') + '>' + (n === '' ? 'Todos los vendedores' : escapeHtml(n)) + '</option>').join('') +
    '</select></div>';

  html += '<div class="tblwrap !border-0"><table class="tbl"><thead><tr><th>Vendedor</th><th class="num">Ventas</th><th class="num">Ingresos</th><th>Participación</th></tr></thead><tbody>';
  if(!rows.length){
    html += emptyRow(4, 'No existen resultados para los criterios seleccionados (EX-13).', 'chart');
  }else{
    rows.forEach(r => {
      html += '<tr><td class="font-semibold">' + escapeHtml(r.name) + '</td><td class="num font-bold">' + r.count + '</td>' +
        '<td class="num font-extrabold money">' + fmtMoney(r.total) + '</td>' +
        '<td><div class="bar-track w-full max-w-[220px]"><div class="bar-fill" style="width:' + Math.max(3, Math.round(r.total/maxTotal*100)) + '%"></div></div></td></tr>';
    });
  }
  html += '</tbody></table></div></div>';

  const filtered = UI.reportSeller ? sales.filter(s => s.userName === UI.reportSeller) : [];
  if(UI.reportSeller){
    html += '<div class="card p-5"><h3 class="text-[14px] font-bold text-slate-800 mb-3">Ventas de ' + escapeHtml(UI.reportSeller) + ' (' + filtered.length + ')</h3>' +
      '<div class="tblwrap !border-0"><table class="tbl"><thead><tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th class="num">Total</th><th>Pago</th></tr></thead><tbody>' +
      (filtered.length ? filtered.map(s =>
        '<tr><td class="font-bold text-brand-700">' + escapeHtml(s.code) + '</td><td class="text-[12.5px] text-slate-600">' + fmtDate(s.at) + '</td>' +
        '<td>' + escapeHtml(clientById(s.clientId).name) + '</td><td class="num font-bold money">' + fmtMoney(s.total) + '</td><td>' + paymentBadge((paymentBySaleId(s.id)||{}).method) + '</td></tr>'
      ).join('') : emptyRow(5, 'Sin ventas en el periodo seleccionado.', 'cart')) +
      '</tbody></table></div></div>';
  }
  return html;
}

/* HU-32: productos más vendidos (solo ventas confirmadas) */
function reportTopProducts(){
  const sales = salesInPeriod();
  const ids = new Set(sales.map(s => s.id));
  const agg = {};
  DB.saleDetails.filter(dt => ids.has(dt.saleId)).forEach(dt => {
    if(!agg[dt.productId]) agg[dt.productId] = { code:dt.code, name:dt.name, category:categoryName((productById(dt.productId)||{}).categoryId), units:0, revenue:0 };
    agg[dt.productId].units += dt.qty;
    agg[dt.productId].revenue += dt.subtotal;
  });
  const rows = Object.values(agg).sort((a,b) => b.units - a.units);
  const maxUnits = Math.max.apply(null, rows.map(r => r.units).concat([1]));

  let html = reportPeriodFilter();
  html += '<div class="card p-5"><h3 class="text-[14px] font-bold text-slate-800 mb-3">Ranking por unidades vendidas</h3>' +
    '<div class="tblwrap !border-0"><table class="tbl"><thead><tr><th>#</th><th>Producto</th><th>Categoría</th><th class="num">Unidades</th><th class="num">Ingresos</th><th>Demanda</th></tr></thead><tbody>';
  if(!rows.length){
    html += emptyRow(6, 'No existen resultados para los criterios seleccionados (EX-13).', 'chart');
  }else{
    rows.forEach((r,i) => {
      const medal = i === 0 ? 'b-amber' : i === 1 ? 'b-slate' : i === 2 ? 'b-rose' : 'b-teal';
      html += '<tr><td><span class="badge ' + medal + '">' + (i+1) + 'º</span></td>' +
        '<td><div class="font-semibold">' + escapeHtml(r.name) + '</div><div class="text-[11px] text-slate-400">' + escapeHtml(r.code) + '</div></td>' +
        '<td><span class="badge b-slate">' + escapeHtml(r.category || '—') + '</span></td>' +
        '<td class="num font-extrabold">' + r.units + '</td><td class="num font-bold money">' + fmtMoney(r.revenue) + '</td>' +
        '<td><div class="bar-track w-full max-w-[180px]"><div class="bar-fill" style="width:' + Math.max(4, Math.round(r.units/maxUnits*100)) + '%"></div></div></td></tr>';
    });
  }
  html += '</tbody></table></div>' +
    '<p class="hint mt-3">' + icon('info','w-3.5 h-3.5 inline') + ' Elaborado con ventas confirmadas en el periodo; se actualiza automáticamente al registrar ventas (HU-32, RN-17).</p></div>';
  return html;
}

/* HU-31: ventas por fechas */
function reportByDate(){
  const sales = salesInPeriod().sort((a,b) => new Date(b.at) - new Date(a.at));
  let html = reportPeriodFilter();
  html += '<div class="grid grid-cols-2 gap-3 mb-4">' +
    kpiMini('Ventas en el periodo', sales.length, 'cart', 'bg-brand-50 text-brand-700') +
    kpiMini('Monto total', fmtMoney(sales.reduce((t,s) => t + s.total, 0)), 'wallet', 'bg-emerald-50 text-emerald-700') +
  '</div>';
  html += '<div class="card p-5"><h3 class="text-[14px] font-bold text-slate-800 mb-3">Ventas del periodo seleccionado</h3>' +
    '<div class="tblwrap !border-0 max-h-96 overflow-y-auto scroll-styled"><table class="tbl"><thead><tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th class="num">Total</th><th>Pago</th></tr></thead><tbody>';
  if(!sales.length){
    html += emptyRow(6, 'No existen ventas en el periodo consultado (HU-31).', 'calendar');
  }else{
    html += sales.map(s =>
      '<tr><td class="font-bold text-brand-700">' + escapeHtml(s.code) + '</td>' +
      '<td class="text-[12.5px] text-slate-600">' + fmtDateTime(s.at) + '</td>' +
      '<td>' + escapeHtml(clientById(s.clientId).name) + '</td><td class="text-slate-600">' + escapeHtml(s.userName) + '</td>' +
      '<td class="num font-bold money">' + fmtMoney(s.total) + '</td><td>' + paymentBadge((paymentBySaleId(s.id)||{}).method) + '</td></tr>'
    ).join('');
  }
  html += '</tbody></table></div></div>';
  return html;
}

/* HU-34: stock disponible */
function reportStock(){
  const q = normalizeText(UI.stockSearch);
  const cat = UI.stockCategory;
  const list = DB.products.filter(p => {
    const okCat = !cat || String(p.categoryId) === String(cat);
    const okQ = !q || [p.name, p.code, categoryName(p.categoryId)].some(v => normalizeText(v).includes(q));
    return okCat && okQ;
  });
  const totalUnits = DB.products.reduce((t,p) => t + p.stock, 0);
  const noStock = DB.products.filter(p => p.stock === 0);

  let html = '<div class="flex flex-wrap gap-2 mb-4">' +
    searchBox('stockSearch', 'Buscar producto…', 'filterStockReport()', UI.stockSearch) +
    '<select class="select !w-auto min-w-[170px]" id="stockCategory" onchange="filterStockReport()">' +
      '<option value="">Todas las categorías</option>' +
      DB.categories.map(c => '<option value="' + c.id + '"' + (String(UI.stockCategory) === String(c.id) ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>').join('') +
    '</select></div>';
  html += '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">' +
    kpiMini('Productos', list.length, 'package', 'bg-brand-50 text-brand-700') +
    kpiMini('Unidades totales', totalUnits, 'box', 'bg-violet-50 text-violet-700') +
    kpiMini('Sin stock', noStock.length, 'x', 'bg-rose-50 text-rose-600') +
    kpiMini('Bajo stock', DB.products.filter(isLowStock).length, 'alert', 'bg-amber-50 text-amber-600') +
  '</div>';
  html += '<div class="card p-5"><h3 class="text-[14px] font-bold text-slate-800 mb-3">Inventario actualizado</h3><div class="tblwrap !border-0">' +
    '<table class="tbl"><thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th class="num">Stock</th><th class="num">Mínimo</th><th>Estado</th></tr></thead><tbody id="stockReportBody">' +
    stockReportRows(list) + '</tbody></table></div>' +
    '<p class="hint mt-3">' + icon('info','w-3.5 h-3.5 inline') + ' Los productos sin stock se identifican para su reposición (HU-34 · RN-18).</p></div>';
  return html;
}
function stockReportRows(list){
  if(!list.length) return emptyRow(6, 'No se encontraron productos con los criterios seleccionados.', 'search');
  return list.map(p => {
    const st = stockStatus(p);
    return '<tr><td class="font-mono text-[12.5px] font-bold text-brand-700">' + escapeHtml(p.code) + '</td>' +
      '<td class="font-semibold">' + escapeHtml(p.name) + '</td>' +
      '<td><span class="badge b-slate">' + escapeHtml(categoryName(p.categoryId)) + '</span></td>' +
      '<td class="num font-bold ' + (p.stock === 0 ? 'text-rose-600' : p.stock <= p.minStock ? 'text-amber-600' : 'text-slate-800') + '">' + p.stock + '</td>' +
      '<td class="num text-slate-400">' + p.minStock + '</td>' +
      '<td><span class="badge ' + st.cls + '"><span class="dot"></span>' + st.label + '</span></td></tr>';
  }).join('');
}
function filterStockReport(){
  UI.stockSearch = document.getElementById('stockSearch').value;
  UI.stockCategory = document.getElementById('stockCategory').value;
  const list = DB.products.filter(p => {
    const okCat = !UI.stockCategory || String(p.categoryId) === String(UI.stockCategory);
    const q = normalizeText(UI.stockSearch);
    const okQ = !q || [p.name, p.code, categoryName(p.categoryId)].some(v => normalizeText(v).includes(q));
    return okCat && okQ;
  });
  document.getElementById('stockReportBody').innerHTML = stockReportRows(list);
}

/* HU-35 / RN-18: productos que requieren reposición */
function reportReposition(){
  const list = DB.products.filter(isLowStock).sort((a,b) => (a.stock - a.minStock) - (b.stock - b.minStock));
  const alerts = DB.stockAlerts.filter(a => !a.resolved).sort((a,b) => new Date(b.at) - new Date(a.at));
  let html = '<div class="grid grid-cols-2 gap-3 mb-4">' +
    kpiMini('Requieren reposición', list.length, 'alert', 'bg-amber-50 text-amber-600') +
    kpiMini('Alertas activas', alerts.length, 'bell', 'bg-rose-50 text-rose-600') +
  '</div>';
  html += '<div class="card p-5 mb-4"><h3 class="text-[14px] font-bold text-slate-800 mb-3">Productos con stock ≤ stock mínimo</h3>' +
    '<div class="tblwrap !border-0"><table class="tbl"><thead><tr><th>Producto</th><th class="num">Stock</th><th class="num">Mínimo</th><th>Origen</th><th>Estado</th>' + (hasPerm('products.adjust') ? '<th class="num"></th>' : '') + '</tr></thead><tbody>';
  if(!list.length){
    html += emptyRow(hasPerm('products.adjust') ? 6 : 5, 'Ningún producto requiere reposición en este momento.', 'check');
  }else{
    list.forEach(p => {
      html += '<tr><td><div class="font-semibold">' + escapeHtml(p.name) + '</div><div class="text-[11px] text-slate-400">' + escapeHtml(p.code) + '</div></td>' +
        '<td class="num font-bold ' + (p.stock === 0 ? 'text-rose-600' : 'text-amber-600') + '">' + p.stock + '</td>' +
        '<td class="num text-slate-400">' + p.minStock + '</td>' +
        '<td><span class="badge ' + (p.origin === 'FALABELLA' ? 'b-teal' : 'b-slate') + '">' + escapeHtml(p.origin) + '</span></td>' +
        '<td><span class="badge b-amber"><span class="dot"></span>Requiere reposición</span></td>' +
        (hasPerm('products.adjust') ? '<td class="num"><button class="btn btn-primary btn-sm" onclick="openAdjust(' + p.id + ')">' + icon('plus','w-3.5 h-3.5') + ' Reponer</button></td>' : '') + '</tr>';
    });
  }
  html += '</tbody></table></div></div>';

  html += '<div class="card p-5"><h3 class="text-[14px] font-bold text-slate-800 mb-3">Historial de alertas de bajo stock (HU-15)</h3>' +
    '<div class="tblwrap !border-0 max-h-72 overflow-y-auto scroll-styled"><table class="tbl"><thead><tr><th>Producto</th><th class="num">Stock</th><th class="num">Mínimo</th><th>Generada</th><th>Estado</th></tr></thead><tbody>';
  if(!alerts.length){
    html += emptyRow(5, 'Sin alertas registradas.', 'bell');
  }else{
    alerts.forEach(a => {
      html += '<tr><td class="font-semibold">' + escapeHtml(a.code) + '</td><td class="num font-bold text-amber-600">' + a.currentStock + '</td>' +
        '<td class="num text-slate-400">' + a.minStock + '</td><td class="text-[12.5px] text-slate-600">' + fmtDateTime(a.at) + '</td>' +
        '<td><span class="badge b-red"><span class="dot"></span>Activa</span></td></tr>';
    });
  }
  html += '</tbody></table></div></div>';
  return html;
}
