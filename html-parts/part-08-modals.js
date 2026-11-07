/* =====================================================================================================
   MODALES Y ACCIONES: CLIENTES · PRODUCTOS · INVENTARIO · VENTAS · COMPROBANTE · PEDIDOS · POSTVENTA · ROLES · RESET
   ===================================================================================================== */

/* ============ CLIENTES (HU-04, HU-05, HU-06, HU-07) ============ */
function openClient(id){                                     /* Consulta del cliente + historial de compras (HU-06) */
  const c = clientById(id);
  const compras = clientSales(c.id);
  let body =
    '<div class="flex items-center gap-4 mb-5">' +
      '<div class="avatar w-14 h-14 text-lg">' + initials(c.name) + '</div>' +
      '<div class="min-w-0"><div class="text-lg font-bold text-slate-900 leading-tight">' + escapeHtml(c.name) + '</div>' +
      '<div class="flex items-center gap-2 flex-wrap mt-1">' +
        '<span class="badge b-slate">DNI ' + escapeHtml(c.dni) + '</span>' +
        '<span class="badge b-teal">' + compras.length + ' compra(s)</span>' +
        '<span class="badge b-green">' + fmtMoney(compras.reduce((t,s) => t + s.total, 0)) + '</span>' +
      '</div></div>' +
    '</div>' +
    '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">' +
      '<div class="rounded-xl border border-slate-200 p-3.5"><div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Correo</div><div class="text-[13px] font-medium text-slate-700 truncate">' + escapeHtml(c.email) + '</div></div>' +
      '<div class="rounded-xl border border-slate-200 p-3.5"><div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Teléfono</div><div class="text-[13px] font-medium text-slate-700">' + escapeHtml(c.phone || '—') + '</div></div>' +
      '<div class="rounded-xl border border-slate-200 p-3.5"><div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Cliente desde</div><div class="text-[13px] font-medium text-slate-700">' + fmtDate(c.createdAt) + '</div></div>' +
    '</div>';

  body += '<h4 class="text-[13.5px] font-bold text-slate-800 mb-2 flex items-center gap-2">' + icon('cart','w-4 h-4 text-brand-700') + ' Historial de compras</h4>';
  if(!hasPerm('clients.history')){
    body += '<div class="rounded-xl border border-slate-200 p-4 text-[12.5px] text-slate-500 flex items-center gap-2">' + icon('lock','w-4 h-4') + ' No cuentas con autorización para consultar el historial de compras (EX-02).</div>';
  }else if(!compras.length){
    body += '<div class="empty-state !py-6"><div class="ico">' + icon('cart') + '</div><p class="text-[13px] font-medium text-slate-500">El cliente aún no tiene compras registradas.</p></div>';
  }else{
    body += '<div class="tblwrap max-h-56 overflow-y-auto scroll-styled"><table class="tbl"><thead><tr><th>Venta</th><th>Fecha</th><th>Productos</th><th class="num">Monto</th><th class="num"></th></tr></thead><tbody>' +
      compras.map(s =>
        '<tr><td class="font-bold text-brand-700">' + escapeHtml(s.code) + '</td>' +
        '<td class="text-[12.5px] text-slate-600">' + fmtDate(s.at) + '</td>' +
        '<td class="text-[12.5px] text-slate-600">' + saleDetailsOf(s.id).map(dt => dt.qty + '× ' + escapeHtml(dt.name)).join(', ') + '</td>' +
        '<td class="num font-bold money">' + fmtMoney(s.total) + '</td>' +
        '<td class="num"><button class="btn btn-outline btn-sm" onclick="openReceipt(' + s.id + ')">Ver</button></td></tr>').join('') +
    '</tbody></table></div>';
  }

  openModal(modalHead('Ficha del cliente', 'Consulta de datos e historial (HU-05 · HU-06)') +
    '<div class="modal-body">' + body + '</div>' +
    '<div class="modal-foot"><button class="btn btn-outline" onclick="closeModal()">Cerrar</button>' +
    (hasPerm('clients.edit') ? '<button class="btn btn-primary" onclick="openClientForm(' + c.id + ')">' + icon('pencil','w-4 h-4') + ' Editar datos</button>' : '') + '</div>',
    { maxWidth:'680px' });
}
function openClientForm(id){                                 /* Formulario de registro/edición (HU-04, HU-07) */
  if(id && !requirePerm('clients.edit')) return;
  if(!id && !requirePerm('clients.create')) return;
  const c = id ? byId(DB.clients, id) : null;
  CLIENT_EDIT = id || null;
  openModal(modalHead(c ? 'Editar cliente' : 'Registrar cliente', 'Los campos obligatorios se validan antes de guardar (HU-04 · HU-07)') +
    '<div class="modal-body">' +
      '<div id="cfErrors" class="hidden err-box mb-4"></div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div><label class="label" for="cfDni">DNI (8 dígitos) *</label><input class="input" id="cfDni" maxlength="8" inputmode="numeric" placeholder="12345678" value="' + escapeHtml(c ? c.dni : '') + '" /></div>' +
        '<div><label class="label" for="cfName">Nombre completo *</label><input class="input" id="cfName" placeholder="Nombres y apellidos" value="' + escapeHtml(c ? c.name : '') + '" />' +
          '<p class="hint mt-1">Solo se aceptan letras y espacios, sin números ni caracteres especiales.</p></div>' +
        '<div><label class="label" for="cfEmail">Correo electrónico *</label><input class="input" id="cfEmail" type="email" placeholder="cliente@correo.com" value="' + escapeHtml(c ? c.email : '') + '" /></div>' +
        '<div><label class="label" for="cfPhone">Teléfono (opcional)</label><input class="input" id="cfPhone" maxlength="9" inputmode="numeric" placeholder="987654321" value="' + escapeHtml(c ? (c.phone||'') : '') + '" /></div>' +
      '</div>' +
      '<p class="hint mt-4">' + icon('info','w-3.5 h-3.5 inline') + ' El DNI debe ser único: el sistema verifica que no esté registrado previamente (HU-04).</p>' +
    '</div>' +
    '<div class="modal-foot"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn btn-primary" onclick="addClient()">' + icon('check','w-4 h-4') + (c ? ' Guardar cambios' : ' Registrar cliente') + '</button></div>');
}
function addClient(){                                        /* Valida y guarda cliente (nuevo o edición) */
  const dni = parseDigits(document.getElementById('cfDni').value);
  const name = document.getElementById('cfName').value.trim();
  const email = document.getElementById('cfEmail').value.trim();
  const phone = parseDigits(document.getElementById('cfPhone').value);
  const errors = [];
  if(!/^\d{8}$/.test(dni)) errors.push('El DNI es obligatorio y debe tener exactamente 8 dígitos.');
  else if(DB.clients.some(c => c.dni === dni && c.id !== CLIENT_EDIT)) errors.push('El DNI ' + dni + ' ya se encuentra registrado (HU-04).');
  if(!name) errors.push('El nombre del cliente es obligatorio.');
  else if(!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(name)) errors.push('El nombre del cliente solo debe contener letras y espacios, sin números ni caracteres especiales.');
  if(!EMAIL_RE.test(email)) errors.push('El correo electrónico no es válido (ejemplo: nombre@correo.com).');
  if(phone && !/^\d{7,9}$/.test(phone)) errors.push('El teléfono debe tener entre 7 y 9 dígitos.');
  if(errors.length){
    const box = document.getElementById('cfErrors');
    box.innerHTML = '<div class="font-semibold mb-1">Corrige los siguientes datos:</div><ul class="list-disc ml-4 space-y-0.5">' + errors.map(e => '<li>' + escapeHtml(e) + '</li>').join('') + '</ul>';
    box.classList.remove('hidden');
    toast('error', 'Revisa el formulario: hay ' + errors.length + ' error(es) de validación.');
    return;
  }
  if(CLIENT_EDIT){
    const c = byId(DB.clients, CLIENT_EDIT);
    c.dni = dni; c.name = name; c.email = email; c.phone = phone;
    audit('Cliente actualizado', 'DNI ' + dni + ' · ' + name);
    toast('success', 'Cliente «' + name + '» actualizado correctamente.');
  }else{
    DB.clients.push({ id:nextId(DB.clients), dni, name, email, phone, createdAt:new Date().toISOString() });
    audit('Cliente registrado', 'DNI ' + dni + ' · ' + name);
    toast('success', 'Cliente «' + name + '» registrado correctamente.');
  }
  save(); closeModal(); renderAll();
}

/* ============ PRODUCTOS (HU-08, HU-10, HU-11) ============ */
function openProduct(id){                                    /* Formulario registro/edición de producto */
  if(id && !requirePerm('products.edit')) return;
  if(!id && !requirePerm('products.create')) return;
  const p = id ? productById(id) : null;
  PRODUCT_EDIT = id || null;
  openModal(modalHead(p ? 'Editar producto' : 'Registrar producto', 'Código único, precio > 0 y stocks ≥ 0 (RN-04 · RN-05)') +
    '<div class="modal-body">' +
      '<div id="pfErrors" class="hidden err-box mb-4"></div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div><label class="label" for="pfCode">Código *</label><input class="input font-mono" id="pfCode" placeholder="TEC-005" value="' + escapeHtml(p ? p.code : '') + '" /></div>' +
        '<div><label class="label" for="pfName">Nombre *</label><input class="input" id="pfName" placeholder="Nombre del producto" value="' + escapeHtml(p ? p.name : '') + '" /></div>' +
        '<div><label class="label" for="pfCategory">Categoría *</label><select class="select" id="pfCategory">' +
          '<option value="">Seleccionar categoría</option>' +
          DB.categories.map(c => '<option value="' + c.id + '"' + (p && p.categoryId === c.id ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>').join('') + '</select></div>' +
        '<div><label class="label" for="pfOrigin">Origen *</label><select class="select" id="pfOrigin">' +
          '<option value="SAGABELLA"' + (p && (p.origin === 'SAGABELLA' || p.origin === 'SAGABELLA') ? ' selected' : '') + '>SAGABELLA — vendido por Sagabella</option>' +
          '<option value="OTRO"' + (p && p.origin === 'OTRO' ? ' selected' : '') + '>OTRO — vendido por otro vendedor</option></select></div>' +
        '<div class="sm:col-span-2"><label class="label" for="pfDesc">Descripción</label><input class="input" id="pfDesc" placeholder="Descripción breve del producto" value="' + escapeHtml(p ? (p.description||'') : '') + '" /></div>' +
        '<div><label class="label" for="pfPrice">Precio (S/) *</label><input class="input money" id="pfPrice" type="number" min="0.01" step="0.01" placeholder="0.00" value="' + (p ? p.price : '') + '" /></div>' +
        '<div><label class="label" for="pfStock">Stock *</label><input class="input" id="pfStock" type="number" min="0" step="1" placeholder="0" value="' + (p ? p.stock : '') + '" /></div>' +
        '<div><label class="label" for="pfMin">Stock mínimo *</label><input class="input" id="pfMin" type="number" min="0" step="1" placeholder="0" value="' + (p ? p.minStock : '') + '" /></div>' +
      '</div>' +
      '<p class="hint mt-4">' + icon('info','w-3.5 h-3.5 inline') + ' El origen determina el procedimiento de cambios y devoluciones (RN-23).</p>' +
    '</div>' +
    '<div class="modal-foot"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn btn-primary" onclick="addProduct()">' + icon('check','w-4 h-4') + (p ? ' Guardar cambios' : ' Registrar producto') + '</button></div>');
}
function addProduct(){                                       /* Valida y guarda producto (nuevo o edición) */
  const code = document.getElementById('pfCode').value.trim().toUpperCase();
  const name = document.getElementById('pfName').value.trim();
  const categoryId = parseInt(document.getElementById('pfCategory').value, 10);
  const origin = document.getElementById('pfOrigin').value;
  const desc = document.getElementById('pfDesc').value.trim();
  const price = parseFloat(document.getElementById('pfPrice').value);
  const stock = parseInt(document.getElementById('pfStock').value, 10);
  const minStock = parseInt(document.getElementById('pfMin').value, 10);
  const errors = [];
  if(!code) errors.push('El código del producto es obligatorio.');
  else if(!/^[A-Z0-9-]{3,20}$/.test(code)) errors.push('El código debe tener de 3 a 20 caracteres (letras, números o guiones).');
  else if(DB.products.some(p => p.code === code && p.id !== PRODUCT_EDIT)) errors.push('El código ' + code + ' ya existe en el catálogo (RN-04: código único).');
  if(!name) errors.push('El nombre del producto es obligatorio.');
  if(!categoryId) errors.push('Selecciona una categoría.');
  if(isNaN(price) || price <= 0) errors.push('El precio debe ser mayor que cero (RN-05).');
  if(isNaN(stock) || stock < 0) errors.push('El stock debe ser un entero mayor o igual que 0.');
  if(isNaN(minStock) || minStock < 0) errors.push('El stock mínimo debe ser un entero mayor o igual que 0.');
  if(errors.length){
    const box = document.getElementById('pfErrors');
    box.innerHTML = '<div class="font-semibold mb-1">Corrige los siguientes datos:</div><ul class="list-disc ml-4 space-y-0.5">' + errors.map(e => '<li>' + escapeHtml(e) + '</li>').join('') + '</ul>';
    box.classList.remove('hidden');
    toast('error', 'Revisa el formulario del producto: ' + errors.length + ' error(es).');
    return;
  }
  if(PRODUCT_EDIT){
    const p = productById(PRODUCT_EDIT);
    const oldPrice = p.price;
    const priceChanged = p.price !== price;
    Object.assign(p, { code, name, categoryId, origin, description:desc, price, stock, minStock });
    updateStockAlerts(p);
    audit('Producto actualizado', code + ' · ' + name + (priceChanged ? ' · precio: ' + fmtMoney(price) + ' (antes ' + fmtMoney(oldPrice) + ')' : ''));
    toast('success', 'Producto «' + name + '» actualizado' + (priceChanged ? ' — nuevo precio ' + fmtMoney(price) + ' (HU-11)' : '') + '.');
  }else{
    const p = { id:nextId(DB.products), code, name, categoryId, origin, description:desc, price, stock, minStock, createdAt:new Date().toISOString() };
    DB.products.push(p);
    updateStockAlerts(p);
    audit('Producto registrado', code + ' · ' + name + ' · stock ' + stock + ' · ' + fmtMoney(price));
    toast('success', 'Producto «' + name + '» registrado en el catálogo.');
  }
  save(); closeModal(); renderAll();
}
function openProductInfo(id){                                /* Consulta de información (HU-10) */
  const p = productById(id);
  const st = stockStatus(p);
  const promo = bestPromoFor(p);
  openModal(modalHead('Información del producto', escapeHtml(p.code) + ' · consulta de precio, descripción y disponibilidad (HU-10)') +
    '<div class="modal-body">' +
      '<div class="flex items-start justify-between gap-3 mb-4 flex-wrap">' +
        '<div><h4 class="text-lg font-bold text-slate-900 leading-tight">' + escapeHtml(p.name) + '</h4>' +
        '<div class="flex gap-2 mt-2 flex-wrap"><span class="badge b-slate">' + escapeHtml(categoryName(p.categoryId)) + '</span>' +
        '<span class="badge ' + ((p.origin === 'SAGABELLA' || p.origin === 'SAGABELLA') ? 'b-teal' : 'b-slate') + '">' + escapeHtml(p.origin) + '</span>' +
        (promo ? '<span class="badge b-violet">' + icon('percent','w-3 h-3') + escapeHtml(promo.name) + '</span>' : '') + '</div></div>' +
        '<div class="text-right"><div class="text-2xl font-extrabold text-brand-700 money">' + fmtMoney(p.price) + '</div>' +
        (promo ? '<div class="text-[11px] text-violet-600 font-semibold">' + promo.value + '% de descuento vigente</div>' : '') + '</div>' +
      '</div>' +
      '<p class="text-[13px] text-slate-600 leading-relaxed mb-4">' + escapeHtml(p.description || 'Sin descripción registrada.') + '</p>' +
      '<div class="grid grid-cols-3 gap-3">' +
        '<div class="rounded-xl border border-slate-200 p-3.5 text-center"><div class="text-[11px] text-slate-400 uppercase font-semibold tracking-wide mb-1">Disponibilidad</div>' +
          '<div class="text-xl font-extrabold ' + (p.stock === 0 ? 'text-rose-600' : p.stock <= p.minStock ? 'text-amber-600' : 'text-emerald-600') + '">' + p.stock + '</div>' +
          '<div class="mt-1"><span class="badge ' + st.cls + '">' + st.label + '</span></div></div>' +
        '<div class="rounded-xl border border-slate-200 p-3.5 text-center"><div class="text-[11px] text-slate-400 uppercase font-semibold tracking-wide mb-1">Stock mínimo</div>' +
          '<div class="text-xl font-extrabold text-slate-700">' + p.minStock + '</div><div class="text-[11px] text-slate-400 mt-1.5">umbral de reposición</div></div>' +
        '<div class="rounded-xl border border-slate-200 p-3.5 text-center"><div class="text-[11px] text-slate-400 uppercase font-semibold tracking-wide mb-1">Registrado</div>' +
          '<div class="text-[13px] font-bold text-slate-700 mt-1.5">' + fmtDate(p.createdAt) + '</div></div>' +
      '</div>' +
      (p.stock === 0 ? '<div class="mt-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-[12.5px] p-3.5 flex items-center gap-2">' + icon('alert','w-4 h-4') + ' El producto no está disponible actualmente (stock 0 — HU-12).</div>' : '') +
    '</div>' +
    '<div class="modal-foot"><button class="btn btn-outline" onclick="closeModal()">Cerrar</button>' +
    (hasPerm('products.adjust') ? '<button class="btn btn-primary" onclick="openAdjust(' + p.id + ')">' + icon('repeat','w-4 h-4') + ' Ajustar stock</button>' : '') + '</div>');
}

/* ============ INVENTARIO: ajustes (HU-13, RN desde EX) ============ */
function openAdjust(productId){
  if(!requirePerm('products.adjust')) return;
  const p = productById(productId);
  ADJUST_PRODUCT = productId;
  openModal(modalHead('Ajuste de inventario', escapeHtml(p.code) + ' · ' + escapeHtml(p.name) + ' (HU-13)') +
    '<div class="modal-body">' +
      '<div class="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4 flex items-center justify-between flex-wrap gap-2">' +
        '<div class="text-[13px] text-slate-600">Stock actual: <b class="' + (p.stock === 0 ? 'text-rose-600' : p.stock <= p.minStock ? 'text-amber-600' : 'text-slate-800') + '">' + p.stock + '</b> · mínimo <b>' + p.minStock + '</b></div>' +
        '<span class="badge ' + stockStatus(p).cls + '">' + stockStatus(p).label + '</span>' +
      '</div>' +
      '<div id="adjErrors" class="hidden err-box mb-4"></div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div><label class="label" for="adjType">Tipo de ajuste *</label><select class="select" id="adjType" onchange="previewAdjust()">' +
          '<option value="Entrada">Entrada (+ suma unidades)</option>' +
          '<option value="Salida">Salida (− resta unidades)</option>' +
          '<option value="Ajuste">Ajuste (= fijar cantidad exacta)</option></select></div>' +
        '<div><label class="label" for="adjQty">Cantidad *</label><input class="input" id="adjQty" type="number" min="0" step="1" placeholder="0" oninput="previewAdjust()" /></div>' +
        '<div class="sm:col-span-2"><label class="label" for="adjReason">Motivo del ajuste *</label><input class="input" id="adjReason" placeholder="Ej. Reposición de proveedor, inventario físico…" /></div>' +
      '</div>' +
      '<div id="adjPreview" class="mt-4 rounded-xl border border-teal-100 bg-teal-50/70 text-[13px] text-teal-800 p-4"></div>' +
      '<p class="hint mt-3">' + icon('info','w-3.5 h-3.5 inline') + ' La cantidad resultante no puede ser negativa. El ajuste queda registrado con usuario, fecha y hora (HU-13 · RN-03).</p>' +
    '</div>' +
    '<div class="modal-foot"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn btn-primary" onclick="applyAdjust()">' + icon('check','w-4 h-4') + ' Aplicar ajuste</button></div>');
  previewAdjust();
}
function previewAdjust(){
  const p = productById(ADJUST_PRODUCT);
  const type = document.getElementById('adjType').value;
  const qty = parseInt(document.getElementById('adjQty').value, 10);
  const box = document.getElementById('adjPreview');
  if(isNaN(qty) || qty < 0){
    box.innerHTML = 'Ingresa una cantidad válida para ver el resultado del ajuste.';
    box.className = 'mt-4 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-600 p-4';
    return;
  }
  const result = type === 'Entrada' ? p.stock + qty : type === 'Salida' ? p.stock - qty : qty;
  const valid = result >= 0;
  box.innerHTML = 'Resultado: <b>' + p.stock + '</b> ' + (type === 'Entrada' ? '+ ' + qty : type === 'Salida' ? '− ' + qty : '= ' + qty) +
    ' → <b class="' + (valid ? (result <= p.minStock ? 'text-amber-700' : 'text-teal-800') : 'text-rose-700') + '">' + (valid ? result : 'negativo ✗') + '</b> unidades' +
    (valid && result <= p.minStock ? ' — ' + icon('alert','w-3.5 h-3.5 inline') + ' quedará en reposición (stock ≤ mínimo)' : '') +
    (valid ? '' : ' — la cantidad resultante no puede ser negativa');
  box.className = 'mt-4 rounded-xl border p-4 text-[13px] ' + (valid ? 'border-teal-100 bg-teal-50/70 text-teal-800' : 'border-rose-100 bg-rose-50 text-rose-700');
}
function applyAdjust(){
  const p = productById(ADJUST_PRODUCT);
  const type = document.getElementById('adjType').value;
  const qty = parseInt(document.getElementById('adjQty').value, 10);
  const reason = document.getElementById('adjReason').value.trim();
  const errors = [];
  if(isNaN(qty) || qty < 1) errors.push('La cantidad del ajuste debe ser un entero mayor o igual que 1.');
  if(!reason) errors.push('El motivo del ajuste es obligatorio.');
  const previous = p.stock;
  const result = type === 'Entrada' ? previous + qty : type === 'Salida' ? previous - qty : qty;
  if(!errors.length && result < 0) errors.push('La cantidad resultante (' + result + ') no puede ser negativa (HU-13).');
  if(errors.length){
    const box = document.getElementById('adjErrors');
    box.innerHTML = errors.map(e => '<div>• ' + escapeHtml(e) + '</div>').join('');
    box.classList.remove('hidden');
    toast('error', 'No se pudo aplicar el ajuste: revisa los datos.');
    return;
  }
  p.stock = result;
  updateStockAlerts(p);
  DB.inventoryAdjustments.push({ id:nextId(DB.inventoryAdjustments), productId:p.id, code:p.code, type, qty,
    previousStock:previous, newStock:result, reason, user:session.fullName, at:new Date().toISOString() });
  audit('Ajuste de inventario', p.code + ' · ' + type + ' ' + qty + ' → stock ' + result + ' (antes ' + previous + ') · ' + reason);
  save(); closeModal(); renderAll();
  toast('success', 'Inventario ajustado: ' + p.code + ' ahora tiene ' + result + ' unidades.');
}

/* ============ VENTAS (EP-05 · EP-06): carrito, promociones, pago, confirmación ============ */
function openSale(){                                         /* HU-16: inicio de una venta */
  if(!requirePerm('sales.create')) return;
  SALE = { clientId:0, items:[], method:'Efectivo', received:'', card:'', phone:'' };
  openModal(
    modalHead('Nueva venta', 'Selecciona cliente y productos; el sistema calcula subtotales, promociones y total (HU-16 a HU-20)') +
    '<div class="modal-body !p-0">' +
      '<div class="grid grid-cols-1 lg:grid-cols-5 gap-0 lg:divide-x divide-slate-100">' +
        '<div class="lg:col-span-3 p-5">' +
          '<label class="label" for="saleClient">Cliente (HU-16)</label>' +
          '<select class="select mb-4" id="saleClient" onchange="SALE.clientId=parseInt(this.value,10)">' +
            '<option value="0">Cliente general (sin registro)</option>' +
            DB.clients.map(c => '<option value="' + c.id + '">' + escapeHtml(c.name + ' — DNI ' + c.dni) + '</option>').join('') +
          '</select>' +
          '<label class="label">Buscar producto (nombre, código o categoría — HU-09)</label>' +
          '<div class="relative mb-3">' +
            '<span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">' + icon('search','w-4 h-4') + '</span>' +
            '<input class="input !pl-10" id="saleProductSearch" placeholder="Ej. audífonos, TEC-002, Tecnología…" oninput="renderSaleProducts()" />' +
          '</div>' +
          '<div id="saleProductList" class="border border-slate-200 rounded-xl max-h-64 overflow-y-auto scroll-styled"></div>' +
        '</div>' +
        '<div class="lg:col-span-2 p-5 bg-slate-50/60">' +
          '<h4 class="text-[13px] font-bold text-slate-700 mb-2 flex items-center gap-2">' + icon('cart','w-4 h-4 text-brand-700') + ' Carrito de la venta</h4>' +
          '<div id="saleCart" class="mb-4"></div>' +
          '<h4 class="text-[13px] font-bold text-slate-700 mb-2 flex items-center gap-2">' + icon('wallet','w-4 h-4 text-brand-700') + ' Método de pago (HU-22)</h4>' +
          '<select class="select mb-3" id="saleMethod" onchange="onMethodChange()">' +
            PAY_METHODS.map(m => '<option value="' + m + '">' + m + '</option>').join('') +
          '</select>' +
          '<div id="payFields"></div>' +
          '<div id="saleTotals"></div>' +
        '</div>' +
      '</div>' +
      '<div id="saleErrors" class="hidden m-5 err-box"></div>' +
    '</div>' +
    '<div class="modal-foot !justify-between">' +
      '<button class="btn btn-outline" onclick="closeModal()">Cancelar venta</button>' +
      '<button class="btn btn-primary !px-5" onclick="addSale()">' + icon('check','w-4 h-4') + ' Confirmar venta (HU-20)</button>' +
    '</div>',
    { maxWidth:'1000px' });
  renderSaleProducts();
  renderCart();
  onMethodChange();
}
function renderSaleProducts(){                               /* Listado de productos disponibles (HU-17) */
  const q = normalizeText(document.getElementById('saleProductSearch').value);
  const list = DB.products.filter(p => !q || [p.name, p.code, categoryName(p.categoryId)].some(v => normalizeText(v).includes(q)));
  const box = document.getElementById('saleProductList');
  if(!list.length){
    box.innerHTML = '<div class="empty-state !py-6"><div class="ico">' + icon('search') + '</div><p class="text-[12.5px] font-medium text-slate-500">No se encontró el producto (EX-03).</p></div>';
    return;
  }
  box.innerHTML = list.map(p => {
    const promo = bestPromoFor(p);
    const inCart = SALE.items.find(it => it.productId === p.id);
    return '<div class="flex items-center gap-3 p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition">' +
      '<div class="min-w-0 flex-1">' +
        '<div class="flex items-center gap-2 flex-wrap"><span class="text-[13px] font-semibold text-slate-800 truncate">' + escapeHtml(p.name) + '</span>' +
        (promo ? '<span class="badge b-violet">' + icon('percent','w-3 h-3') + promo.value + '%</span>' : '') + '</div>' +
        '<div class="text-[11px] text-slate-400">' + escapeHtml(p.code) + ' · ' + escapeHtml(categoryName(p.categoryId)) + ' · stock <b class="' + (p.stock === 0 ? 'text-rose-500' : p.stock <= p.minStock ? 'text-amber-600' : 'text-slate-500') + '">' + p.stock + '</b></div>' +
      '</div>' +
      '<span class="text-[13px] font-bold money text-slate-700 flex-shrink-0">' + fmtMoney(p.price) + '</span>' +
      '<button class="btn btn-primary btn-icon flex-shrink-0" ' + (p.stock === 0 ? 'disabled title="Sin stock (HU-12)"' : 'title="Agregar al carrito"') + ' onclick="addToSaleCart(' + p.id + ')">' + icon(inCart ? 'check' : 'plus','w-4 h-4') + '</button>' +
    '</div>';
  }).join('');
}
function addToSaleCart(productId){                           /* HU-17: agregar con validación de stock en venta local (RN-06, EX-04) */
  const p = productById(productId);
  if(!p) return;
  const item = SALE.items.find(it => it.productId === productId);
  const newQty = (item ? item.qty : 0) + 1;
  if(newQty > p.stock){
    toast('warning', 'Stock insuficiente para “' + p.name + '”: disponible ' + p.stock + ' unidad(es) (EX-04 – RN-06).');
    return;
  }
  if(item) item.qty = newQty; else SALE.items.push({ productId, qty:1 });
  renderSaleProducts(); renderCart();
}
function addToCart(productId){
  return addToSaleCart(productId);
}
window.addToSaleCart = addToSaleCart;
window.addToCart = addToSaleCart;
function setCartQty(productId, val){                          /* Modificar cantidades (HU-17) */
  const p = productById(productId);
  const item = SALE.items.find(it => it.productId === productId);
  if(!p || !item) return;
  let qty = parseInt(val, 10);
  if(isNaN(qty) || qty < 1) qty = 1;
  if(qty > p.stock){
    toast('warning', 'Stock insuficiente: solo hay ' + p.stock + ' unidad(es) de «' + p.name + '» (EX-04).');
    qty = p.stock;
  }
  item.qty = qty;
  renderCart();
}
function changeCartQty(productId, delta){
  const item = SALE.items.find(it => it.productId === productId);
  if(!item) return;
  setCartQty(productId, item.qty + delta);
}
function removeFromCart(productId){
  SALE.items = SALE.items.filter(it => it.productId !== productId);
  renderSaleProducts(); renderCart();
}
function renderCart(){                                       /* Carrito + totales automáticos (HU-18, HU-19) */
  const box = document.getElementById('saleCart');
  if(!SALE.items.length){
    box.innerHTML = '<div class="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-[12.5px] text-slate-400">Agrega productos desde el listado.<br>Una venta requiere al menos un producto (RN-09).</div>';
  }else{
    box.innerHTML = '<div class="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 max-h-56 overflow-y-auto scroll-styled">' +
      SALE.items.map(it => {
        const p = productById(it.productId);
        return '<div class="flex items-center gap-2.5 p-2.5">' +
          '<div class="min-w-0 flex-1"><div class="text-[12.5px] font-semibold text-slate-700 truncate">' + escapeHtml(p.name) + '</div>' +
          '<div class="text-[11px] text-slate-400 money">' + fmtMoney(p.price) + ' c/u</div></div>' +
          '<div class="flex items-center gap-1 flex-shrink-0">' +
            '<button class="btn btn-outline btn-icon !p-1" onclick="changeCartQty(' + p.id + ',-1)" aria-label="Restar">' + icon('minus','w-3.5 h-3.5') + '</button>' +
            '<input class="input !w-11 !px-1 !py-1 text-center !text-[12px]" type="number" min="1" value="' + it.qty + '" onchange="setCartQty(' + p.id + ', this.value)" aria-label="Cantidad" />' +
            '<button class="btn btn-outline btn-icon !p-1" onclick="changeCartQty(' + p.id + ',1)" aria-label="Sumar">' + icon('plus','w-3.5 h-3.5') + '</button>' +
          '</div>' +
          '<div class="text-[12.5px] font-bold money text-slate-800 w-[76px] text-right flex-shrink-0">' + fmtMoney(p.price * it.qty) + '</div>' +
          '<button class="btn btn-ghost btn-icon !p-1.5 text-rose-500 hover:!bg-rose-50 flex-shrink-0" onclick="removeFromCart(' + p.id + ')" aria-label="Quitar" title="Quitar del carrito">' + icon('trash','w-4 h-4') + '</button>' +
        '</div>';
      }).join('') + '</div>';
  }
  updateSaleTotals();
}
function updateSaleTotals(){
  const totals = computeSaleTotals(SALE.items);
  const box = document.getElementById('saleTotals');
  if(!box) return;
  box.innerHTML = '<div class="rounded-xl bg-white border border-slate-200 p-4 mt-3 space-y-1.5">' +
    '<div class="flex justify-between text-[13px] text-slate-600"><span>Subtotal (HU-18)</span><span class="font-semibold money">' + fmtMoney(totals.subtotal) + '</span></div>' +
    (totals.applied.map(a =>
      '<div class="flex justify-between text-[12px] text-violet-700"><span>' + icon('percent','w-3 h-3 inline') + ' ' + escapeHtml(a.code) + ' — ' + escapeHtml(a.name) + '</span><span class="font-semibold money">−' + fmtMoney(a.amount) + '</span></div>'
    ).join('')) +
    '<div class="flex justify-between text-[12px] text-slate-400' + (totals.discount ? '' : ' hidden') + '"><span>Total descuentos</span><span class="font-semibold money">−' + fmtMoney(totals.discount) + '</span></div>' +
    '<div class="flex justify-between items-center pt-2 border-t border-slate-100"><span class="text-[13px] font-bold text-slate-700">Total a pagar</span>' +
    '<span class="text-xl font-extrabold text-brand-700 money">' + fmtMoney(totals.total) + '</span></div>' +
    (totals.discount ? '<p class="hint !mt-1">' + icon('info','w-3 h-3 inline') + ' Promociones vigentes aplicadas automáticamente (RN-08).</p>' : '') +
  '</div>';
}
function onMethodChange(){                                   /* HU-22: información según el método */
  const method = document.getElementById('saleMethod').value;
  SALE.method = method;
  const box = document.getElementById('payFields');
  if(method === 'Efectivo'){
    box.innerHTML = '<label class="label" for="payReceived">Monto recibido (S/) *</label>' +
      '<input class="input money" id="payReceived" type="number" min="0" step="0.10" placeholder="0.00" oninput="updateVuelto()" />' +
      '<div id="payChange" class="hint mt-2"></div>' +
      '<p class="hint mt-1">' + icon('info','w-3 h-3 inline') + ' Se valida que el monto cubra el total y se calcula el vuelto (RN-11, RN-12).</p>';
  }else if(method === 'Tarjeta'){
    box.innerHTML = '<label class="label" for="payCard">Número de tarjeta (demo) *</label>' +
      '<input class="input font-mono" id="payCard" maxlength="19" placeholder="4242 4242 4242 4242" oninput="previewCard()" />' +
      '<div id="payCardState" class="hint mt-2"></div>' +
      '<p class="hint mt-1">' + icon('info','w-3 h-3 inline') + ' Simulación de pasarela: se aprueba con 16 dígitos; si es inválida, el pago se rechaza y la venta no se confirma (HU-23 · EX-05).</p>';
  }else{
    box.innerHTML = '<label class="label" for="payPhone">Celular de Yape/Plin (demo) *</label>' +
      '<input class="input font-mono" id="payPhone" maxlength="9" inputmode="numeric" placeholder="987654321" oninput="previewPhone()" />' +
      '<div id="payPhoneState" class="hint mt-2"></div>' +
      '<p class="hint mt-1">' + icon('info','w-3 h-3 inline') + ' Simulación: se aprueba con 9 dígitos; un número inválido rechaza el pago (EX-05).</p>';
  }
}
function updateVuelto(){
  const received = parseFloat(document.getElementById('payReceived').value);
  const totals = computeSaleTotals(SALE.items);
  const el = document.getElementById('payChange');
  if(isNaN(received)){ el.innerHTML = ''; return; }
  if(received < totals.total){
    el.innerHTML = '<span class="text-rose-600 font-semibold">Monto insuficiente: faltan S/ ' + (totals.total - received).toFixed(2) + ' (EX-06)</span>';
  }else{
    el.innerHTML = '<span class="text-emerald-700 font-semibold">Vuelto: S/ ' + (received - totals.total).toFixed(2) + ' (RN-12)</span>';
  }
}
function previewCard(){
  const digits = parseDigits(document.getElementById('payCard').value);
  const el = document.getElementById('payCardState');
  el.innerHTML = digits.length
    ? '<span class="' + (digits.length === 16 ? 'text-emerald-700' : 'text-amber-600') + ' font-semibold">' + digits.length + '/16 dígitos</span>'
    : '';
}
function previewPhone(){
  const digits = parseDigits(document.getElementById('payPhone').value);
  const el = document.getElementById('payPhoneState');
  el.innerHTML = digits.length
    ? '<span class="' + (digits.length === 9 ? 'text-emerald-700' : 'text-amber-600') + ' font-semibold">' + digits.length + '/9 dígitos</span>'
    : '';
}
function registerRejectedPayment(method, amount, reason){    /* EX-05: pago rechazado queda registrado */
  DB.payments.push({ id:nextId(DB.payments), saleId:null, method, amount, received:null, change:null,
    reference:null, status:'Rechazado', note:reason, at:new Date().toISOString() });
  audit('Pago rechazado', method + ' · intento por ' + fmtMoney(amount) + ' · ' + reason + ' (EX-05)');
  save();
}
function addSale(){                                          /* Confirmación de la venta (HU-20, RN-06..RN-13) */
  const errBox = document.getElementById('saleErrors');
  const showErrs = list => { errBox.innerHTML = list.map(e => '<div>• ' + escapeHtml(e) + '</div>').join(''); errBox.classList.remove('hidden'); errBox.scrollIntoView({ behavior:'smooth', block:'center' }); };
  errBox.classList.add('hidden');

  if(!SALE.items.length){ showErrs(['La venta debe contener al menos un producto (RN-09 · EX-08).']); toast('error', 'Venta sin productos: agrégalos al carrito antes de confirmar (EX-08).'); return; }
  for(const it of SALE.items){                               /* re-validación de stock en el momento de confirmar */
    const p = productById(it.productId);
    if(!p){ showErrs(['Un producto del carrito ya no existe.']); return; }
    if(it.qty > p.stock){ showErrs(['Stock insuficiente para «' + p.name + '»: solicitado ' + it.qty + ', disponible ' + p.stock + ' (RN-06 · EX-04).']); toast('error', 'Stock insuficiente para «' + p.name + '»: disponible ' + p.stock + ' (EX-04).'); return; }
  }
  const totals = computeSaleTotals(SALE.items);
  SALE.clientId = parseInt(document.getElementById('saleClient').value, 10) || 0;
  const method = document.getElementById('saleMethod').value;

  /* Validación del pago (RN-10, RN-11, RN-12) */
  let payApproved = false, payReceived = null, payChange = null, payRef = null, rejectReason = null;
  if(method === 'Efectivo'){
    payReceived = parseFloat(document.getElementById('payReceived').value);
    if(isNaN(payReceived) || payReceived < totals.total){
      const falta = (isNaN(payReceived) ? totals.total : totals.total - payReceived).toFixed(2);
      showErrs(['Monto en efectivo insuficiente: falta S/ ' + falta + ' (RN-11 · EX-06).']);
      toast('error', 'Monto insuficiente: faltan S/ ' + falta + ' (EX-06).');
      return;
    }
    payChange = round2(payReceived - totals.total);
    payApproved = true;
  }else if(method === 'Tarjeta'){
    const digits = parseDigits(document.getElementById('payCard').value);
    if(digits.length !== 16){ rejectReason = 'Tarjeta inválida: se requieren 16 dígitos'; }
    else{ payApproved = true; payRef = '**** ' + digits.slice(-4); }
  }else{
    const digits = parseDigits(document.getElementById('payPhone').value);
    if(digits.length !== 9){ rejectReason = 'Celular Yape/Plin inválido: se requieren 9 dígitos'; }
    else{ payApproved = true; payRef = digits.slice(0,3) + ' ' + digits.slice(3,6) + ' ' + digits.slice(6); }
  }
  if(!payApproved){                                          /* EX-05: pago rechazado, venta NO confirmada */
    registerRejectedPayment(method, totals.total, rejectReason);
    showErrs([rejectReason + '. El pago quedó registrado como rechazado y la venta NO fue confirmada (EX-05 · RN-10).']);
    toast('error', 'Pago con ' + method + ' rechazado: la venta no se confirmó (EX-05).');
    renderAll();
    return;
  }

  /* 1) Pago aprobado */
  const paymentId = nextId(DB.payments);
  DB.payments.push({ id:paymentId, saleId:null, method, amount:totals.total, received:payReceived, change:payChange,
    reference:payRef, status:'Aprobado', at:new Date().toISOString() });

  /* 2) Venta + detalle + promociones */
  const saleId = nextId(DB.sales);
  const saleCode = 'V-' + pad4(saleId);
  const payment = DB.payments.find(p => p.id === paymentId);
  payment.saleId = saleId;
  DB.sales.push({ id:saleId, code:saleCode, clientId:SALE.clientId, userId:session.userId, userName:session.fullName,
    at:new Date().toISOString(), subtotal:totals.subtotal, discount:totals.discount, total:totals.total,
    paymentId, status:'Confirmada' });
  SALE.items.forEach(it => {
    const p = productById(it.productId);
    DB.saleDetails.push({ id:nextId(DB.saleDetails), saleId, productId:p.id, code:p.code, name:p.name,
      qty:it.qty, unitPrice:p.price, subtotal:round2(p.price * it.qty) });
  });
  totals.applied.forEach(a => DB.salePromotions.push({ id:nextId(DB.salePromotions), saleId, promotionId:a.promotionId, code:a.code, amount:a.amount }));

  /* 3) Descuento de stock (HU-14 · RN-07) + alertas (HU-15) */
  SALE.items.forEach(it => {
    const p = productById(it.productId);
    p.stock -= it.qty;
    updateStockAlerts(p);
  });

  /* 4) Comprobante (HU-21) */
  DB.receipts.push({ id:nextId(DB.receipts), code:'C-' + pad4(saleId), saleId, issuedAt:new Date().toISOString() });

  /* 5) Pedido (HU-26 · RN-13) */
  const orderId = nextId(DB.orders);
  const orderCode = 'PD-' + pad4(orderId);
  DB.orders.push({ id:orderId, code:orderCode, saleId, clientId:SALE.clientId, at:new Date().toISOString(),
    state:'Preparando', total:totals.total,
    items:SALE.items.map(it => { const p = productById(it.productId); return { productId:p.id, code:p.code, name:p.name, qty:it.qty, unitPrice:p.price, subtotal:round2(p.price * it.qty) }; }),
    history:[{ state:'Preparando', at:new Date().toISOString(), by:'Sistema' }] });

  audit('Venta confirmada', saleCode + ' · ' + clientById(SALE.clientId).name + ' · ' + fmtMoney(totals.total) + ' (' + method + ')');
  audit('Pedido generado', orderCode + ' generado para ' + saleCode + ' (estado inicial: Preparando)');
  save();
  const saleRef = SALE;
  SALE = null;
  closeModal();
  renderAll();
  toast('success', 'Venta ' + saleCode + ' confirmada por ' + fmtMoney(totals.total) + '. Comprobante y pedido ' + orderCode + ' generados.');
  openReceipt(saleId);
}

/* ============ COMPROBANTE (HU-21) ============ */
function receiptHTML(saleId, forModal){
  const sale = saleById(saleId);
  if(!sale) return '<p>Venta no encontrada.</p>';
  const details = saleDetailsOf(saleId);
  const pay = paymentBySaleId(saleId);
  const receipt = receiptBySaleId(saleId);
  const order = orderBySaleId(saleId);
  const promos = DB.salePromotions.filter(sp => sp.saleId === saleId);
  const client = clientById(sale.clientId);
  const body =
    '<div class="flex items-center justify-center gap-2.5 mb-4">' +
      '<div class="w-9 h-9 rounded-lg bg-brand-700 grid place-items-center"><span class="font-black text-white text-base leading-none">S</span></div>' +
      '<div class="text-center"><div class="text-lg font-extrabold tracking-tight lowercase leading-none">sagabella</div>' +
      '<div class="text-[10px] text-slate-400 tracking-wide uppercase mt-0.5">Comprobante de venta</div></div>' +
    '</div>' +
    '<div class="flex items-center justify-between gap-2 mb-3 flex-wrap">' +
      '<span class="font-mono text-[15px] font-bold text-brand-700">' + escapeHtml(receipt ? receipt.code : 'C-' + pad4(sale.id)) + '</span>' +
      '<span class="badge ' + (sale.status === 'Confirmada' ? 'b-green' : 'b-red') + '"><span class="dot"></span>' + escapeHtml(sale.status) + '</span>' +
    '</div>' +
    '<div class="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] text-slate-600 mb-4 pb-4 border-b border-dashed border-slate-200">' +
      '<div><span class="text-slate-400">Nº venta:</span> <b>' + escapeHtml(sale.code) + '</b></div>' +
      '<div><span class="text-slate-400">Fecha:</span> <b>' + fmtDateTime(sale.at) + '</b></div>' +
      '<div><span class="text-slate-400">Cliente:</span> <b>' + escapeHtml(client.name) + '</b></div>' +
      '<div><span class="text-slate-400">DNI:</span> ' + escapeHtml(client.dni) + '</div>' +
      '<div><span class="text-slate-400">Vendedor:</span> ' + escapeHtml(sale.userName) + '</div>' +
      '<div><span class="text-slate-400">Pedido:</span> ' + (order ? '<b>' + escapeHtml(order.code) + '</b> (' + order.state + ')' : '—') + '</div>' +
    '</div>' +
    '<table class="w-full text-[12px] mb-3"><thead><tr class="text-[10px] uppercase tracking-wide text-slate-400">' +
      '<th class="text-left pb-1.5 font-semibold">Producto</th><th class="text-center pb-1.5 font-semibold">Cant.</th>' +
      '<th class="text-right pb-1.5 font-semibold">P.Unit</th><th class="text-right pb-1.5 font-semibold">Importe</th></tr></thead><tbody>' +
      details.map(dt =>
        '<tr class="border-t border-slate-100"><td class="py-1.5 text-slate-700"><div class="font-medium">' + escapeHtml(dt.name) + '</div><div class="text-[10px] text-slate-400">' + escapeHtml(dt.code) + '</div></td>' +
        '<td class="text-center">' + dt.qty + '</td><td class="text-right money">' + fmtMoney(dt.unitPrice) + '</td><td class="text-right money font-semibold">' + fmtMoney(dt.subtotal) + '</td></tr>').join('') +
    '</tbody></table>' +
    '<div class="space-y-1 pt-3 border-t border-dashed border-slate-200 text-[12.5px]">' +
      '<div class="flex justify-between text-slate-600"><span>Subtotal</span><span class="money font-medium">' + fmtMoney(sale.subtotal) + '</span></div>' +
      (promos.length ? promos.map(sp => '<div class="flex justify-between text-violet-700"><span>' + icon('percent','w-3 h-3 inline') + ' ' + escapeHtml(sp.code) + '</span><span class="money font-medium">−' + fmtMoney(sp.amount) + '</span></div>').join('') : '') +
      (sale.discount ? '<div class="flex justify-between text-slate-500"><span>Total descuentos</span><span class="money font-medium">−' + fmtMoney(sale.discount) + '</span></div>' : '') +
      '<div class="flex justify-between items-center pt-2 mt-1 border-t border-slate-200"><span class="font-bold text-slate-700">TOTAL</span><span class="text-xl font-extrabold text-brand-700 money">' + fmtMoney(sale.total) + '</span></div>' +
    '</div>' +
    '<div class="mt-4 pt-3 border-t border-dashed border-slate-200 text-[12px] text-slate-600 space-y-1">' +
      '<div class="flex justify-between"><span>Método de pago</span><span class="font-semibold">' + (pay ? paymentBadge(pay.method) : '—') + '</span></div>' +
      (pay ? '<div class="flex justify-between"><span>Estado del pago</span><span class="font-semibold ' + (pay.status === 'Aprobado' ? 'text-emerald-600' : 'text-rose-600') + '">' + pay.status + (pay.reference ? ' · ' + escapeHtml(pay.reference) : '') + '</span></div>' : '') +
      (pay && pay.method === 'Efectivo' ? '<div class="flex justify-between"><span>Recibido / Vuelto</span><span class="font-semibold money">' + fmtMoney(pay.received) + ' / ' + fmtMoney(pay.change) + '</span></div>' : '') +
    '</div>' +
    '<p class="text-center text-[10.5px] text-slate-400 mt-4 leading-relaxed">Gracias por su compra — documento simulado generado por el sistema de demostración académica.<br>Puedes consultarlo con el número de venta ' + escapeHtml(sale.code) + '.</p>';
  return body;
}
function openReceipt(saleId){
  if(!requirePerm('sales.view')) return;
  openModal(
    modalHead('Comprobante de pago', 'Constancia de la transacción (HU-21)', { }) +
    '<div class="modal-body">' + receiptHTML(saleId, true) + '</div>' +
    '<div class="modal-foot no-print"><button class="btn btn-outline" onclick="closeModal()">Cerrar</button>' +
    '<button class="btn btn-primary" onclick="printReceipt()">' + icon('printer','w-4 h-4') + ' Imprimir comprobante</button></div>',
    { maxWidth:'480px' });
}
function printReceipt(){
  document.body.classList.add('print-receipt');
  window.print();
  setTimeout(function(){ document.body.classList.remove('print-receipt'); }, 500);
}

/* ============ PEDIDOS (HU-26, HU-27) ============ */
function openOrderDetail(orderId){
  const order = orderById(orderId);
  if(!order) return;
  const sale = saleById(order.saleId);
  const pay = paymentBySaleId(order.saleId);
  const steps = ORDER_STATES.map(st => {
    const done = ORDER_STATES.indexOf(order.state) >= ORDER_STATES.indexOf(st);
    const hist = (order.history || []).find(h => h.state === st);
    return '<div class="flex items-start gap-3">' +
      '<span class="w-8 h-8 rounded-full grid place-items-center border flex-shrink-0 ' + (done ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-200 text-slate-300') + '">' + icon(done ? 'check' : 'clock','w-4 h-4') + '</span>' +
      '<div class="min-w-0 pt-1"><div class="text-[13px] font-bold ' + (done ? 'text-slate-800' : 'text-slate-400') + '">' + st + '</div>' +
      (hist ? '<div class="text-[11px] text-slate-400">' + fmtDateTime(hist.at) + ' · ' + escapeHtml(hist.by) + '</div>' : '<div class="text-[11px] text-slate-300">pendiente</div>') + '</div></div>';
  }).join('<div class="ml-4 my-1 h-4 w-px ' + (true ? 'bg-slate-200' : '') + '"></div>');

  openModal(modalHead('Pedido ' + escapeHtml(order.code), 'Venta ' + escapeHtml(sale ? sale.code : '—') + ' · seguimiento del pedido (HU-27)') +
    '<div class="modal-body">' +
      '<div class="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4 flex items-center justify-between flex-wrap gap-2">' +
        '<div class="text-[12.5px] text-slate-600">Cliente: <b>' + escapeHtml(clientById(order.clientId).name) + '</b> · ' + fmtDateTime(order.at) + '</div>' +
        orderStateBadge(order.state) +
      '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 mb-4">' +
        '<div class="flex flex-col">' + steps + '</div>' +
        '<div class="rounded-xl border border-slate-200 p-4">' +
          '<table class="w-full text-[12.5px]"><tbody>' + order.items.map(it =>
            '<tr><td class="py-1.5 text-slate-700 font-medium">' + it.qty + '× ' + escapeHtml(it.name) + '</td><td class="text-right money text-slate-600">' + fmtMoney(it.subtotal) + '</td></tr>').join('') +
          '<tr class="border-t border-slate-100"><td class="pt-2 font-bold text-slate-700">Total' + (pay ? ' (' + escapeHtml(pay.method) + ')' : '') + '</td><td class="pt-2 text-right font-extrabold text-brand-700 money">' + fmtMoney(order.total) + '</td></tr>' +
          '</tbody></table>' +
        '</div>' +
      '</div>' +
      (sale ? '<div class="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3.5 text-[12.5px] text-slate-600"><span>Comprobante de la venta</span><button class="btn btn-outline btn-sm" onclick="openReceipt(' + sale.id + ')">' + icon('printer','w-3.5 h-3.5') + ' ' + escapeHtml(receiptBySaleId(sale.id) ? receiptBySaleId(sale.id).code : sale.code) + '</button></div>' : '') +
    '</div>' +
    '<div class="modal-foot"><button class="btn btn-outline" onclick="closeModal()">Cerrar</button>' +
    (hasPerm('orders.advance') && order.state !== 'Entregado' ? '<button class="btn btn-primary" onclick="nextOrder(' + order.id + ', true)">' + icon('arrowright','w-4 h-4') + ' Avanzar estado</button>' : '') + '</div>',
    { maxWidth:'620px' });
}
function nextOrder(orderId, fromModal){                      /* Avanzar estado: Preparando → Enviado → Entregado */
  if(!requirePerm('orders.advance')) return;
  const order = orderById(orderId);
  if(!order || order.state === 'Entregado') return;
  const idx = ORDER_STATES.indexOf(order.state);
  const next = ORDER_STATES[idx + 1];
  order.state = next;
  order.history = order.history || [];
  order.history.push({ state:next, at:new Date().toISOString(), by:session.fullName });
  audit('Cambio de estado de pedido', order.code + ' → ' + next + ' (venta ' + saleById(order.saleId).code + ')');
  save();
  renderAll();
  toast('success', 'Pedido ' + order.code + ' avanzó a «' + next + '».');
  if(fromModal){ closeModal(); openOrderDetail(orderId); }
}

/* ============ DEVOLUCIONES (HU-28, HU-30, RN-14..RN-26) ============ */
function openReturnForm(){
  if(!requirePerm('returns.create')) return;
  RETURN_CTX = { saleId:null };
  openModal(modalHead('Registrar devolución', 'Localiza la venta mediante el comprobante y registra la solicitud (HU-28 · RN-14)') +
    '<div class="modal-body">' +
      '<div id="rfErrors" class="hidden err-box mb-4"></div>' +
      '<label class="label" for="rfSale">Código de venta / comprobante *</label>' +
      '<div class="flex gap-2 mb-3">' +
        '<input class="input font-mono flex-1" id="rfSale" placeholder="V-0001" onkeydown="if(event.key===\'Enter\'){event.preventDefault(); findSaleForReturn();}" />' +
        '<button class="btn btn-primary" onclick="findSaleForReturn()">' + icon('search','w-4 h-4') + ' Buscar venta</button>' +
      '</div>' +
      '<div id="rfSaleInfo" class="mb-4"></div>' +
      '<div id="rfForm" class="hidden space-y-4">' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
          '<div><label class="label" for="rfProduct">Producto a devolver *</label><select class="select" id="rfProduct"></select></div>' +
          '<div><label class="label" for="rfQty">Cantidad *</label><input class="input" id="rfQty" type="number" min="1" step="1" value="1" /></div>' +
          '<div><label class="label" for="rfReason">Motivo *</label><select class="select" id="rfReason">' +
            '<option>Talla o tallaje incorrecto</option><option>Producto defectuoso</option><option>No conforme con el producto</option><option>Producto equivocado</option><option>Otro motivo</option></select></div>' +
          '<div><label class="label" for="rfState">Estado del producto *</label><select class="select" id="rfState">' +
            '<option>Sellado / nuevo</option><option>Usado en buen estado</option><option>Dañado</option></select></div>' +
        '</div>' +
        '<p class="hint">' + icon('info','w-3.5 h-3.5 inline') + ' La solicitud se registra como <b>Pendiente</b>; Atención al Cliente la evalúa verificando plazo, origen y condiciones (HU-28).</p>' +
      '</div>' +
    '</div>' +
    '<div class="modal-foot"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn btn-primary" onclick="registerReturn()">' + icon('rotate','w-4 h-4') + ' Registrar solicitud</button></div>');
}
function saleInfoCard(sale, ctxPrefix){
  const details = saleDetailsOf(sale.id);
  const pay = paymentBySaleId(sale.id);
  const order = orderBySaleId(sale.id);
  const days = Math.floor((Date.now() - new Date(sale.at).getTime()) / 86400000);
  const okPlazo = days <= RETURN_MAX_DAYS;
  return '<div class="rounded-xl border border-teal-100 bg-teal-50/60 p-4 space-y-2">' +
    '<div class="flex items-center justify-between flex-wrap gap-2">' +
      '<div class="text-[13px] text-slate-700"><b>' + escapeHtml(sale.code) + '</b> · ' + escapeHtml(clientById(sale.clientId).name) + ' · ' + fmtDate(sale.at) + '</div>' +
      '<div class="text-[14px] font-extrabold text-brand-700 money">' + fmtMoney(sale.total) + '</div>' +
    '</div>' +
    '<div class="text-[12px] text-slate-600">' + details.map(dt => dt.qty + '× ' + escapeHtml(dt.name)).join(' · ') + '</div>' +
    '<div class="flex items-center gap-2 flex-wrap pt-1">' +
      (pay ? paymentBadge(pay.method) : '') + (order ? orderStateBadge(order.state) : '') +
      '<span class="badge ' + (okPlazo ? 'b-green' : 'b-red') + '">' + icon('clock','w-3 h-3') + (okPlazo ? 'Dentro del plazo (' + days + ' d)' : 'Fuera del plazo (' + days + ' d > ' + RETURN_MAX_DAYS + ')') + '</span>' +
    '</div></div>';
}
function findSaleForReturn(){
  const code = document.getElementById('rfSale').value.trim();
  const sale = saleByCode(code);
  const box = document.getElementById('rfSaleInfo');
  if(!sale){
    RETURN_CTX.saleId = null;
    document.getElementById('rfForm').classList.add('hidden');
    box.innerHTML = '<div class="err-box flex items-start gap-2.5"><span class="mt-0.5 text-rose-600">' + icon('alert','w-4 h-4') + '</span>' +
      '<span>Venta inexistente (EX-09). Ingresa un código de venta válido, por ejemplo <b>V-0001</b>.</span></div>';
    return;
  }
  RETURN_CTX.saleId = sale.id;
  box.innerHTML = saleInfoCard(sale);
  const sel = document.getElementById('rfProduct');
  sel.innerHTML = saleDetailsOf(sale.id).map(dt =>
    '<option value="' + dt.productId + '">' + escapeHtml(dt.name + ' — vendido ' + dt.qty + ' u. (' + ((productById(dt.productId)||{}).origin || '—') + ')') + '</option>').join('');
  document.getElementById('rfForm').classList.remove('hidden');
}
function registerReturn(){
  const errors = [];
  if(!RETURN_CTX.saleId) errors.push('Localiza primero una venta válida (EX-09).');
  const sale = RETURN_CTX.saleId ? saleById(RETURN_CTX.saleId) : null;
  const productId = RETURN_CTX.saleId ? parseInt(document.getElementById('rfProduct').value, 10) : null;
  const qty = RETURN_CTX.saleId ? parseInt(document.getElementById('rfQty').value, 10) : NaN;
  const reason = RETURN_CTX.saleId ? document.getElementById('rfReason').value : '';
  const state = RETURN_CTX.saleId ? document.getElementById('rfState').value : '';
  const detail = RETURN_CTX.saleId ? saleDetailsOf(sale.id).find(dt => dt.productId === productId) : null;
  if(sale && !detail) errors.push('Selecciona un producto que pertenezca a la venta (HU-28).');
  if(sale && detail && (isNaN(qty) || qty < 1 || qty > detail.qty)) errors.push('La cantidad debe estar entre 1 y ' + (detail ? detail.qty : 0) + ' unidad(es) vendidas.');
  if(errors.length){
    const box = document.getElementById('rfErrors');
    box.innerHTML = errors.map(e => '<div>• ' + escapeHtml(e) + '</div>').join('');
    box.classList.remove('hidden');
    return;
  }
  const id = nextId(DB.returnRequests);
  DB.returnRequests.push({ id, code:'DEV-' + pad4(id), saleId:sale.id, productId, productName:detail.name, qty,
    reason, productState:state, status:'Pendiente', registeredAt:new Date().toISOString(), registeredBy:session.fullName,
    decidedAt:null, decidedBy:null, refundMethod:null, restocked:false, motive:null });
  audit('Devolución registrada', 'DEV-' + pad4(id) + ' · ' + sale.code + ' · ' + detail.name + ' ×' + qty + ' · motivo: ' + reason);
  save(); closeModal(); renderAll();
  toast('success', 'Solicitud DEV-' + pad4(id) + ' registrada como Pendiente. Atención al Cliente la evaluará.');
}

/* ============ CAMBIOS (HU-29, HU-30) ============ */
function openChangeForm(){
  if(!requirePerm('returns.create')) return;
  CHANGE_CTX = { saleId:null };
  openModal(modalHead('Registrar cambio', 'Verifica la compra original y selecciona el producto de reemplazo (HU-29)') +
    '<div class="modal-body">' +
      '<div id="chfErrors" class="hidden err-box mb-4"></div>' +
      '<label class="label" for="chfSale">Código de venta / comprobante *</label>' +
      '<div class="flex gap-2 mb-3">' +
        '<input class="input font-mono flex-1" id="chfSale" placeholder="V-0001" onkeydown="if(event.key===\'Enter\'){event.preventDefault(); findSaleForChange();}" />' +
        '<button class="btn btn-primary" onclick="findSaleForChange()">' + icon('search','w-4 h-4') + ' Buscar venta</button>' +
      '</div>' +
      '<div id="chfSaleInfo" class="mb-4"></div>' +
      '<div id="chfForm" class="hidden space-y-4">' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
          '<div><label class="label" for="chfProduct">Producto original *</label><select class="select" id="chfProduct"></select></div>' +
          '<div><label class="label" for="chfQty">Cantidad *</label><input class="input" id="chfQty" type="number" min="1" step="1" value="1" /></div>' +
          '<div><label class="label" for="chfNewProduct">Producto de reemplazo *</label><select class="select" id="chfNewProduct"></select></div>' +
          '<div><label class="label" for="chfState">Estado del producto original *</label><select class="select" id="chfState">' +
            '<option>Sellado / nuevo</option><option>Usado en buen estado</option><option>Dañado</option></select></div>' +
        '</div>' +
        '<div><label class="label" for="chfReason">Motivo del cambio *</label><input class="input" id="chfReason" placeholder="Ej. Cambio de talla, cambio de modelo…" /></div>' +
        '<p class="hint">' + icon('info','w-3.5 h-3.5 inline') + ' Al aprobarse, se registran el reingreso del original y la salida del reemplazo en el inventario (HU-30).</p>' +
      '</div>' +
    '</div>' +
    '<div class="modal-foot"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn btn-primary" onclick="registerChange()">' + icon('repeat','w-4 h-4') + ' Registrar solicitud</button></div>');
}
function findSaleForChange(){
  const code = document.getElementById('chfSale').value.trim();
  const sale = saleByCode(code);
  const box = document.getElementById('chfSaleInfo');
  if(!sale){
    CHANGE_CTX.saleId = null;
    document.getElementById('chfForm').classList.add('hidden');
    box.innerHTML = '<div class="err-box flex items-start gap-2.5"><span class="mt-0.5 text-rose-600">' + icon('alert','w-4 h-4') + '</span>' +
      '<span>Venta inexistente (EX-09). Ingresa un código de venta válido, por ejemplo <b>V-0001</b>.</span></div>';
    return;
  }
  CHANGE_CTX.saleId = sale.id;
  box.innerHTML = saleInfoCard(sale);
  const details = saleDetailsOf(sale.id);
  document.getElementById('chfProduct').innerHTML = details.map(dt =>
    '<option value="' + dt.productId + '">' + escapeHtml(dt.name + ' — compró ' + dt.qty + ' u.') + '</option>').join('');
  document.getElementById('chfNewProduct').innerHTML = DB.products
    .filter(p => p.stock > 0)
    .map(p => '<option value="' + p.id + '">' + escapeHtml(p.name + ' — stock ' + p.stock + ' (' + fmtMoney(p.price) + ')') + '</option>').join('');
  document.getElementById('chfForm').classList.remove('hidden');
}
function registerChange(){
  const errors = [];
  if(!CHANGE_CTX.saleId) errors.push('Localiza primero una venta válida (EX-09).');
  const sale = CHANGE_CTX.saleId ? saleById(CHANGE_CTX.saleId) : null;
  const productId = CHANGE_CTX.saleId ? parseInt(document.getElementById('chfProduct').value, 10) : null;
  const newProductId = CHANGE_CTX.saleId ? parseInt(document.getElementById('chfNewProduct').value, 10) : null;
  const qty = CHANGE_CTX.saleId ? parseInt(document.getElementById('chfQty').value, 10) : NaN;
  const state = CHANGE_CTX.saleId ? document.getElementById('chfState').value : '';
  const reason = CHANGE_CTX.saleId ? document.getElementById('chfReason').value.trim() : '';
  const detail = sale ? saleDetailsOf(sale.id).find(dt => dt.productId === productId) : null;
  const newProduct = newProductId ? productById(newProductId) : null;
  if(sale && !detail) errors.push('Selecciona el producto original de la venta.');
  if(sale && detail && (isNaN(qty) || qty < 1 || qty > detail.qty)) errors.push('La cantidad debe estar entre 1 y ' + (detail ? detail.qty : 0) + '.');
  if(!newProduct) errors.push('Selecciona el producto de reemplazo (con disponibilidad).');
  if(newProduct && !isNaN(qty) && newProduct.stock < qty) errors.push('El producto de reemplazo no tiene stock suficiente (' + newProduct.stock + ' disponibles).');
  if(!reason) errors.push('El motivo del cambio es obligatorio.');
  if(errors.length){
    const box = document.getElementById('chfErrors');
    box.innerHTML = errors.map(e => '<div>• ' + escapeHtml(e) + '</div>').join('');
    box.classList.remove('hidden');
    return;
  }
  const id = nextId(DB.changeRequests);
  DB.changeRequests.push({ id, code:'CAM-' + pad4(id), saleId:sale.id, originalProductId:productId, originalProductName:detail.name,
    newProductId:newProduct.id, newProductName:newProduct.name, qty, reason, productState:state, status:'Pendiente',
    registeredAt:new Date().toISOString(), registeredBy:session.fullName, decidedAt:null, decidedBy:null, motive:null });
  audit('Cambio registrado', 'CAM-' + pad4(id) + ' · ' + sale.code + ' · ' + detail.name + ' → ' + newProduct.name);
  save(); closeModal(); renderAll();
  toast('success', 'Solicitud CAM-' + pad4(id) + ' registrada como Pendiente para su evaluación.');
}

/* ============ EVALUACIÓN DE SOLICITUDES (HU-28, HU-29, HU-30, RN-15..RN-26) ============ */
function checkLine(ok, label, motive){
  return '<div class="check-line">' +
    '<span class="w-5 h-5 rounded-full grid place-items-center flex-shrink-0 ' + (ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600') + '">' + icon(ok ? 'check' : 'x','w-3 h-3') + '</span>' +
    '<div><span class="' + (ok ? 'text-slate-700 font-medium' : 'text-rose-700 font-semibold') + '">' + label + '</span>' +
    (!ok && motive ? '<div class="text-[11.5px] text-rose-500 mt-0.5">' + escapeHtml(motive) + '</div>' : '') + '</div></div>';
}
function evaluateChecks(type, req){
  const sale = saleById(req.saleId);
  const product = type === 'return' ? productById(req.productId) : productById(req.originalProductId);
  const days = Math.floor((Date.now() - new Date(sale.at).getTime()) / 86400000);
  const okPlazo = days <= RETURN_MAX_DAYS;
  const okOrigin = product && (product.origin === 'SAGABELLA' || product.origin === 'SAGABELLA');
  const okState = req.productState !== 'Dañado';
  const newProduct = type === 'change' ? productById(req.newProductId) : null;
  const okStock = type === 'change' ? (newProduct && newProduct.stock >= req.qty) : true;
  const motives = [];
  if(!okPlazo)  motives.push('Fuera del plazo de ' + RETURN_MAX_DAYS + ' días (RN-20).');
  if(!okOrigin) motives.push('Producto vendido por otro vendedor (OTRO): aplica la política del vendedor (RN-23).');
  if(!okState)  motives.push('El producto presenta daños y no admite cambio/devolución (RN-22).');
  if(!okStock)  motives.push('El producto de reemplazo no tiene stock suficiente.');
  return { ok: okPlazo && okOrigin && okState && okStock, okPlazo, okOrigin, okState, okStock, motives, sale, product, newProduct, days };
}
function openEvaluate(type, id){
  if(!requirePerm('returns.process')) return;
  const req = type === 'return' ? byId(DB.returnRequests, id) : byId(DB.changeRequests, id);
  if(!req || req.status !== 'Pendiente') return;
  EVALUATE_CTX = { type, id };
  const checks = evaluateChecks(type, req);
  const sale = checks.sale;

  let form = '';
  if(checks.ok){
    if(type === 'return'){
      const pay = paymentBySaleId(sale.id);
      form =
        '<div class="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 mb-4 space-y-3">' +
          '<div class="text-[13px] font-bold text-emerald-800 mb-1">' + icon('check','w-4 h-4 inline') + ' La solicitud cumple las condiciones (RN-15)</div>' +
          '<div><label class="label">Medio de reembolso (RN-24 · RN-25)</label>' +
          '<input class="input" disabled value="' + (pay ? pay.method + ' — el reembolso se asocia al medio de pago de la compra' : '—') + '" /></div>' +
          '<div><label class="label" for="evRestock">¿Reincorporar el producto al stock? (RN-26 · EX-11)</label>' +
          '<select class="select" id="evRestock"><option value="si">Sí — producto apto para reingreso</option><option value="no">No — registrar sin aumentar stock</option></select></div>' +
        '</div>';
    }else{
      form =
        '<div class="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 mb-4">' +
          '<div class="text-[13px] font-bold text-emerald-800 mb-2">' + icon('check','w-4 h-4 inline') + ' El cambio cumple las condiciones</div>' +
          '<div class="text-[12.5px] text-slate-600 space-y-1">' +
            '<div>• Reingreso al inventario: <b>' + escapeHtml(checks.product.name) + ' +' + req.qty + '</b> (original)</div>' +
            '<div>• Salida del inventario: <b>' + escapeHtml(checks.newProduct.name) + ' −' + req.qty + '</b> (reemplazo)</div>' +
          '</div>' +
          '<p class="hint mt-2">En el cambio se registran el reingreso del original y la salida/entrega del reemplazo (HU-30).</p>' +
        '</div>';
    }
  }else{
    form =
      '<div class="rounded-xl border border-rose-100 bg-rose-50/70 p-4 mb-4">' +
        '<div class="text-[13px] font-bold text-rose-800 mb-1">' + icon('x','w-4 h-4 inline') + ' La solicitud NO cumple las condiciones</div>' +
        '<div class="text-[12.5px] text-rose-700 space-y-1">' + checks.motives.map(m => '<div>• ' + escapeHtml(m) + '</div>').join('') + '</div>' +
      '</div>' +
      '<div><label class="label" for="evMotive">Motivo del rechazo *</label>' +
      '<select class="select" id="evMotive">' + checks.motives.map(m => '<option>' + escapeHtml(m) + '</option>').join('') + '</select></div>';
  }

  openModal(modalHead('Evaluar ' + (type === 'return' ? 'devolución ' : 'cambio ') + escapeHtml(req.code),
      'Validación automática de política — plazo, origen, estado y disponibilidad (HU-28 · HU-29)') +
    '<div class="modal-body">' +
      '<div class="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4 text-[12.5px] text-slate-600">' +
        '<b>' + escapeHtml(sale.code) + '</b> · ' + escapeHtml(clientById(sale.clientId).name) + ' · ' +
        (type === 'return' ? escapeHtml(req.productName) + ' ×' + req.qty : escapeHtml(req.originalProductName) + ' → ' + escapeHtml(req.newProductName)) + ' · ' + escapeHtml(req.reason) +
      '</div>' +
      '<h4 class="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-1">Verificaciones del sistema</h4>' +
      '<div class="mb-4">' +
        checkLine(!!sale, 'Venta registrada en el sistema (RN-14 · RN-19)', 'La solicitud debe estar asociada a una venta existente.') +
        checkLine(checks.okPlazo, 'Dentro del plazo de ' + RETURN_MAX_DAYS + ' días (' + checks.days + ' días transcurridos)', 'RN-20: plazo según tipo de producto.') +
        checkLine(checks.okOrigin, 'Producto vendido por Sagabella', 'RN-23: el procedimiento varía según el vendedor.') +
        checkLine(checks.okState, 'Producto apto (estado: ' + escapeHtml(req.productState || '—') + ')', 'RN-21 · RN-22.') +
        (type === 'change' ? checkLine(checks.okStock, 'Disponibilidad del producto de reemplazo (' + (checks.newProduct ? checks.newProduct.stock : 0) + ' en stock)', 'HU-29.') : '') +
      '</div>' + form +
    '</div>' +
    '<div class="modal-foot"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button>' +
      (checks.ok
        ? '<button class="btn btn-primary" onclick="processEvaluate(\'approve\')">' + icon('check','w-4 h-4') + ' Aprobar solicitud</button>'
        : '<button class="btn btn-danger" onclick="processEvaluate(\'reject\')">' + icon('x','w-4 h-4') + ' Rechazar solicitud</button>') +
    '</div>', { maxWidth:'620px' });
}
function processEvaluate(decision){
  if(!EVALUATE_CTX) return;
  const type = EVALUATE_CTX.type;
  const req = type === 'return' ? byId(DB.returnRequests, EVALUATE_CTX.id) : byId(DB.changeRequests, EVALUATE_CTX.id);
  if(!req) return;
  const checks = evaluateChecks(type, req);
  if(decision === 'approve'){
    if(type === 'return'){
      const pay = paymentBySaleId(req.saleId);
      const restock = (document.getElementById('evRestock')||{}).value === 'si';
      req.status = 'Aprobada';
      req.refundMethod = pay ? pay.method : 'Efectivo';
      req.restocked = restock;
      req.decidedAt = new Date().toISOString();
      req.decidedBy = session.fullName;
      if(restock){
        const product = checks.product;
        const prev = product.stock;
        product.stock += req.qty;
        updateStockAlerts(product);
        DB.inventoryAdjustments.push({ id:nextId(DB.inventoryAdjustments), productId:product.id, code:product.code, type:'Entrada',
          qty:req.qty, previousStock:prev, newStock:product.stock, reason:'Reingreso por devolución ' + req.code,
          user:session.fullName, at:new Date().toISOString() });
      }
      audit('Devolución aprobada', req.code + ' · ' + saleById(req.saleId).code + ' · reembolso ' + req.refundMethod + ' · ' + (restock ? 'reingresó al stock' : 'sin reingreso (RN-26)'));
      toast('success', req.code + ' aprobada. Reembolso por ' + req.refundMethod + (restock ? ' y stock actualizado.' : ' (sin reingreso, EX-11).'));
    }else{
      req.status = 'Aprobada';
      req.decidedAt = new Date().toISOString();
      req.decidedBy = session.fullName;
      const orig = checks.product, repl = checks.newProduct;
      const prevOrig = orig.stock, prevRepl = repl.stock;
      orig.stock += req.qty;                                  /* reingreso del original */
      repl.stock -= req.qty;                                  /* salida del reemplazo */
      updateStockAlerts(orig); updateStockAlerts(repl);
      DB.inventoryAdjustments.push({ id:nextId(DB.inventoryAdjustments), productId:orig.id, code:orig.code, type:'Entrada',
        qty:req.qty, previousStock:prevOrig, newStock:orig.stock, reason:'Reingreso por cambio ' + req.code, user:session.fullName, at:new Date().toISOString() });
      DB.inventoryAdjustments.push({ id:nextId(DB.inventoryAdjustments), productId:repl.id, code:repl.code, type:'Salida',
        qty:req.qty, previousStock:prevRepl, newStock:repl.stock, reason:'Entrega de reemplazo ' + req.code, user:session.fullName, at:new Date().toISOString() });
      audit('Cambio aprobado', req.code + ' · ' + orig.name + ' +' + req.qty + ' / ' + repl.name + ' −' + req.qty);
      toast('success', req.code + ' aprobada. Inventario actualizado por el cambio.');
    }
  }else{
    const motive = (document.getElementById('evMotive')||{}).value || (checks.motives[0] || 'No cumple las condiciones de la política.');
    req.status = 'Rechazada';
    req.motive = motive;
    req.decidedAt = new Date().toISOString();
    req.decidedBy = session.fullName;
    if(type === 'return'){
      audit('Devolución rechazada', req.code + ' · ' + motive);
      toast('warning', req.code + ' rechazada: ' + motive);
    }else{
      audit('Cambio rechazado', req.code + ' · ' + motive);
      toast('warning', req.code + ' rechazada: ' + motive);
    }
  }
  save(); closeModal(); renderAll();
}
function openRequestDetail(type, id){
  const req = type === 'return' ? byId(DB.returnRequests, id) : byId(DB.changeRequests, id);
  if(!req) return;
  const sale = saleById(req.saleId);
  let body = '<div class="space-y-3 text-[13px] text-slate-600">' +
    '<div class="grid grid-cols-2 gap-3">' +
      '<div class="rounded-xl border border-slate-200 p-3.5"><div class="text-[11px] text-slate-400 uppercase font-semibold mb-1">Solicitud</div><div class="font-bold text-brand-700">' + escapeHtml(req.code) + '</div></div>' +
      '<div class="rounded-xl border border-slate-200 p-3.5"><div class="text-[11px] text-slate-400 uppercase font-semibold mb-1">Estado</div>' + requestStatusBadge(req.status) + '</div>' +
      '<div class="rounded-xl border border-slate-200 p-3.5"><div class="text-[11px] text-slate-400 uppercase font-semibold mb-1">Venta</div><div class="font-semibold">' + escapeHtml(sale ? sale.code : '—') + ' · ' + (sale ? fmtDate(sale.at) : '') + '</div></div>' +
      '<div class="rounded-xl border border-slate-200 p-3.5"><div class="text-[11px] text-slate-400 uppercase font-semibold mb-1">Registrada por</div><div class="font-semibold">' + escapeHtml(req.registeredBy) + '<div class="text-[11px] text-slate-400 font-normal">' + fmtDateTime(req.registeredAt) + '</div></div></div>' +
    '</div>' +
    '<div class="rounded-xl border border-slate-200 p-3.5"><div class="text-[11px] text-slate-400 uppercase font-semibold mb-1">Motivo declarado</div><div>' + escapeHtml(req.reason) + '</div>' +
    (type === 'return' ? '<div class="mt-1 text-[12px] text-slate-500">Estado del producto: ' + escapeHtml(req.productState) + ' · cantidad: ' + req.qty + '</div>' : '<div class="mt-1 text-[12px] text-slate-500">Cantidad: ' + req.qty + ' · reemplazo: ' + escapeHtml(req.newProductName || '—') + '</div>') + '</div>';
  if(req.motive) body += '<div class="rounded-xl border border-rose-100 bg-rose-50/70 p-3.5 text-[12.5px] text-rose-700"><b>Motivo del rechazo:</b> ' + escapeHtml(req.motive) + '</div>';
  if(req.status === 'Aprobada'){
    body += '<div class="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-[12.5px] text-emerald-800"><b>Solicitud aprobada</b> por ' + escapeHtml(req.decidedBy) + ' · ' + fmtDateTime(req.decidedAt) +
      (type === 'return' ? ' · Reembolso: ' + escapeHtml(req.refundMethod||'—') + ' · ' + (req.restocked ? 'producto reincorporado al stock' : 'sin reingreso al stock (RN-26)') : '') + '</div>';
  }
  body += '</div>';
  openModal(modalHead('Detalle de ' + (type === 'return' ? 'devolución' : 'cambio'), escapeHtml(req.code) + ' · ' + (sale ? escapeHtml(sale.code) : '')) +
    '<div class="modal-body">' + body + '</div>' +
    '<div class="modal-foot">' +
      (req.status === 'Pendiente' && hasPerm('returns.process') ? '<button class="btn btn-primary" onclick="openEvaluate(\'' + type + '\',' + req.id + ')">' + icon('check','w-4 h-4') + ' Evaluar ahora</button>' : '') +
      '<button class="btn btn-outline" onclick="closeModal()">Cerrar</button></div>',
    { maxWidth:'560px' });
}

/* ============ ASIGNACIÓN DE ROLES (HU-02) ============ */
function openRoleForm(userId){
  if(!requirePerm('users.assign')) return;
  const u = userById(userId);
  const role = roleById(u.roleId);
  openModal(modalHead('Asignar rol', 'Los permisos del usuario cambian según el rol asignado (HU-02 · RN-02)') +
    '<div class="modal-body">' +
      '<div class="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4">' +
        '<div class="avatar w-11 h-11 text-[14px]">' + initials(u.fullName) + '</div>' +
        '<div><div class="font-bold text-slate-900">' + escapeHtml(u.fullName) + '</div>' +
        '<div class="text-[12px] text-slate-500 font-mono">' + escapeHtml(u.username) + ' · rol actual: ' + escapeHtml(role.name) + '</div></div>' +
      '</div>' +
      '<label class="label" for="roleSel">Nuevo rol</label>' +
      '<select class="select" id="roleSel">' +
        DB.roles.map(r => '<option value="' + r.id + '"' + (r.id === u.roleId ? ' selected' : '') + '>' + escapeHtml(r.name) + ' — ' + DB.rolePermissions.filter(rp => rp.roleId === r.id).length + ' permisos</option>').join('') +
      '</select>' +
      '<p class="hint mt-3">' + icon('info','w-3.5 h-3.5 inline') + ' El cambio queda registrado en la auditoría (HU-02). El usuario verá los módulos autorizados al volver a iniciar sesión.</p>' +
    '</div>' +
    '<div class="modal-foot"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn btn-primary" onclick="assignRole(' + u.id + ')">' + icon('usercheck','w-4 h-4') + ' Guardar rol</button></div>');
}
function assignRole(userId){
  const u = userById(userId);
  const roleSel = document.getElementById('roleSel');
  if(!u || !roleSel){ closeModal(); return; }
  const newRoleId = parseInt(roleSel.value, 10);
  const oldRole = roleById(u.roleId);
  const newRole = roleById(newRoleId);
  if(!oldRole || !newRole || newRoleId === u.roleId){ toast('info', 'El rol seleccionado es el mismo que ya tiene el usuario.'); closeModal(); return; }
  u.roleId = newRoleId;
  if(session && session.userId === u.id){ session.roleId = newRoleId; session.roleName = newRole.name; }
  audit('Rol asignado', u.username + ' (' + u.fullName + '): ' + oldRole.name + ' → ' + newRole.name);
  save(); closeModal(); renderAll();
  toast('success', 'Rol de ' + u.fullName + ' actualizado a «' + newRole.name + '».');
}

/* ============ RESTABLECER DEMO ============ */
function confirmReset(){
  openModal(modalHead('Restablecer demo', 'Se restaurarán los datos demo iniciales') +
    '<div class="modal-body">' +
      '<div class="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/80 p-4">' +
        '<span class="text-amber-600 mt-0.5">' + icon('alert','w-5 h-5') + '</span>' +
        '<div class="text-[13px] text-slate-700 leading-relaxed">Se eliminarán <b>todos los cambios</b> realizados (clientes, productos, ventas, pedidos, solicitudes, ajustes y auditoría) y se recuperarán los <b>datos demo iniciales</b>.<br><span class="text-[12px] text-slate-500">Esta acción no se puede deshacer. Tu sesión permanecerá activa.</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-foot"><button class="btn btn-outline" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn btn-danger" onclick="doReset()">' + icon('refresh','w-4 h-4') + ' Sí, restablecer demo</button></div>',
    { maxWidth:'470px' });
}
function doReset(){
  DB = seedState();
  save();
  if(session){
    const u = DB.users.find(x => x.username === session.username);
    if(u){ session.roleId = u.roleId; session.roleName = roleById(u.roleId).name; }
  }
  audit('Sistema restablecido', 'Datos restaurados a la demo inicial por ' + (session ? session.username : 'usuario'));
  currentView = 'dashboard';
  UI.clientSearch = ''; UI.productSearch = ''; UI.productCategory = ''; UI.salesSearch = '';
  UI.orderSearch = ''; UI.returnsTab = 'returns'; UI.reportTab = 'bySeller'; UI.reportFrom = '';
  UI.reportTo = ''; UI.reportSeller = ''; UI.stockSearch = ''; UI.stockCategory = ''; UI.auditSearch = ''; UI.auditFilter = '';
  closeModal();
  renderAll();
  toast('success', 'Datos demo restablecidos: la interfaz se actualizó con la información inicial.');
}
