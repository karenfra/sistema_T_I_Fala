/* =====================================================================================================
   CAMBIOS Y DEVOLUCIONES (EP-07: HU-28, HU-29, HU-30) · PROMOCIONES · USUARIOS · AUDITORÍA · ATENCIÓN
   ===================================================================================================== */

/* ---------- Cambios y devoluciones ---------- */
function renderReturns(){
  const pend = DB.returnRequests.filter(r => r.status === 'Pendiente').length + DB.changeRequests.filter(r => r.status === 'Pendiente').length;
  let html = moduleHead('Cambios y devoluciones', 'Solicitudes asociadas a ventas confirmadas, con validación de política (HU-28 · HU-29 · RN-14, RN-19).',
    (hasPerm('returns.create') ?
      '<button class="btn btn-primary btn-sm" onclick="openReturnForm()">' + icon('rotate','w-4 h-4') + ' Registrar devolución</button>' +
      '<button class="btn btn-outline btn-sm" onclick="openChangeForm()">' + icon('repeat','w-4 h-4') + ' Registrar cambio</button>' : ''),
    'rotate');

  html += '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">' +
    kpiMini('Devoluciones', DB.returnRequests.length, 'rotate', 'bg-brand-50 text-brand-700') +
    kpiMini('Cambios', DB.changeRequests.length, 'repeat', 'bg-violet-50 text-violet-700') +
    kpiMini('Pendientes de evaluación', pend, 'clock', 'bg-amber-50 text-amber-600') +
    kpiMini('Aprobadas', DB.returnRequests.filter(r => r.status === 'Aprobada').length + DB.changeRequests.filter(r => r.status === 'Aprobada').length, 'check', 'bg-emerald-50 text-emerald-700') +
  '</div>';

  const isRet = UI.returnsTab !== 'changes';
  html += '<div class="flex gap-2 mb-4">' +
    '<button class="btn btn-sm ' + (isRet ? 'btn-primary' : 'btn-outline') + '" onclick="UI.returnsTab=\'returns\'; renderCurrentView()">' + icon('rotate','w-3.5 h-3.5') + ' Devoluciones (' + DB.returnRequests.length + ')</button>' +
    '<button class="btn btn-sm ' + (!isRet ? 'btn-primary' : 'btn-outline') + '" onclick="UI.returnsTab=\'changes\'; renderCurrentView()">' + icon('repeat','w-3.5 h-3.5') + ' Cambios (' + DB.changeRequests.length + ')</button>' +
  '</div>';

  if(isRet){
    html += '<div class="tblwrap"><table class="tbl"><thead><tr>' +
      '<th>Solicitud</th><th>Venta</th><th>Cliente</th><th>Producto</th><th class="num">Cant.</th><th>Motivo</th><th>Estado</th><th>Reembolso</th><th class="num">Acciones</th>' +
    '</tr></thead><tbody>';
    if(!DB.returnRequests.length){
      html += emptyRow(9, 'Aún no hay solicitudes de devolución registradas.', 'rotate');
    }else{
      DB.returnRequests.slice().sort((a,b) => b.id - a.id).forEach(r => {
        const sale = saleById(r.saleId);
        html += '<tr>' +
          '<td><span class="font-bold text-brand-700">' + escapeHtml(r.code) + '</span><div class="text-[10.5px] text-slate-400">' + fmtDateTime(r.registeredAt) + '</div></td>' +
          '<td class="font-semibold">' + (sale ? escapeHtml(sale.code) : '—') + '</td>' +
          '<td>' + escapeHtml(sale ? clientById(sale.clientId).name : '—') + '</td>' +
          '<td class="max-w-[190px]"><div class="truncate font-medium" title="' + escapeHtml(r.productName) + '">' + escapeHtml(r.productName) + '</div></td>' +
          '<td class="num font-bold">' + r.qty + '</td>' +
          '<td class="text-[12.5px] text-slate-600 max-w-[160px]"><div class="truncate" title="' + escapeHtml(r.reason + (r.motive ? ' — ' + r.motive : '')) + '">' + escapeHtml(r.reason) + (r.motive ? ' <span class="text-rose-500">✗</span>' : '') + '</div></td>' +
          '<td>' + requestStatusBadge(r.status) + '</td>' +
          '<td>' + (r.refundMethod ? paymentBadge(r.refundMethod) + '<div class="text-[10px] text-slate-400 mt-0.5">' + (r.restocked ? 'reingresó al stock' : 'sin reingreso (RN-26)') + '</div>' : '<span class="text-slate-300">—</span>') + '</td>' +
          '<td class="num"><div class="flex items-center justify-end gap-1.5">' +
            (r.status === 'Pendiente' && hasPerm('returns.process')
              ? '<button class="btn btn-primary btn-sm" onclick="openEvaluate(\'return\',' + r.id + ')">' + icon('check','w-3.5 h-3.5') + ' Evaluar</button>' : '') +
            '<button class="btn btn-outline btn-icon" title="Ver detalle" onclick="openRequestDetail(\'return\',' + r.id + ')">' + icon('eye','w-4 h-4') + '</button>' +
          '</div></td></tr>';
      });
    }
    html += '</tbody></table></div>';
  }else{
    html += '<div class="tblwrap"><table class="tbl"><thead><tr>' +
      '<th>Solicitud</th><th>Venta</th><th>Cliente</th><th>Original → Nuevo</th><th class="num">Cant.</th><th>Estado</th><th class="num">Acciones</th>' +
    '</tr></thead><tbody>';
    if(!DB.changeRequests.length){
      html += emptyRow(7, 'Aún no hay solicitudes de cambio registradas.', 'repeat');
    }else{
      DB.changeRequests.slice().sort((a,b) => b.id - a.id).forEach(r => {
        const sale = saleById(r.saleId);
        html += '<tr>' +
          '<td><span class="font-bold text-brand-700">' + escapeHtml(r.code) + '</span><div class="text-[10.5px] text-slate-400">' + fmtDateTime(r.registeredAt) + '</div></td>' +
          '<td class="font-semibold">' + (sale ? escapeHtml(sale.code) : '—') + '</td>' +
          '<td>' + escapeHtml(sale ? clientById(sale.clientId).name : '—') + '</td>' +
          '<td class="text-[12.5px] max-w-[260px]"><div class="flex items-center gap-1.5"><span class="truncate font-medium" title="' + escapeHtml(r.originalProductName) + '">' + escapeHtml(r.originalProductName) + '</span>' +
            '<span class="text-slate-300">' + icon('arrowright','w-3.5 h-3.5') + '</span><span class="truncate font-semibold text-brand-700" title="' + escapeHtml(r.newProductName) + '">' + escapeHtml(r.newProductName || 'Por definir') + '</span></div></td>' +
          '<td class="num font-bold">' + r.qty + '</td>' +
          '<td>' + requestStatusBadge(r.status) + '</td>' +
          '<td class="num"><div class="flex items-center justify-end gap-1.5">' +
            (r.status === 'Pendiente' && hasPerm('returns.process')
              ? '<button class="btn btn-primary btn-sm" onclick="openEvaluate(\'change\',' + r.id + ')">' + icon('check','w-3.5 h-3.5') + ' Evaluar</button>' : '') +
            '<button class="btn btn-outline btn-icon" title="Ver detalle" onclick="openRequestDetail(\'change\',' + r.id + ')">' + icon('eye','w-4 h-4') + '</button>' +
          '</div></td></tr>';
      });
    }
    html += '</tbody></table></div>';
  }
  return html;
}

/* ---------- Promociones (HU-19, RN-08, EX-07) ---------- */
function renderPromotions(){
  let html = moduleHead('Promociones', 'Descuentos vigentes que el sistema aplica automáticamente al confirmar una venta (RN-08 · EX-07).', '', 'tag');

  html += '<div class="card p-4 mb-4 flex items-start gap-3 !bg-violet-50/60 !border-violet-100">' +
    '<span class="text-violet-600 mt-0.5">' + icon('info','w-5 h-5') + '</span>' +
    '<p class="text-[12.5px] text-slate-600 leading-relaxed">Solo se aplican promociones <b>vigentes</b> y cuyas condiciones se cumplen. Una promoción vencida o no aplicable <b>no</b> modifica el precio y se informa como excepción EX-07.</p></div>';

  html += '<div class="tblwrap"><table class="tbl"><thead><tr>' +
    '<th>Código</th><th>Promoción</th><th class="num">Descuento</th><th>Aplicación</th><th>Vigencia</th><th>Estado</th><th class="num">Ventas</th>' +
  '</tr></thead><tbody>';
  DB.promotions.forEach(pr => {
    const status = promoStatus(pr);
    const scope = pr.scope === 'category'
      ? 'Categoría <b>' + escapeHtml(categoryName(pr.categoryId)) + '</b>'
      : 'Producto <b>' + escapeHtml((productById(pr.productId)||{name:'—'}).name) + '</b>';
    const used = DB.salePromotions.filter(sp => sp.promotionId === pr.id).length;
    html += '<tr>' +
      '<td class="font-mono text-[12.5px] font-bold text-violet-700">' + escapeHtml(pr.code) + '</td>' +
      '<td><div class="font-semibold">' + escapeHtml(pr.name) + '</div><div class="text-[11px] text-slate-400 max-w-[300px]">' + escapeHtml(pr.description) + '</div></td>' +
      '<td class="num"><span class="badge b-violet">' + icon('percent','w-3 h-3') + pr.value + '%</span></td>' +
      '<td class="text-[12.5px] text-slate-600">' + scope + '</td>' +
      '<td class="text-[12px] text-slate-500">' + fmtDate(pr.startDate) + ' → ' + fmtDate(pr.endDate) + '</td>' +
      '<td><span class="badge ' + (status === 'Vigente' ? 'b-green' : status === 'Programada' ? 'b-teal' : 'b-slate') + '"><span class="dot"></span>' + status + '</span></td>' +
      '<td class="num font-bold">' + used + '</td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

/* ---------- Usuarios y roles (HU-02) ---------- */
function renderUsers(){
  let html = moduleHead('Usuarios y roles', 'Usuarios del sistema, roles y matriz de permisos rol–permiso (HU-02 · RN-01, RN-02).', '', 'usercheck');

  html += '<div class="card p-4 mb-5 flex items-start gap-3 !bg-amber-50/70 !border-amber-100">' +
    '<span class="text-amber-600 mt-0.5">' + icon('shield','w-5 h-5') + '</span>' +
    '<p class="text-[12.5px] text-slate-600 leading-relaxed"><b>Autenticación demostrativa.</b> Las credenciales se almacenan en texto plano en el navegador únicamente con fines académicos. Un entorno real requiere backend, contraseñas cifradas (hash + salt), HTTPS, bloqueo por intentos fallidos y gestión segura de sesiones.</p></div>';

  html += '<div class="tblwrap mb-6"><table class="tbl"><thead><tr>' +
    '<th>Usuario</th><th>Nombre</th><th>Rol</th><th class="num">Ventas registradas</th><th class="num">Acciones</th>' +
  '</tr></thead><tbody>';
  DB.users.forEach(u => {
    const role = roleById(u.roleId);
    const salesCount = DB.sales.filter(s => s.userId === u.id).length;
    html += '<tr>' +
      '<td><div class="flex items-center gap-2"><div class="avatar w-7 h-7 text-[10px]">' + initials(u.fullName) + '</div><span class="font-mono font-semibold">' + escapeHtml(u.username) + '</span></div></td>' +
      '<td class="font-medium">' + escapeHtml(u.fullName) + '</td>' +
      '<td><span class="badge b-teal">' + escapeHtml(role ? role.name : '—') + '</span></td>' +
      '<td class="num">' + (salesCount || '—') + '</td>' +
      '<td class="num">' + (hasPerm('users.assign')
        ? '<button class="btn btn-outline btn-sm" onclick="openRoleForm(' + u.id + ')">' + icon('usercheck','w-3.5 h-3.5') + ' Cambiar rol</button>'
        : '<span class="text-slate-300">—</span>') + '</td></tr>';
  });
  html += '</tbody></table></div>';

  html += '<h3 class="text-[15px] font-bold text-slate-800 mb-3">Roles del sistema</h3><div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">';
  const roleIcons = { 1:'shield', 2:'cart', 3:'package', 4:'msg' };
  DB.roles.forEach(r => {
    const userCount = DB.users.filter(u => u.roleId === r.id).length;
    const permCount = DB.rolePermissions.filter(rp => rp.roleId === r.id).length;
    html += '<div class="card p-5">' +
      '<div class="flex items-center gap-3 mb-3"><div class="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center">' + icon(roleIcons[r.id]||'user','w-5 h-5') + '</div>' +
      '<div class="min-w-0"><div class="font-bold text-[14px] text-slate-900 leading-tight">' + escapeHtml(r.name) + '</div>' +
      '<div class="text-[11px] text-slate-400">' + userCount + ' usuario(s) · ' + permCount + ' permisos</div></div></div>' +
      '<p class="text-[12px] text-slate-500 leading-relaxed">' + escapeHtml(r.description) + '</p></div>';
  });
  html += '</div>';

  /* Matriz de permisos rol–permiso (entidades role, permission, role_permission) */
  html += '<h3 class="text-[15px] font-bold text-slate-800 mb-3">Matriz de permisos (role_permission)</h3>';
  html += '<div class="tblwrap"><table class="tbl"><thead><tr><th>Permiso</th>' +
    DB.roles.map(r => '<th class="text-center">' + escapeHtml(r.name.replace('Encargado de inventario','Inventario').replace('Atención al cliente','Atención')) + '</th>').join('') +
  '</tr></thead><tbody>';
  let lastModule = '';
  DB.permissions.forEach(p => {
    if(p.module !== lastModule){
      lastModule = p.module;
      html += '<tr><td colspan="' + (DB.roles.length + 1) + '" class="!bg-slate-50 !py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">' + escapeHtml(p.module) + '</td></tr>';
    }
    html += '<tr><td class="font-medium text-[12.5px]">' + escapeHtml(p.name) + ' <span class="text-slate-300 font-mono text-[10.5px]">' + escapeHtml(p.code) + '</span></td>';
    DB.roles.forEach(r => {
      const ok = DB.rolePermissions.some(rp => rp.roleId === r.id && rp.permissionId === p.id);
      html += '<td class="text-center">' + (ok
        ? '<span class="text-emerald-600">' + icon('check','w-4 h-4 inline') + '</span>'
        : '<span class="text-slate-200">' + icon('x','w-4 h-4 inline') + '</span>') + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

/* ---------- Auditoría (HU-03, RN-03) ---------- */
function renderAuditView(){
  let html = moduleHead('Auditoría de operaciones', 'Registro de operaciones relevantes con usuario, fecha y hora (HU-03 · RN-03).', '', 'history');

  const ops = [].concat(DB.audits.map(a => a.operation)).filter((v,i,arr) => arr.indexOf(v) === i).sort();
  html += '<div class="flex flex-wrap gap-2 mb-4">' +
    searchBox('auditSearch', 'Buscar en auditoría (usuario, operación, detalle)…', 'searchAudit()', UI.auditSearch) +
    '<select class="select !w-auto min-w-[210px]" id="auditFilter" onchange="searchAudit()">' +
      '<option value="">Todas las operaciones</option>' +
      ops.map(o => '<option value="' + escapeHtml(o) + '"' + (UI.auditFilter === o ? ' selected' : '') + '>' + escapeHtml(o) + '</option>').join('') +
    '</select>' +
    '<span class="badge b-slate self-center" id="auditCount"></span>' +
  '</div>';

  html += '<div class="tblwrap max-h-[520px] overflow-y-auto scroll-styled"><table class="tbl"><thead><tr>' +
    '<th>Fecha / hora</th><th>Usuario</th><th>Operación</th><th>Detalle</th>' +
  '</tr></thead><tbody id="auditTableBody"></tbody></table></div>';
  return html;
}
function auditRows(){
  const q = normalizeText(UI.auditSearch);
  const f = UI.auditFilter;
  const list = DB.audits.slice().reverse().filter(a => {
    const okF = !f || a.operation === f;
    const okQ = !q || [a.username, a.user, a.operation, a.detail].some(v => normalizeText(v).includes(q));
    return okF && okQ;
  });
  document.getElementById('auditCount').textContent = list.length + ' registros';
  if(!list.length) return emptyRow(4, 'No existen registros para los criterios seleccionados (EX-13).', 'history');
  const opColors = {
    'Inicio de sesión':'b-teal','Cierre de sesión':'b-slate','Cliente registrado':'b-green','Cliente actualizado':'b-green',
    'Producto registrado':'b-violet','Producto actualizado':'b-violet','Ajuste de inventario':'b-amber','Venta confirmada':'b-green',
    'Pago rechazado':'b-red','Pedido generado':'b-teal','Cambio de estado de pedido':'b-teal','Devolución registrada':'b-amber',
    'Devolución aprobada':'b-green','Devolución rechazada':'b-red','Cambio registrado':'b-amber','Cambio aprobado':'b-green',
    'Cambio rechazado':'b-red','Rol asignado':'b-violet','Sistema restablecido':'b-slate','Acceso denegado':'b-red'
  };
  return list.map(a =>
    '<tr>' +
      '<td class="text-[12.5px] text-slate-600 whitespace-nowrap font-medium">' + fmtDateTime(a.at) + '</td>' +
      '<td><div class="flex items-center gap-2"><div class="avatar w-7 h-7 text-[10px]">' + initials(a.user) + '</div><div class="leading-tight"><div class="font-semibold text-[12.5px]">' + escapeHtml(a.user) + '</div><div class="text-[10.5px] text-slate-400 font-mono">' + escapeHtml(a.username) + '</div></div></div></td>' +
      '<td><span class="badge ' + (opColors[a.operation]||'b-slate') + '">' + escapeHtml(a.operation) + '</span></td>' +
      '<td class="text-[12.5px] text-slate-600">' + escapeHtml(a.detail) + '</td>' +
    '</tr>').join('');
}
function searchAudit(){
  UI.auditSearch = document.getElementById('auditSearch').value;
  UI.auditFilter = document.getElementById('auditFilter').value;
  document.getElementById('auditTableBody').innerHTML = auditRows();
}

/* ---------- Atención al cliente (HU-27 consulta de pedidos + HU-36 chatbot) ---------- */
function renderSupport(){
  let html = moduleHead('Atención al cliente', 'Consulta de pedidos, chatbot de preguntas frecuentes y canales de atención (HU-27 · HU-36).', '', 'msg');

  html += '<div class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">';

  /* Consulta de pedidos */
  html += '<div class="card p-5">' +
    '<div class="flex items-center gap-2.5 mb-4"><span class="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 grid place-items-center">' + icon('truck','w-[18px] h-[18px]') + '</span>' +
    '<div><h3 class="text-[15px] font-bold text-slate-900 leading-tight">Consulta de estado del pedido</h3>' +
    '<p class="text-[11.5px] text-slate-500">Ingresa el número de pedido (ej. PD-0003)</p></div></div>' +
    '<div class="flex gap-2">' +
      '<input id="orderLookupInput" class="input flex-1" placeholder="PD-0000" onkeydown="if(event.key===\'Enter\') lookupOrder()" />' +
      '<button class="btn btn-primary" onclick="lookupOrder()">' + icon('search','w-4 h-4') + ' Buscar</button>' +
    '</div>' +
    '<div id="orderLookupResult" class="mt-4"></div>' +
    '<div class="mt-4 pt-4 border-t border-slate-100 hint">' + icon('info','w-3.5 h-3.5 inline') + ' El seguimiento muestra los estados Preparando → Enviado → Entregado conforme avanza el proceso (HU-27).</div>' +
  '</div>';

  /* Chatbot embebido (mismo motor, instancia aislada) */
  html += '<div class="card overflow-hidden flex flex-col" style="height:520px">' +
    '<div id="chatMount" class="flex-1 flex flex-col min-h-0"></div>' +
  '</div>';

  /* Canales */
  html += '<div class="card p-5 xl:col-span-2">' +
    '<div class="flex items-center gap-2.5 mb-3"><span class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 grid place-items-center">' + icon('msg','w-[18px] h-[18px]') + '</span>' +
    '<h3 class="text-[15px] font-bold text-slate-900">Canales de atención</h3></div>' +
    '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">' +
      '<div class="rounded-xl border border-slate-200 p-4"><div class="flex items-center gap-2 text-slate-800 font-semibold text-[13px] mb-1">' + icon('clock','w-4 h-4 text-brand-700') + ' Horario</div><p class="text-[12.5px] text-slate-500">Lunes a sábado, de 9:00 a 21:00.</p></div>' +
      '<div class="rounded-xl border border-slate-200 p-4"><div class="flex items-center gap-2 text-slate-800 font-semibold text-[13px] mb-1">' + icon('msg','w-4 h-4 text-brand-700') + ' Chat / Tienda</div><p class="text-[12.5px] text-slate-500">Chatbot de preguntas frecuentes y módulos de gestión en tienda.</p></div>' +
      '<div class="rounded-xl border border-slate-200 p-4"><div class="flex items-center gap-2 text-slate-800 font-semibold text-[13px] mb-1">' + icon('send','w-4 h-4 text-brand-700') + ' Correo</div><p class="text-[12.5px] text-slate-500">contacto@falabella.com — respuestas en 24 h hábiles.</p></div>' +
    '</div></div>';

  html += '</div>';
  return html;
}
function lookupOrder(){
  const input = document.getElementById('orderLookupInput');
  const box = document.getElementById('orderLookupResult');
  const order = orderByCode(input.value);
  if(!order){
    box.innerHTML = '<div class="err-box flex items-start gap-2.5"><span class="mt-0.5 text-rose-600">' + icon('alert','w-4 h-4') + '</span>' +
      '<span>No se encontró el pedido solicitado (EX-12). Verifica el número, por ejemplo <b>PD-0001</b>.</span></div>';
    return;
  }
  const sale = saleById(order.saleId);
  const pay = paymentBySaleId(order.saleId);
  const steps = ORDER_STATES.map(st => {
    const done = ORDER_STATES.indexOf(order.state) >= ORDER_STATES.indexOf(st);
    return '<div class="timeline-step ' + (done ? 'text-emerald-600' : 'text-slate-300') + '">' +
      '<span class="w-7 h-7 rounded-full grid place-items-center border ' + (done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200') + '">' + icon(done ? 'check' : 'clock','w-3.5 h-3.5') + '</span>' +
      '<span class="text-[12.5px] font-semibold ' + (done ? 'text-slate-700' : 'text-slate-400') + '">' + st + '</span></div>';
  }).join('<div class="w-6 h-px bg-slate-200 mx-2 self-center"></div>');

  box.innerHTML = '<div class="rounded-xl border border-slate-200 overflow-hidden pop-in">' +
    '<div class="bg-slate-50 px-4 py-3 flex items-center justify-between gap-2 flex-wrap">' +
      '<span class="font-bold text-brand-700">' + escapeHtml(order.code) + '</span>' + orderStateBadge(order.state) + '</div>' +
    '<div class="p-4 space-y-3">' +
      '<div class="text-[12.5px] text-slate-600">Cliente: <b>' + escapeHtml(clientById(order.clientId).name) + '</b> · Venta <b>' + escapeHtml(sale ? sale.code : '—') + '</b> · ' + fmtDateTime(order.at) + '</div>' +
      '<div class="flex flex-wrap items-center">' + steps + '</div>' +
      '<div class="text-[12.5px] text-slate-600 space-y-1">' + order.items.map(it => '<div>• ' + it.qty + '× ' + escapeHtml(it.name) + ' — ' + fmtMoney(it.subtotal) + '</div>').join('') + '</div>' +
      '<div class="flex items-center justify-between pt-2 border-t border-slate-100">' +
        '<span class="text-[12.5px] text-slate-500">Total pagado' + (pay ? ' (' + escapeHtml(pay.method) + ')' : '') + '</span>' +
        '<span class="font-extrabold text-slate-900 money">' + fmtMoney(order.total) + '</span></div>' +
    '</div></div>';
}
