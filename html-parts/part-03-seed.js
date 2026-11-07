<script>
'use strict';
/* =====================================================================================================
   SISTEMA DE VENTAS SAGABELLA — Demo académica (un solo archivo HTML)
   Fuente: TEC_INF_II_COMAS_GRUPO-4_SISTEMA-DE-VENTAS-SAGABELLA_V3.10_CHATBOT.docx
   Épicas: EP-01..EP-09 · Historias de Usuario: HU-01..HU-36 · Reglas de negocio: RN-01..RN-27
   Excepciones: EX-01..EX-14
   ===================================================================================================== */

/* ============ Iconos SVG (estilo Lucide, stroke) ============ */
const ICONS = {
  dashboard:'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  usercheck:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
  package:'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  cart:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  truck:'<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-3.35a1 1 0 0 0-.68-.28H15"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  chart:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  tag:'<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
  bot:'<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  history:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus:'<path d="M5 12h14"/>',
  pencil:'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  printer:'<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect width="12" height="8" x="6" y="14" rx="1"/>',
  send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 21H3v-5"/>',
  banknote:'<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
  card:'<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  phone:'<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  msg:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  calendar:'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  arrowright:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  chevright:'<path d="m9 18 6-6-6-6"/>',
  menu:'<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  wallet:'<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  rotate:'<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  percent:'<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  store:'<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.35a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>',
  filter:'<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>'
};
function icon(name, cls){ cls = cls || 'w-5 h-5'; return '<svg class="'+cls+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICONS[name]||'')+'</svg>'; }

/* ============ Constantes ============ */
const STORE_KEY = 'falabella_demo_v1';
const SESSION_KEY = 'falabella_session_user';
const ORDER_STATES = ['Preparando','Enviado','Entregado'];
const PAY_METHODS = ['Efectivo','Tarjeta','Yape/Plin'];
const RETURN_MAX_DAYS = 30;          // Plazo para devoluciones/cambios (RN-20)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ============ Estado global ============ */
let DB = null;            // "Base de datos" local (entidades del sistema)
let session = null;       // Usuario autenticado {userId, username, fullName, roleId, roleName}
let currentView = 'dashboard';
const UI = {              // Estado de filtros/búsquedas por vista
  clientSearch:'', productSearch:'', productCategory:'', salesSearch:'', orderSearch:'',
  returnsTab:'returns', reportTab:'bySeller', reportFrom:'', reportTo:'', reportSeller:'',
  stockSearch:'', stockCategory:'', auditSearch:'', auditFilter:''
};
let SALE = null;          // Carrito de la venta en curso
let CLIENT_EDIT = null;   // id del cliente en edición
let PRODUCT_EDIT = null;  // id del producto en edición
let ADJUST_PRODUCT = null;
let RETURN_CTX = { saleId:null };
let CHANGE_CTX = { saleId:null };
let EVALUATE_CTX = null;  // {type:'return'|'change', id}

/* =====================================================================================================
   DATOS DEMO (semilla) — se generan con fechas relativas para que la demo siempre se vea vigente
   Entidades: roles, permissions, rolePermissions, users, clients, categories, products,
   promotions, promotionProducts, sales, saleDetails, salePromotions, payments, receipts, orders,
   returnRequests, changeRequests, inventoryAdjustments, stockAlerts, audits
   ===================================================================================================== */
function seedState(){
  const now = Date.now();
  const DAY = 86400000;
  const d  = (days, hours) => new Date(now - days*DAY - (hours||0)*3600000).toISOString();
  const df = (days) => new Date(now + days*DAY).toISOString();   // fecha futura

  const roles = [
    { id:1, name:'Administrador',           description:'Administra usuarios, roles y permisos; gestiona catálogo, promociones, reportes y auditoría del sistema.' },
    { id:2, name:'Vendedor',                description:'Registra ventas y consulta clientes, productos, pedidos y promociones vigentes.' },
    { id:3, name:'Encargado de inventario', description:'Controla el stock, registra ajustes de inventario y gestiona la reposición de productos.' },
    { id:4, name:'Atención al cliente',     description:'Gestiona pedidos, solicitudes de cambio y devolución, y atiende consultas con el chatbot.' }
  ];

  const P = (id, code, name, module) => ({ id, code, name, module });
  const permissions = [
    P(1,'dashboard.view','Ver panel general','Panel'),
    P(2,'clients.view','Ver clientes','Clientes'),
    P(3,'clients.create','Registrar clientes','Clientes'),
    P(4,'clients.edit','Editar clientes','Clientes'),
    P(5,'clients.history','Consultar historial de compras','Clientes'),
    P(6,'products.view','Ver productos','Productos'),
    P(7,'products.create','Registrar productos','Productos'),
    P(8,'products.edit','Editar productos y precios','Productos'),
    P(9,'products.adjust','Ajustar inventario','Inventario'),
    P(10,'sales.view','Ver ventas','Ventas'),
    P(11,'sales.create','Registrar ventas','Ventas'),
    P(12,'orders.view','Ver pedidos','Pedidos'),
    P(13,'orders.advance','Avanzar estado de pedidos','Pedidos'),
    P(14,'reports.sales','Reportes de ventas','Reportes'),
    P(15,'reports.stock','Reportes de stock y reposición','Reportes'),
    P(16,'promotions.view','Ver promociones','Promociones'),
    P(17,'returns.view','Ver cambios y devoluciones','Postventa'),
    P(18,'returns.create','Registrar solicitudes de cambio/devolución','Postventa'),
    P(19,'returns.process','Evaluar y procesar solicitudes','Postventa'),
    P(20,'support.view','Atención al cliente (consulta de pedidos y chatbot)','Postventa'),
    P(21,'audit.view','Ver auditoría de operaciones','Administración'),
    P(22,'users.view','Ver usuarios y roles','Administración'),
    P(23,'users.assign','Asignar roles a usuarios','Administración')
  ];

  const rp = (roleId, codes) => codes.map(code => {
    const perm = permissions.find(p => p.code === code);
    return { roleId, permissionId: perm.id };
  });
  const rolePermissions = [].concat(
    rp(1, permissions.map(p => p.code)),                       // Administrador: todo
    rp(2, ['dashboard.view','clients.view','clients.create','clients.edit','clients.history','products.view',
           'sales.view','sales.create','orders.view','promotions.view','returns.view','returns.create','support.view']),
    rp(3, ['dashboard.view','products.view','products.create','products.edit','products.adjust',
           'orders.view','orders.advance','reports.stock','promotions.view']),
    rp(4, ['dashboard.view','clients.view','clients.history','products.view','sales.view',
           'orders.view','orders.advance','returns.view','returns.create','returns.process','support.view'])
  );

  const users = [
    { id:1, username:'admin',     password:'admin123', fullName:'María Fernández', roleId:1, active:true, createdAt:d(60) },
    { id:2, username:'vendedor',  password:'venta123', fullName:'Carlos Ramírez',  roleId:2, active:true, createdAt:d(60) },
    { id:3, username:'inventario',password:'inv123',   fullName:'Jorge Medina',    roleId:3, active:true, createdAt:d(60) },
    { id:4, username:'atencion',  password:'aten123',  fullName:'Lucía Castro',    roleId:4, active:true, createdAt:d(60) },
    { id:5, username:'rosa',      password:'rosa123',  fullName:'Rosa Vargas',     roleId:2, active:true, createdAt:d(45) }
  ];

  const clients = [
    { id:1, dni:'45871236', name:'Ana Torres',    email:'ana.torres@gmail.com',   phone:'987654321', createdAt:d(20) },
    { id:2, dni:'40219577', name:'Luis Mendoza',  email:'luis.mendoza@hotmail.com', phone:'912345678', createdAt:d(15) },
    { id:3, dni:'71203455', name:'Carmen Flores', email:'carmen.flores@outlook.com', phone:'945678123', createdAt:d(9) },
    { id:4, dni:'09456782', name:'Diego Salazar', email:'diego.salazar@gmail.com', phone:'956123478', createdAt:d(4) }
  ];

  const categories = [
    { id:1, name:'Tecnología' }, { id:2, name:'Hogar' }, { id:3, name:'Moda' },
    { id:4, name:'Deportes' },  { id:5, name:'Accesorios' }
  ];

  const products = [
    { id:1, code:'TEC-001', name:'Lenovo IdeaPad 3 15.6', categoryId:1, description:'Laptop Lenovo IdeaPad 3, AMD Ryzen 5, 8 GB RAM, SSD 512 GB, pantalla 15.6"', price:1899.00, stock:12, minStock:4,  origin:'SAGABELLA', createdAt:d(30) },
    { id:2, code:'TEC-002', name:'Audífonos Bluetooth JBL', categoryId:1, description:'Audífonos inalámbricos JBL Tune 520BT con 57 h de autonomía', price:129.90, stock:3,  minStock:5,  origin:'SAGABELLA', createdAt:d(30) },
    { id:3, code:'DEP-001', name:'Zapatillas deportivas Nike', categoryId:4, description:'Zapatillas Nike Revolution 6 para running', price:249.90, stock:18, minStock:6, origin:'SAGABELLA', createdAt:d(28) },
    { id:4, code:'MOD-001', name:'Camisa básica manga larga', categoryId:3, description:'Camisa básica de algodón, manga larga, diversos colores', price:59.90, stock:25, minStock:10, origin:'SAGABELLA', createdAt:d(25) },
    { id:5, code:'TEC-003', name:'Smart TV Samsung 50"', categoryId:1, description:'Smart TV Samsung 50" 4K UHD, modelo AU8000', price:1499.00, stock:0,  minStock:3,  origin:'SAGABELLA', createdAt:d(25) },
    { id:6, code:'HOG-001', name:'Olla arrocera Oster', categoryId:2, description:'Olla arrocera Oster de 1.8 L con función mantener caliente', price:139.90, stock:9,  minStock:3,  origin:'OTRO',     createdAt:d(22) },
    { id:7, code:'ACC-001', name:'Mochila escolar Everest', categoryId:5, description:'Mochila Everest con compartimento para laptop 15"', price:89.90,  stock:14, minStock:5, origin:'SAGABELLA', createdAt:d(20) },
    { id:8, code:'TEC-004', name:'Tablet Samsung Galaxy Tab A8', categoryId:1, description:'Tablet Samsung Galaxy Tab A8 10.5", 32 GB', price:749.00, stock:2,  minStock:3,  origin:'SAGABELLA', createdAt:d(18) }
  ];

  const promotions = [
    { id:1, code:'PROM-01', name:'10% en Tecnología',       description:'10% de descuento en productos de la categoría Tecnología',        type:'percent', value:10, scope:'category', categoryId:1, active:true, startDate:d(30), endDate:df(30) },
    { id:2, code:'PROM-02', name:'15% en Hogar (finalizado)', description:'15% de descuento en Hogar — campaña de temporada ya finalizada',  type:'percent', value:15, scope:'category', categoryId:2, active:true, startDate:d(60), endDate:d(31) },
    { id:3, code:'PROM-03', name:'10% en Camisa básica',     description:'10% de descuento aplicable al producto MOD-001',                 type:'percent', value:10, scope:'product',  productId:4,  active:true, startDate:d(15), endDate:df(20) }
  ];
  const promotionProducts = [ { promotionId:3, productId:4 } ];

  /* ---- Ventas confirmadas (con detalle, pagos, comprobantes y pedidos coherentes) ---- */
  const sales = [
    { id:1, code:'V-0001', clientId:1, userId:2, userName:'Carlos Ramírez', at:d(5), subtotal:2028.90, discount:202.89, total:1826.01, paymentId:1, status:'Confirmada' },
    { id:2, code:'V-0002', clientId:0, userId:2, userName:'Carlos Ramírez', at:d(3), subtotal:119.80,  discount:11.98,  total:107.82,  paymentId:2, status:'Confirmada' },
    { id:3, code:'V-0003', clientId:2, userId:2, userName:'Carlos Ramírez', at:d(1), subtotal:339.80,  discount:0,      total:339.80,  paymentId:3, status:'Confirmada' },
    { id:4, code:'V-0004', clientId:1, userId:5, userName:'Rosa Vargas',    at:d(0,2), subtotal:189.80, discount:18.98,  total:170.82,  paymentId:4, status:'Confirmada' }
  ];
  const saleDetails = [
    { id:1, saleId:1, productId:1, code:'TEC-001', name:'Lenovo IdeaPad 3 15.6',        qty:1, unitPrice:1899.00, subtotal:1899.00 },
    { id:2, saleId:1, productId:2, code:'TEC-002', name:'Audífonos Bluetooth JBL',      qty:1, unitPrice:129.90,  subtotal:129.90 },
    { id:3, saleId:2, productId:4, code:'MOD-001', name:'Camisa básica manga larga',    qty:2, unitPrice:59.90,   subtotal:119.80 },
    { id:4, saleId:3, productId:3, code:'DEP-001', name:'Zapatillas deportivas Nike',   qty:1, unitPrice:249.90,  subtotal:249.90 },
    { id:5, saleId:3, productId:7, code:'ACC-001', name:'Mochila escolar Everest',      qty:1, unitPrice:89.90,   subtotal:89.90 },
    { id:6, saleId:4, productId:2, code:'TEC-002', name:'Audífonos Bluetooth JBL',      qty:1, unitPrice:129.90,  subtotal:129.90 },
    { id:7, saleId:4, productId:4, code:'MOD-001', name:'Camisa básica manga larga',    qty:1, unitPrice:59.90,   subtotal:59.90 }
  ];
  const salePromotions = [
    { id:1, saleId:1, promotionId:1, code:'PROM-01', amount:202.89 },
    { id:2, saleId:2, promotionId:3, code:'PROM-03', amount:11.98 },
    { id:3, saleId:4, promotionId:1, code:'PROM-01', amount:12.99 },
    { id:4, saleId:4, promotionId:3, code:'PROM-03', amount:5.99 }
  ];
  const payments = [
    { id:1, saleId:1, method:'Tarjeta',  amount:1826.01, received:null, change:null, reference:'**** 4242', status:'Aprobado', at:d(5) },
    { id:2, saleId:2, method:'Efectivo', amount:107.82,  received:150.00, change:42.18, reference:null,     status:'Aprobado', at:d(3) },
    { id:3, saleId:3, method:'Yape/Plin',amount:339.80,  received:null, change:null, reference:'912 345 678', status:'Aprobado', at:d(1) },
    { id:4, saleId:4, method:'Tarjeta',  amount:170.82,  received:null, change:null, reference:'**** 1881', status:'Aprobado', at:d(0,2) }
  ];
  const receipts = [
    { id:1, code:'C-0001', saleId:1, issuedAt:d(5) },
    { id:2, code:'C-0002', saleId:2, issuedAt:d(3) },
    { id:3, code:'C-0003', saleId:3, issuedAt:d(1) },
    { id:4, code:'C-0004', saleId:4, issuedAt:d(0,2) }
  ];
  const orderItem = (saleId) => saleDetails.filter(dt => dt.saleId === saleId)
    .map(dt => ({ productId:dt.productId, code:dt.code, name:dt.name, qty:dt.qty, unitPrice:dt.unitPrice, subtotal:dt.subtotal }));
  const orders = [
    { id:1, code:'PD-0001', saleId:1, clientId:1, at:d(5), state:'Entregado', total:1826.01, items:orderItem(1), history:[{state:'Preparando',at:d(5),by:'Sistema'},{state:'Enviado',at:d(4),by:'Jorge Medina'},{state:'Entregado',at:d(2),by:'Jorge Medina'}] },
    { id:2, code:'PD-0002', saleId:2, clientId:0, at:d(3), state:'Enviado',   total:107.82,  items:orderItem(2), history:[{state:'Preparando',at:d(3),by:'Sistema'},{state:'Enviado',at:d(2,4),by:'Lucía Castro'}] },
    { id:3, code:'PD-0003', saleId:3, clientId:2, at:d(1), state:'Preparando',total:339.80,  items:orderItem(3), history:[{state:'Preparando',at:d(1),by:'Sistema'}] },
    { id:4, code:'PD-0004', saleId:4, clientId:1, at:d(0,2), state:'Preparando', total:170.82, items:orderItem(4), history:[{state:'Preparando',at:d(0,2),by:'Sistema'}] }
  ];

  /* ---- Postventa: devoluciones y cambios (HU-28, HU-29, HU-30) ---- */
  const returnRequests = [
    { id:1, code:'DEV-0001', saleId:2, productId:4, productName:'Camisa básica manga larga', qty:1,
      reason:'Talla incorrecta', productState:'Sellado / nuevo', status:'Aprobada',
      registeredAt:d(2), registeredBy:'Lucía Castro', decidedAt:d(2,2), decidedBy:'Lucía Castro',
      refundMethod:'Efectivo', restocked:true, motive:null },
    { id:2, code:'DEV-0002', saleId:3, productId:3, productName:'Zapatillas deportivas Nike', qty:1,
      reason:'Producto defectuoso', productState:'Dañado', status:'Rechazada',
      registeredAt:d(0,5), registeredBy:'Lucía Castro', decidedAt:d(0,4), decidedBy:'Lucía Castro',
      refundMethod:null, restocked:false, motive:'El producto presenta daños y no cumple las condiciones de la política de devoluciones (RN-22).' }
  ];
  const changeRequests = [
    { id:1, code:'CAM-0001', saleId:1, originalProductId:2, originalProductName:'Audífonos Bluetooth JBL',
      newProductId:7, newProductName:'Mochila escolar Everest', qty:1, reason:'Cambio por otro modelo', productState:'Usado en buen estado',
      status:'Aprobada', registeredAt:d(1,10), registeredBy:'Lucía Castro', decidedAt:d(1,8), decidedBy:'Lucía Castro', motive:null },
    { id:2, code:'CAM-0002', saleId:4, originalProductId:4, originalProductName:'Camisa básica manga larga',
      newProductId:7, newProductName:'Mochila escolar Everest', qty:1, reason:'Cambio de talla', productState:'Sellado / nuevo',
      status:'Pendiente', registeredAt:d(0,1), registeredBy:'Lucía Castro', decidedAt:null, decidedBy:null, motive:null }
  ];

  /* ---- Inventario (HU-13, HU-14, HU-15) ---- */
  const inventoryAdjustments = [
    { id:1, productId:2, code:'TEC-002', type:'Entrada', qty:4,  previousStock:0, newStock:4,  reason:'Ingreso inicial al catálogo',        user:'Jorge Medina', at:d(30) },
    { id:2, productId:5, code:'TEC-003', type:'Salida',  qty:3,  previousStock:3, newStock:0,  reason:'Inventario físico: diferencia',      user:'Jorge Medina', at:d(6) },
    { id:3, productId:8, code:'TEC-004', type:'Salida',  qty:1,  previousStock:3, newStock:2,  reason:'Unidad destinada a exhibición',      user:'Jorge Medina', at:d(2) }
  ];
  const stockAlerts = [
    { id:1, productId:2, code:'TEC-002', currentStock:3, minStock:5, at:d(1),    resolved:false },
    { id:2, productId:5, code:'TEC-003', currentStock:0, minStock:3, at:d(6),    resolved:false },
    { id:3, productId:8, code:'TEC-004', currentStock:2, minStock:3, at:d(0,3),  resolved:false }
  ];

  /* ---- Auditoría (HU-03, RN-03) ---- */
  const audits = [
    { id:1,  at:d(30),    username:'inventario', user:'Jorge Medina',   operation:'Producto registrado',  detail:'TEC-002 · Audífonos Bluetooth JBL · stock inicial 4 unidades' },
    { id:2,  at:d(6),     username:'inventario', user:'Jorge Medina',   operation:'Ajuste de inventario', detail:'TEC-003 · Salida 3 → stock 0 · Inventario físico: diferencia' },
    { id:3,  at:d(5),     username:'vendedor',   user:'Carlos Ramírez', operation:'Venta confirmada',     detail:'V-0001 · Ana Torres · S/ 1826.01 (Tarjeta)' },
    { id:4,  at:d(5),     username:'sistema',    user:'Sistema',        operation:'Pedido generado',      detail:'PD-0001 generado para V-0001 (estado inicial: Preparando)' },
    { id:5,  at:d(3),     username:'vendedor',   user:'Carlos Ramírez', operation:'Venta confirmada',     detail:'V-0002 · Cliente general · S/ 107.82 (Efectivo)' },
    { id:6,  at:d(3),     username:'sistema',    user:'Sistema',        operation:'Pedido generado',      detail:'PD-0002 generado para V-0002 (estado inicial: Preparando)' },
    { id:7,  at:d(2,2),   username:'atencion',   user:'Lucía Castro',   operation:'Devolución aprobada',  detail:'DEV-0001 · V-0002 · Camisa básica ×1 · reembolso Efectivo · reingreso al stock' },
    { id:8,  at:d(1,10),  username:'atencion',   user:'Lucía Castro',   operation:'Cambio registrado',    detail:'CAM-0001 · V-0001 · Audífonos → Mochila escolar' },
    { id:9,  at:d(1,8),   username:'atencion',   user:'Lucía Castro',   operation:'Cambio aprobado',      detail:'CAM-0001 · reingreso del original y salida del reemplazo registradas en inventario' },
    { id:10, at:d(1),     username:'vendedor',   user:'Carlos Ramírez', operation:'Venta confirmada',     detail:'V-0003 · Luis Mendoza · S/ 339.80 (Yape/Plin)' },
    { id:11, at:d(0,5),   username:'atencion',   user:'Lucía Castro',   operation:'Devolución rechazada', detail:'DEV-0002 · V-0003 · el producto presenta daños (RN-22)' },
    { id:12, at:d(0,2),   username:'rosa',       user:'Rosa Vargas',    operation:'Venta confirmada',     detail:'V-0004 · Ana Torres · S/ 170.82 (Tarjeta)' },
    { id:13, at:d(0,1),   username:'atencion',   user:'Lucía Castro',   operation:'Cambio registrado',    detail:'CAM-0002 · V-0004 · Camisa básica → Mochila escolar (pendiente de evaluación)' },
    { id:14, at:d(0),     username:'admin',      user:'María Fernández',operation:'Inicio de sesión',     detail:'admin inició sesión (Administrador)' }
  ];

  return {
    version:1, seededAt:new Date().toISOString(),
    roles, permissions, rolePermissions, users, clients, categories, products,
    promotions, promotionProducts, sales, saleDetails, salePromotions, payments, receipts, orders,
    returnRequests, changeRequests, inventoryAdjustments, stockAlerts, audits
  };
}
