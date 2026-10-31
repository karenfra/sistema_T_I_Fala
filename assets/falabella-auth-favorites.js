/**
 * falabella-auth-favorites.js
 * Universal Authentication, Progressive Client Linking & Favorites Suite for falabella.com
 * Handles:
 *  - Online user registration with strict validation
 *  - Progressive linking between physical store clients (DNI match) and online accounts
 *  - Persistent session management ("Hola, {nombre de usuario}") across all pages
 *  - Header synchronization across navigation
 *  - Dedicated Favorites Drawer with Add to Cart and Remove actions
 *  - Live heart icons sync across all product cards
 */

(function () {
  'use strict';

  // ============================================================
  // CONSTANTS & KEYS
  // ============================================================
  const SESSION_KEY = 'falabella_user_session_v1';
  const USERS_KEY = 'falabella_registered_users_v1';
  const ACTIVE_FAVS_KEY = 'falabella_active_favs_v1';
  const CART_KEY = 'falabella_store_cart_v2';

  // Pre-loaded physical store clients for Progressive Linking
  const FALABELLA_PHYSICAL_CLIENTS = [
    { dni: '45879632', name: 'Ana Torres', email: 'ana.torres@gmail.com', phone: '987654321', pointsCMR: 1450, totalPurchases: 4, clientSince: '2022' },
    { dni: '40219577', name: 'Luis Mendoza', email: 'luis.mendoza@hotmail.com', phone: '912345678', pointsCMR: 820, totalPurchases: 2, clientSince: '2023' },
    { dni: '71203455', name: 'Carmen Flores', email: 'carmen.flores@outlook.com', phone: '945678123', pointsCMR: 2300, totalPurchases: 6, clientSince: '2021' },
    { dni: '09456782', name: 'Diego Salazar', email: 'diego.salazar@gmail.com', phone: '956123478', pointsCMR: 540, totalPurchases: 1, clientSince: '2024' },
    { dni: '45871236', name: 'Ana Torres (Alt)', email: 'ana.alt@gmail.com', phone: '987654320', pointsCMR: 320, totalPurchases: 1, clientSince: '2023' }
  ];

  // ============================================================
  // INITIAL SEEDING
  // ============================================================
  function initUsersDatabase() {
    try {
      let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      if (!Array.isArray(users) || users.length === 0) {
        users = [
          {
            id: 'USR-1001',
            nombres: 'Ana',
            apellidos: 'Torres Valdivia',
            nombreCompleto: 'Ana Torres',
            email: 'ana.torres@gmail.com',
            tipoDoc: 'DNI',
            dni: '45879632',
            telefono: '987654321',
            password: 'password123',
            isLinkedClient: true,
            linkedClientData: { pointsCMR: 1450, totalPurchases: 4, clientSince: '2022' },
            registeredAt: new Date().toISOString()
          },
          {
            id: 'USR-1002',
            nombres: 'Carlos',
            apellidos: 'Ramírez Soto',
            nombreCompleto: 'Carlos Ramírez',
            email: 'carlos.ramirez@falabella.pe',
            tipoDoc: 'DNI',
            dni: '72345678',
            telefono: '912345678',
            password: 'password123',
            isLinkedClient: false,
            linkedClientData: null,
            registeredAt: new Date().toISOString()
          }
        ];
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
    } catch (e) {
      console.warn('Could not init users database:', e);
    }
  }
  initUsersDatabase();

  // ============================================================
  // SESSION HELPERS
  // ============================================================
  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(user) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch (e) {}
    // Merge or load favorites for this user
    loadUserFavoritesOnLogin(user);
    updateHeaderGreeting();
    updateFavoritesBadge();
    window.dispatchEvent(new Event('falabella_session_changed'));
    window.dispatchEvent(new Event('storage'));
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    updateHeaderGreeting();
    updateFavoritesBadge();
    window.dispatchEvent(new Event('falabella_session_changed'));
    window.dispatchEvent(new Event('storage'));
  }

  // ============================================================
  // PROGRESSIVE LINKING DETECTION
  // ============================================================
  function findPhysicalClient(dni) {
    if (!dni) return null;
    const cleanDni = String(dni).trim();
    // 1. Check in FALABELLA_PHYSICAL_CLIENTS
    let found = FALABELLA_PHYSICAL_CLIENTS.find(c => c.dni === cleanDni);
    if (found) return found;

    // 2. Check if window.DB && window.DB.clients exists (intranet ERP database)
    if (window.DB && Array.isArray(window.DB.clients)) {
      const erpClient = window.DB.clients.find(c => String(c.dni).trim() === cleanDni);
      if (erpClient) {
        return {
          dni: erpClient.dni,
          name: erpClient.name,
          email: erpClient.email || '',
          phone: erpClient.phone || '',
          pointsCMR: 950,
          totalPurchases: 3,
          clientSince: '2023'
        };
      }
    }
    return null;
  }

  // ============================================================
  // FIND PRODUCT ANYWHERE IN CATALOGS
  // ============================================================
  function findProductAnywhere(productId) {
    const pid = Number(productId);
    const sources = [
      window.DEPORTES_PRODUCTS,
      window.MODA_PRODUCTS,
      window.MUJER_PRODUCTS,
      window.TECH_PRODUCTS,
      window.LAPTOP_PRODUCTS,
      window.TABLET_PRODUCTS,
      window.TV_PRODUCTS,
      window.CAMERA_PRODUCTS,
      window.CEL_PRODUCTS,
      window.DB && window.DB.products,
      window.products
    ];

    for (const list of sources) {
      if (Array.isArray(list)) {
        const found = list.find(p => Number(p.id) === pid);
        if (found) {
          return {
            id: pid,
            name: found.name,
            brand: found.brand || 'Falabella',
            image: found.image || found.img || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
            price: Number(found.priceCmr || found.cmrPrice || found.price || 0),
            priceCmr: Number(found.priceCmr || found.cmrPrice || found.price || 0),
            priceNormal: Number(found.priceNormal || found.originalPrice || found.price || 0),
            originalPrice: Number(found.priceNormal || found.originalPrice || found.price || 0),
            discount: found.discount || '',
            category: found.category || found.type || 'General'
          };
        }
      }
    }
    return null;
  }

  // ============================================================
  // FAVORITES MANAGEMENT
  // ============================================================
  function getUserFavsKey(user) {
    if (!user) return 'falabella_guest_favs_v1';
    return 'falabella_favs_usr_' + (user.dni || user.id || 'anonymous');
  }

  function getFavorites() {
    try {
      const user = getSession();
      const userKey = getUserFavsKey(user);
      const userFavsRaw = localStorage.getItem(userKey);
      if (userFavsRaw) {
        return JSON.parse(userFavsRaw);
      }
      // Fallback to active favs
      const activeRaw = localStorage.getItem(ACTIVE_FAVS_KEY);
      return activeRaw ? JSON.parse(activeRaw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(favs) {
    try {
      const user = getSession();
      const userKey = getUserFavsKey(user);
      localStorage.setItem(userKey, JSON.stringify(favs));
      localStorage.setItem(ACTIVE_FAVS_KEY, JSON.stringify(favs));
      try {
        sessionStorage.setItem(ACTIVE_FAVS_KEY, JSON.stringify(favs));
      } catch (e) {}
    } catch (e) {}

    updateFavoritesBadge();
    syncAllHeartIcons();
    window.dispatchEvent(new Event('falabella_favs_updated'));
    window.dispatchEvent(new Event('storage'));
  }

  function loadUserFavoritesOnLogin(user) {
    try {
      const userKey = getUserFavsKey(user);
      let userFavs = JSON.parse(localStorage.getItem(userKey) || '[]');
      const activeFavs = JSON.parse(localStorage.getItem(ACTIVE_FAVS_KEY) || '[]');

      // Merge active guest favorites into user favorites without duplicates
      const mergedMap = new Map();
      userFavs.forEach(item => mergedMap.set(item.id, item));
      activeFavs.forEach(item => mergedMap.set(item.id, item));

      const merged = Array.from(mergedMap.values());
      localStorage.setItem(userKey, JSON.stringify(merged));
      localStorage.setItem(ACTIVE_FAVS_KEY, JSON.stringify(merged));
    } catch (e) {}
  }

  function isProductFavorited(productId) {
    const favs = getFavorites();
    return favs.some(item => Number(item.id) === Number(productId));
  }

  // ============================================================
  // AUTH GUARD FOR RESTRICTED ACTIONS (CART & FAVORITES)
  // ============================================================
  function requireAuthForAction(action) {
    const user = getSession();
    if (!user) {
      const msg = action === 'cart'
        ? '🔒 Debes iniciar sesión para añadir productos a tu bolsa de compras.'
        : '🔒 Debes iniciar sesión para guardar productos en tus favoritos.';
      showGlobalToast(msg, 'error');
      window.openFalabellaAuthModal('login');
      return false;
    }
    return true;
  }
  window.requireFalabellaAuth = requireAuthForAction;

  function toggleProductFavorite(event, productOrId) {
    if (event) {
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
      if (typeof event.preventDefault === 'function') event.preventDefault();
    }

    // Restrict adding to favorites if user has not logged in
    if (!requireAuthForAction('favorites')) {
      return false;
    }

    let product = null;
    let pid = null;

    if (typeof productOrId === 'number' || typeof productOrId === 'string') {
      pid = Number(productOrId);
      product = findProductAnywhere(pid);
    } else if (productOrId && typeof productOrId === 'object') {
      pid = Number(productOrId.id);
      product = productOrId;
    }

    if (!pid) {
      console.warn('toggleProductFavorite: product invalid', productOrId);
      return;
    }

    let favs = getFavorites();
    const existingIndex = favs.findIndex(item => Number(item.id) === pid);

    if (existingIndex >= 0) {
      // Remove
      favs.splice(existingIndex, 1);
      saveFavorites(favs);
      showGlobalToast('🤍 Eliminado de tus favoritos: ' + (product?.name ? product.name.slice(0, 24) + '...' : ''));
    } else {
      // Add
      if (!product) {
        product = findProductAnywhere(pid) || {
          id: pid,
          name: 'Producto Falabella #' + pid,
          brand: 'Falabella',
          image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
          price: 199.00
        };
      }

      const favItem = {
        id: pid,
        productId: pid,
        name: product.name || 'Producto Falabella',
        brand: product.brand || 'Falabella',
        image: product.image || product.img || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
        price: Number(product.priceCmr || product.cmrPrice || product.price || 0),
        priceCmr: Number(product.priceCmr || product.cmrPrice || product.price || 0),
        priceNormal: Number(product.priceNormal || product.originalPrice || product.price || 0),
        originalPrice: Number(product.priceNormal || product.originalPrice || product.price || 0),
        discount: product.discount || '',
        category: product.category || product.type || 'General',
        addedAt: new Date().toISOString()
      };
      favs.push(favItem);
      saveFavorites(favs);
      showGlobalToast('❤️ ¡Guardado en tus favoritos! ' + (favItem.name ? favItem.name.slice(0, 24) + '...' : ''));
    }

    // Animate button if triggered from a DOM button
    const triggerEl = event?.currentTarget || (event && event.target ? event.target.closest('button') : null);
    if (triggerEl) {
      triggerEl.classList.add('scale-125');
      setTimeout(() => triggerEl.classList.remove('scale-125'), 200);
    }
  }

  // Hook legacy toggleWishlist for subpages (celulares, laptops, tablets, televisores, camaras)
  window.toggleWishlist = function (id, btn) {
    toggleProductFavorite({ currentTarget: btn }, id);
  };
  window.openWishlistModal = function () {
    window.openFalabellaFavoritesModal();
  };

  // ============================================================
  // GLOBAL TOAST NOTIFICATION
  // ============================================================
  function showGlobalToast(message, type) {
    if (typeof window.toast === 'function') {
      window.toast(type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info'), message);
      return;
    }
    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }
    let toastContainer = document.getElementById('falabellaUniversalToast');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'falabellaUniversalToast';
      toastContainer.className = 'fixed bottom-5 right-5 z-[999999] pointer-events-none flex flex-col gap-2 max-w-sm';
      document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = 'bg-slate-900 text-white text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2 transform transition-all duration-300 translate-y-4 opacity-0 pointer-events-auto';
    toast.innerHTML = `<span class="text-[#aad500] font-black text-base">●</span><span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-4', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================================
  // MODALS & DRAWER INJECTION
  // ============================================================
  function ensureModalsInDOM() {
    if (document.getElementById('falabellaAuthSuiteContainer')) return;

    const container = document.createElement('div');
    container.id = 'falabellaAuthSuiteContainer';
    container.innerHTML = `
      <style>
        .fal-auth-backdrop {
          position: fixed; inset: 0; z-index: 99999;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px; opacity: 1; transition: opacity 0.25s ease;
        }
        .fal-auth-backdrop.hidden { display: none !important; }
        .fal-auth-card {
          background: #ffffff; width: 100%; max-width: 480px;
          border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);
          overflow: hidden; display: flex; flex-direction: column;
          max-height: 90vh; border: 1px solid #e2e8f0;
          transform: scale(1); transition: transform 0.25s ease;
          font-family: inherit;
        }
        .fal-drawer-backdrop {
          position: fixed; inset: 0; z-index: 99999;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
          opacity: 1; transition: opacity 0.3s ease;
        }
        .fal-drawer-backdrop.hidden { display: none !important; }
        .fal-drawer-panel {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: 100%; max-width: 440px; background: #ffffff;
          box-shadow: -10px 0 35px rgba(0,0,0,0.25); z-index: 100000;
          display: flex; flex-direction: column;
          transform: translateX(0); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fal-drawer-backdrop.hidden .fal-drawer-panel {
          transform: translateX(100%);
        }
        .fal-input-field {
          width: 100%; padding: 10px 14px; font-size: 13px;
          border: 1.5px solid #cbd5e1; border-radius: 10px;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
          background: #ffffff; color: #1e293b;
        }
        .fal-input-field:focus {
          border-color: #0f172a; box-shadow: 0 0 0 2px rgba(15,23,42,0.1);
        }
        .fal-btn-primary {
          width: 100%; padding: 12px; border-radius: 12px;
          background: #aad500; color: #0f172a; font-weight: 800; font-size: 14px;
          border: none; cursor: pointer; transition: background 0.2s, transform 0.1s;
          box-shadow: 0 4px 12px rgba(170,213,0,0.3);
        }
        .fal-btn-primary:hover { background: #99c000; }
        .fal-btn-primary:active { transform: scale(0.99); }
        .fal-btn-dark {
          width: 100%; padding: 12px; border-radius: 12px;
          background: #0f172a; color: #ffffff; font-weight: 800; font-size: 14px;
          border: none; cursor: pointer; transition: background 0.2s, transform 0.1s;
          box-shadow: 0 4px 12px rgba(15,23,42,0.25);
        }
        .fal-btn-dark:hover { background: #1e293b; }
      </style>

      <!-- ==================== AUTH MODAL (LOGIN & REGISTRO) ==================== -->
      <div id="falabellaAuthModal" class="fal-auth-backdrop hidden" onclick="if(event.target === this) window.closeFalabellaAuthModal()">
        <div class="fal-auth-card" onclick="event.stopPropagation()">
          
          <!-- Modal Header -->
          <div style="padding: 16px 20px; background:#fff; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px; font-weight: 900; color: #aad500; letter-spacing: -0.5px;">falabella<span style="color:#0f172a;">.com</span></span>
              <span style="font-size: 11px; background: #f1f5f9; color: #475569; font-weight: 700; padding: 2px 8px; border-radius: 99px;">Cuenta Oficial</span>
            </div>
            <button type="button" id="falAuthModalCloseBtn" onclick="event.stopPropagation(); window.closeFalabellaAuthModal()" style="width: 32px; height: 32px; border-radius: 99px; border:none; background: #f8fafc; color: #64748b; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">
              &times;
            </button>
          </div>

          <!-- Tabs Switcher -->
          <div style="display: flex; border-bottom: 1px solid #e2e8f0; background: #f8fafc; font-size: 13px; font-weight: 700;">
            <button type="button" id="falTabBtnLogin" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('login')" style="flex: 1; padding: 12px; border: none; border-bottom: 2px solid #0f172a; background: #fff; color: #0f172a; cursor: pointer; font-weight: 800;">
              Iniciar Sesión
            </button>
            <button type="button" id="falTabBtnRegister" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('register')" style="flex: 1; padding: 12px; border: none; border-bottom: 2px solid transparent; background: transparent; color: #64748b; cursor: pointer; font-weight: 700;">
              Crear Cuenta (Registro)
            </button>
          </div>

          <!-- Modal Body Scrollable -->
          <div style="padding: 20px; overflow-y: auto; max-height: calc(90vh - 120px);">
            
            <!-- ===== FORMULARIO 1: INICIAR SESIÓN ===== -->
            <form id="falLoginForm" onsubmit="window.handleFalabellaLoginSubmit(event)" style="display: flex; flex-direction: column; gap: 14px;">
              <div>
                <h3 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0;">¡Hola! Bienvenido a falabella.com</h3>
                <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">Ingresa con tu correo electrónico o tu número de DNI.</p>
              </div>

              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 4px;" for="falLoginInputIdentifier">
                  Correo electrónico o DNI *
                </label>
                <input type="text" id="falLoginInputIdentifier" placeholder="ej. usuario@gmail.com o 45879632" required class="fal-input-field" />
              </div>

              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155;" for="falLoginInputPassword">
                    Contraseña *
                  </label>
                  <button type="button" onclick="window.togglePasswordVisibility('falLoginInputPassword')" style="border:none; background:none; font-size: 11px; color: #64748b; cursor: pointer; text-decoration: underline;">
                    Mostrar
                  </button>
                </div>
                <input type="password" id="falLoginInputPassword" placeholder="Tu contraseña" required class="fal-input-field" />
              </div>

              <div id="falLoginErrorMessage" style="padding: 10px; background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; font-size: 12px; border-radius: 8px; display: none;"></div>

              <button type="submit" class="fal-btn-dark">
                Ingresar a mi cuenta
              </button>

              <!-- Quick Demo Login Helpers -->
              <div style="margin-top: 8px; padding-top: 12px; border-top: 1px solid #f1f5f9;">
                <p style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.5px;">Acceso rápido de prueba:</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <button type="button" onclick="event.stopPropagation(); window.fillDemoLogin('ana.torres@gmail.com', 'password123')" style="padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: left; cursor: pointer;">
                    <span style="font-weight: 700; font-size: 11.5px; color: #0f172a; display: block;">Ana Torres (Vinculada)</span>
                    <span style="font-size: 10px; color: #15803d; font-weight: 600;">DNI 45879632 · 1,450 pts</span>
                  </button>
                  <button type="button" onclick="event.stopPropagation(); window.fillDemoLogin('carlos.ramirez@falabella.pe', 'password123')" style="padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: left; cursor: pointer;">
                    <span style="font-weight: 700; font-size: 11.5px; color: #0f172a; display: block;">Carlos Ramírez (Online)</span>
                    <span style="font-size: 10px; color: #64748b; font-weight: 600;">DNI 72345678</span>
                  </button>
                </div>
              </div>

              <div style="text-align: center; margin-top: 4px;">
                <p style="font-size: 12px; color: #475569; margin: 0;">
                  ¿No tienes una cuenta todavía?
                  <button type="button" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('register')" style="border:none; background:none; font-weight: 800; color: #0f172a; cursor: pointer; text-decoration: underline; margin-left: 4px;">
                    Regístrate aquí gratis
                  </button>
                </p>
              </div>
            </form>

            <!-- ===== FORMULARIO 2: CREAR CUENTA (REGISTRO COMPLETO CON VALIDACIONES) ===== -->
            <form id="falRegisterForm" onsubmit="window.handleFalabellaRegisterSubmit(event)" style="display: none; flex-direction: column; gap: 12px;">
              
              <!-- Banner Vinculación Progresiva -->
              <div style="padding: 10px 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; color: #064e3b; font-size: 11.5px; line-height: 1.45; display: flex; gap: 8px; align-items: flex-start;">
                <span style="font-size: 15px;">🏪</span>
                <div>
                  <span style="font-weight: 800; display: block;">Vinculación Progresiva con Tiendas Físicas</span>
                  Si ya compraste antes en tiendas Falabella con tu DNI, ingresa tu número para unificar tu historial de compras, boletas y beneficios CMR en tu nueva cuenta online.
                </div>
              </div>

              <!-- Nombres y Apellidos -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                  <label style="display: block; font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 3px;" for="falRegNombres">
                    Nombres *
                  </label>
                  <input type="text" id="falRegNombres" placeholder="ej. Carlos Andrés" required class="fal-input-field" />
                  <p id="falErrNombres" style="font-size: 11px; color: #e11d48; font-weight: 600; margin: 3px 0 0 0; display: none;"></p>
                </div>
                <div>
                  <label style="display: block; font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 3px;" for="falRegApellidos">
                    Apellidos *
                  </label>
                  <input type="text" id="falRegApellidos" placeholder="ej. Ramírez Soto" required class="fal-input-field" />
                  <p id="falErrApellidos" style="font-size: 11px; color: #e11d48; font-weight: 600; margin: 3px 0 0 0; display: none;"></p>
                </div>
              </div>

              <!-- Tipo Doc y Documento (DNI 8 dígitos) -->
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">
                <div>
                  <label style="display: block; font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 3px;" for="falRegTipoDoc">
                    Documento *
                  </label>
                  <select id="falRegTipoDoc" class="fal-input-field" style="padding: 10px 8px;">
                    <option value="DNI" selected>DNI</option>
                    <option value="CE">C. Extranjería</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label style="display: block; font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 3px;" for="falRegDni">
                    Número de DNI (8 dígitos) *
                  </label>
                  <input type="text" id="falRegDni" maxlength="8" placeholder="ej. 45879632" required oninput="window.handleDniInputLiveValidation(this.value)" class="fal-input-field" style="font-family: monospace;" />
                  <p id="falErrDni" style="font-size: 11px; color: #e11d48; font-weight: 600; margin: 3px 0 0 0; display: none;"></p>
                  
                  <!-- DNI Physical Matching Live Badge -->
                  <div id="falDniMatchNotification" style="margin-top: 4px; padding: 6px 8px; background: #dcfce7; border: 1px solid #86efac; color: #14532d; font-size: 11px; border-radius: 6px; display: none; font-weight: 600;"></div>
                </div>
              </div>

              <!-- Correo Electrónico -->
              <div>
                <label style="display: block; font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 3px;" for="falRegEmail">
                  Correo electrónico *
                </label>
                <input type="email" id="falRegEmail" placeholder="ej. carlos.ramirez@gmail.com" required class="fal-input-field" />
                <p id="falErrEmail" style="font-size: 11px; color: #e11d48; font-weight: 600; margin: 3px 0 0 0; display: none;"></p>
              </div>

              <!-- Teléfono Celular (Opcional) -->
              <div>
                <label style="display: block; font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 3px;" for="falRegPhone">
                  Teléfono celular (Opcional, 9 dígitos)
                </label>
                <input type="tel" id="falRegPhone" maxlength="9" placeholder="ej. 987654321" class="fal-input-field" style="font-family: monospace;" />
                <p id="falErrPhone" style="font-size: 11px; color: #e11d48; font-weight: 600; margin: 3px 0 0 0; display: none;"></p>
              </div>

              <!-- Contraseñas -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                    <label style="font-size: 11.5px; font-weight: 700; color: #334155;" for="falRegPassword">
                      Contraseña *
                    </label>
                    <button type="button" onclick="window.togglePasswordVisibility('falRegPassword')" style="border:none; background:none; font-size: 10.5px; color: #64748b; cursor: pointer;">
                      Ver
                    </button>
                  </div>
                  <input type="password" id="falRegPassword" placeholder="Mínimo 6 caracteres" minlength="6" required class="fal-input-field" />
                  <p id="falErrPassword" style="font-size: 11px; color: #e11d48; font-weight: 600; margin: 3px 0 0 0; display: none;"></p>
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                    <label style="font-size: 11.5px; font-weight: 700; color: #334155;" for="falRegConfirmPassword">
                      Confirmar *
                    </label>
                    <button type="button" onclick="window.togglePasswordVisibility('falRegConfirmPassword')" style="border:none; background:none; font-size: 10.5px; color: #64748b; cursor: pointer;">
                      Ver
                    </button>
                  </div>
                  <input type="password" id="falRegConfirmPassword" placeholder="Repite contraseña" minlength="6" required class="fal-input-field" />
                  <p id="falErrConfirmPassword" style="font-size: 11px; color: #e11d48; font-weight: 600; margin: 3px 0 0 0; display: none;"></p>
                </div>
              </div>

              <!-- Términos y Condiciones -->
              <div style="margin-top: 2px;">
                <label style="display: flex; gap: 8px; align-items: flex-start; cursor: pointer; font-size: 11.5px; color: #475569;">
                  <input type="checkbox" id="falRegTerms" required style="margin-top: 2px; width: 15px; height: 15px;" />
                  <span>
                    Acepto los <a href="#" onclick="alert('Términos y Condiciones'); return false;" style="font-weight: 700; color: #0f172a; text-decoration: underline;">Términos y Condiciones</a> y la <a href="#" onclick="alert('Política de Privacidad'); return false;" style="font-weight: 700; color: #0f172a; text-decoration: underline;">Política de Privacidad</a> de falabella.com.
                  </span>
                </label>
                <p id="falErrTerms" style="font-size: 11px; color: #e11d48; font-weight: 600; margin: 3px 0 0 0; display: none;"></p>
              </div>

              <div id="falRegisterGeneralError" style="padding: 8px; background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; font-size: 11.5px; border-radius: 8px; display: none;"></div>

              <!-- Botón Crear Cuenta -->
              <button type="submit" class="fal-btn-primary" style="margin-top: 6px;">
                Crear mi cuenta Falabella
              </button>

              <div style="text-align: center; margin-top: 2px;">
                <p style="font-size: 11.5px; color: #475569; margin: 0;">
                  ¿Ya tienes una cuenta?
                  <button type="button" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('login')" style="border:none; background:none; font-weight: 800; color: #0f172a; cursor: pointer; text-decoration: underline; margin-left: 4px;">
                    Inicia sesión aquí
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- ==================== USER ACCOUNT DROPDOWN / POPOVER ==================== -->
      <div id="falabellaUserMenuModal" style="position: fixed; inset: 0; z-index: 99998; background: rgba(15,23,42,0.35); display: none; align-items: flex-start; justify-content: flex-end; padding: 60px 24px 0 0;" class="hidden" onclick="window.closeFalabellaUserMenu(event)">
        <div style="background: #ffffff; width: 100%; max-width: 300px; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.25); overflow: hidden; border: 1px solid #e2e8f0;" onclick="event.stopPropagation()">
          
          <!-- User Profile Header -->
          <div style="padding: 16px; background: #0f172a; color: #ffffff; display: flex; align-items: center; gap: 12px;">
            <div id="falUserAvatarInitial" style="width: 42px; height: 42px; border-radius: 99px; background: #aad500; color: #0f172a; font-weight: 900; font-size: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              U
            </div>
            <div style="min-width: 0;">
              <h4 id="falUserMenuFullName" style="font-weight: 800; font-size: 14px; margin: 0; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Usuario</h4>
              <p id="falUserMenuEmail" style="font-size: 11px; color: #94a3b8; margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">usuario@gmail.com</p>
            </div>
          </div>

          <!-- Status badge: Linked or Normal -->
          <div id="falUserLinkedBadge" style="padding: 10px 14px; background: #f0fdf4; border-bottom: 1px solid #dcfce7; color: #166534; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span>🏪</span>
            <span id="falUserLinkedBadgeText">Cliente Vinculado · DNI 45879632</span>
          </div>

          <!-- Menu Items -->
          <div style="padding: 8px; font-size: 12px; color: #334155; display: flex; flex-direction: column; gap: 4px;">
            <button type="button" onclick="window.closeFalabellaUserMenu(); window.openFalabellaFavoritesModal();" style="width: 100%; padding: 8px 12px; border-radius: 8px; border:none; background: none; font-weight: 700; display: flex; align-items: center; justify-content: space-between; text-align: left; cursor: pointer; color: #1e293b;">
              <span style="display: flex; align-items: center; gap: 8px;">
                <span>❤️</span>
                Mis Favoritos
              </span>
              <span id="falUserMenuFavCountBadge" style="background: #ffe4e6; color: #e11d48; font-weight: 800; padding: 2px 8px; border-radius: 99px; font-size: 10px;">0</span>
            </button>

            <button type="button" onclick="window.closeFalabellaUserMenu(); if(typeof window.openTrackOrderModal === 'function') window.openTrackOrderModal(); else window.showGlobalToast('📦 Seguimiento de compras activado para tu DNI');" style="width: 100%; padding: 8px 12px; border-radius: 8px; border:none; background: none; font-weight: 700; display: flex; align-items: center; justify-content: space-between; text-align: left; cursor: pointer; color: #1e293b;">
              <span style="display: flex; align-items: center; gap: 8px;">
                <span>📦</span>
                Mis Pedidos y Compras
              </span>
              <span style="color: #94a3b8;">&rarr;</span>
            </button>

            <button type="button" onclick="window.closeFalabellaUserMenu(); window.showGlobalToast('💳 Tarjeta CMR: Tienes beneficios y descuentos exclusivos en todas tus compras.');" style="width: 100%; padding: 8px 12px; border-radius: 8px; border:none; background: none; font-weight: 700; display: flex; align-items: center; justify-content: space-between; text-align: left; cursor: pointer; color: #1e293b;">
              <span style="display: flex; align-items: center; gap: 8px;">
                <span>💳</span>
                Beneficios Tarjeta CMR
              </span>
              <span style="color: #15803d; font-weight: 800; font-size: 10px;">Puntos Activos</span>
            </button>

            <div style="border-top: 1px solid #f1f5f9; margin-top: 4px; padding-top: 4px;">
              <button type="button" onclick="window.logoutFalabellaUser()" style="width: 100%; padding: 8px 12px; border-radius: 8px; border:none; background: #fff1f2; color: #e11d48; font-weight: 800; display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer;">
                <span>🚪</span>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== FAVORITES SLIDE-OVER DRAWER ==================== -->
      <aside id="falabellaFavoritesDrawer" class="fal-drawer-backdrop hidden" onclick="if(event.target === this) window.closeFalabellaFavoritesModal()">
        <div class="fal-drawer-panel" onclick="event.stopPropagation()">
          
          <!-- Drawer Header -->
          <div style="padding: 16px 20px; background: #0f172a; color: #ffffff; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 34px; height: 34px; border-radius: 99px; background: #e11d48; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                ❤️
              </div>
              <div>
                <h3 style="font-weight: 900; font-size: 16px; margin: 0; color: #ffffff;">Mis Favoritos</h3>
                <p id="falFavDrawerUserSubtitle" style="font-size: 11px; color: #94a3b8; margin: 2px 0 0 0;">Tus artículos preferidos guardados</p>
              </div>
            </div>
            <button type="button" onclick="window.closeFalabellaFavoritesModal()" style="width: 32px; height: 32px; border-radius: 99px; border:none; background: #1e293b; color: #cbd5e1; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
              &times;
            </button>
          </div>

          <!-- Drawer Body (Items List) -->
          <div id="falFavDrawerItemsList" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #f8fafc;">
            <!-- Injected via JavaScript -->
          </div>

          <!-- Drawer Footer -->
          <div id="falFavDrawerFooter" style="padding: 16px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 8px;">
            <button type="button" onclick="window.addAllFavoritesToCart()" id="falFavAddAllBtn" class="fal-btn-primary" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
              <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
              <span>Añadir todos a la bolsa</span>
            </button>
            <button type="button" onclick="window.closeFalabellaFavoritesModal()" style="width: 100%; padding: 10px; border-radius: 10px; background: #f1f5f9; color: #475569; font-weight: 700; font-size: 12px; border: none; cursor: pointer;">
              Seguir explorando
            </button>
          </div>
        </div>
      </aside>
    `;
    document.body.appendChild(container);

    // Direct event listener bindings for rock-solid interactivity
    const authModal = container.querySelector('#falabellaAuthModal');
    const authCard = container.querySelector('.fal-auth-card');
    const tabBtnLogin = container.querySelector('#falTabBtnLogin');
    const tabBtnRegister = container.querySelector('#falTabBtnRegister');
    const closeBtn = container.querySelector('#falAuthModalCloseBtn');
    const loginForm = container.querySelector('#falLoginForm');
    const registerForm = container.querySelector('#falRegisterForm');

    if (authCard) {
      authCard.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
          window.closeFalabellaAuthModal();
        }
      });
    }

    if (tabBtnLogin) {
      tabBtnLogin.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.switchFalabellaAuthTab('login');
      });
    }

    if (tabBtnRegister) {
      tabBtnRegister.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.switchFalabellaAuthTab('register');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.closeFalabellaAuthModal();
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.stopPropagation();
        window.handleFalabellaLoginSubmit(e);
      });
    }

    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.stopPropagation();
        window.handleFalabellaRegisterSubmit(e);
      });
    }
  }

  // ============================================================
  // AUTH MODAL FUNCTIONS & TABS
  // ============================================================
  window.openFalabellaAuthModal = function (tab) {
    ensureModalsInDOM();
    const modal = document.getElementById('falabellaAuthModal');
    if (!modal) return;
    window.switchFalabellaAuthTab(tab || 'login');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  window.closeFalabellaAuthModal = function () {
    const modal = document.getElementById('falabellaAuthModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  window.switchFalabellaAuthTab = function (tab) {
    const loginForm = document.getElementById('falLoginForm');
    const registerForm = document.getElementById('falRegisterForm');
    const tabBtnLogin = document.getElementById('falTabBtnLogin');
    const tabBtnRegister = document.getElementById('falTabBtnRegister');
    if (!loginForm || !registerForm) return;

    if (tab === 'register') {
      loginForm.style.display = 'none';
      registerForm.style.display = 'flex';
      tabBtnLogin.style.borderBottom = '2px solid transparent';
      tabBtnLogin.style.background = 'transparent';
      tabBtnLogin.style.color = '#64748b';
      tabBtnRegister.style.borderBottom = '2px solid #0f172a';
      tabBtnRegister.style.background = '#fff';
      tabBtnRegister.style.color = '#0f172a';
      tabBtnRegister.style.fontWeight = '800';
    } else {
      registerForm.style.display = 'none';
      loginForm.style.display = 'flex';
      tabBtnRegister.style.borderBottom = '2px solid transparent';
      tabBtnRegister.style.background = 'transparent';
      tabBtnRegister.style.color = '#64748b';
      tabBtnLogin.style.borderBottom = '2px solid #0f172a';
      tabBtnLogin.style.background = '#fff';
      tabBtnLogin.style.color = '#0f172a';
      tabBtnLogin.style.fontWeight = '800';
    }
  };

  window.togglePasswordVisibility = function (inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  };

  window.fillDemoLogin = function (identifier, pass) {
    const idInput = document.getElementById('falLoginInputIdentifier');
    const passInput = document.getElementById('falLoginInputPassword');
    if (idInput && passInput) {
      idInput.value = identifier;
      passInput.value = pass;
    }
  };

  // Live DNI validation while typing in register form
  window.handleDniInputLiveValidation = function (value) {
    const clean = value.replace(/\D/g, '').slice(0, 8);
    const input = document.getElementById('falRegDni');
    if (input) input.value = clean;

    const matchBadge = document.getElementById('falDniMatchNotification');
    if (!matchBadge) return;

    if (clean.length === 8) {
      const match = findPhysicalClient(clean);
      if (match) {
        matchBadge.innerHTML = `✨ <b>¡Cliente de tienda reconocido!</b> Hola, <b>${match.name}</b>. Tu cuenta web se unificará con tus compras anteriores y acumularás puntos CMR.`;
        matchBadge.classList.remove('hidden');
      } else {
        matchBadge.innerHTML = `👤 Documento listo. Tu cuenta se registrará como nuevo cliente en línea.`;
        matchBadge.classList.remove('hidden');
      }
    } else {
      matchBadge.classList.add('hidden');
    }
  };

  // ============================================================
  // FORM SUBMISSION & STRICT VALIDATION
  // ============================================================
  window.handleFalabellaLoginSubmit = function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();

    const idInput = document.getElementById('falLoginInputIdentifier');
    const passInput = document.getElementById('falLoginInputPassword');
    const errBox = document.getElementById('falLoginErrorMessage');

    const identifier = (idInput ? idInput.value : '').trim();
    const password = (passInput ? passInput.value : '').trim();

    if (!identifier || !password) {
      if (errBox) {
        errBox.textContent = 'Por favor ingresa tu correo o DNI y tu contraseña.';
        errBox.classList.remove('hidden');
        errBox.style.display = 'block';
      }
      return;
    }

    let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    if (!Array.isArray(users) || users.length === 0) {
      initUsersDatabase();
      users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    }

    let user = users.find(u => 
      (u.email.toLowerCase() === identifier.toLowerCase() || u.dni === identifier) &&
      u.password === password
    );

    // If not found in registered users, verify if they are an existing physical store client
    if (!user) {
      const physicalMatch = FALABELLA_PHYSICAL_CLIENTS.find(p => 
        p.dni === identifier || p.email.toLowerCase() === identifier.toLowerCase()
      );
      if (physicalMatch && (password === 'password123' || password.length >= 6)) {
        const parts = physicalMatch.name.split(' ');
        user = {
          id: 'USR-' + Date.now(),
          nombres: parts[0] || physicalMatch.name,
          apellidos: parts.slice(1).join(' ') || 'Cliente',
          nombreCompleto: physicalMatch.name,
          email: physicalMatch.email,
          tipoDoc: 'DNI',
          dni: physicalMatch.dni,
          telefono: physicalMatch.phone || '987654321',
          password: password,
          isLinkedClient: true,
          linkedClientData: {
            pointsCMR: physicalMatch.pointsCMR || 1450,
            totalPurchases: physicalMatch.totalPurchases || 4,
            clientSince: physicalMatch.clientSince || '2022'
          },
          registeredAt: new Date().toISOString()
        };
        users.push(user);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
    }

    if (user) {
      if (errBox) {
        errBox.classList.add('hidden');
        errBox.style.display = 'none';
      }
      setSession(user);
      window.closeFalabellaAuthModal();
      showGlobalToast(`¡Bienvenido/a de nuevo, ${user.nombres.split(' ')[0]}! Has iniciado sesión.`);
    } else {
      if (errBox) {
        errBox.innerHTML = 'Credenciales incorrectas. Verifica tu correo/DNI y contraseña, o prueba una de las cuentas demo abajo.';
        errBox.classList.remove('hidden');
        errBox.style.display = 'block';
      }
    }
  };

  window.handleFalabellaRegisterSubmit = function (e) {
    e.preventDefault();

    // Reset error messages
    const clearError = (id) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '';
        el.classList.add('hidden');
        el.style.display = 'none';
      }
    };
    ['falErrNombres', 'falErrApellidos', 'falErrDni', 'falErrEmail', 'falErrPhone', 'falErrPassword', 'falErrConfirmPassword', 'falErrTerms', 'falRegisterGeneralError'].forEach(clearError);

    const nombres = (document.getElementById('falRegNombres')?.value || '').trim();
    const apellidos = (document.getElementById('falRegApellidos')?.value || '').trim();
    const tipoDoc = document.getElementById('falRegTipoDoc')?.value || 'DNI';
    const dni = (document.getElementById('falRegDni')?.value || '').trim();
    const email = (document.getElementById('falRegEmail')?.value || '').trim();
    const phone = (document.getElementById('falRegPhone')?.value || '').trim();
    const password = (document.getElementById('falRegPassword')?.value || '').trim();
    const confirmPassword = (document.getElementById('falRegConfirmPassword')?.value || '').trim();
    const terms = document.getElementById('falRegTerms')?.checked;

    let hasErrors = false;

    // 1. Nombres: solo letras y espacios, min 2
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]{2,50}$/;
    if (!nombres || !nameRegex.test(nombres)) {
      showFieldError('falErrNombres', 'Ingresa un nombre válido (mínimo 2 letras, sin números).');
      hasErrors = true;
    }

    // 2. Apellidos: solo letras y espacios, min 2
    if (!apellidos || !nameRegex.test(apellidos)) {
      showFieldError('falErrApellidos', 'Ingresa tus apellidos válidos (mínimo 2 letras).');
      hasErrors = true;
    }

    // 3. Documento (DNI: exactamente 8 dígitos)
    if (tipoDoc === 'DNI') {
      if (!/^\d{8}$/.test(dni)) {
        showFieldError('falErrDni', 'El DNI debe tener exactamente 8 dígitos numéricos.');
        hasErrors = true;
      }
    } else {
      if (!/^[a-zA-Z0-9]{6,12}$/.test(dni)) {
        showFieldError('falErrDni', 'Ingresa un número de documento válido.');
        hasErrors = true;
      }
    }

    // 4. Correo electrónico válido
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      showFieldError('falErrEmail', 'Ingresa un correo electrónico con formato válido (ej. nombre@dominio.com).');
      hasErrors = true;
    }

    // 5. Teléfono (si se ingresa, 9 dígitos empezando en 9)
    if (phone && !/^9\d{8}$/.test(phone)) {
      showFieldError('falErrPhone', 'El celular debe tener 9 dígitos y comenzar con 9.');
      hasErrors = true;
    }

    // 6. Contraseña: mínimo 6 caracteres
    if (!password || password.length < 6) {
      showFieldError('falErrPassword', 'La contraseña debe tener al menos 6 caracteres.');
      hasErrors = true;
    }

    // 7. Confirmar contraseña
    if (password !== confirmPassword) {
      showFieldError('falErrConfirmPassword', 'Las contraseñas no coinciden. Verifícalas.');
      hasErrors = true;
    }

    // 8. Términos aceptados
    if (!terms) {
      showFieldError('falErrTerms', 'Debes aceptar los Términos y Condiciones para continuar.');
      hasErrors = true;
    }

    if (hasErrors) return;

    // Check duplicate email in users list
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      showFieldError('falErrEmail', 'Este correo ya se encuentra registrado. Inicia sesión.');
      return;
    }

    // Progressive Linking Check against physical store customers!
    const matchedPhysicalClient = findPhysicalClient(dni);
    const isLinked = !!matchedPhysicalClient;

    const newUser = {
      id: 'USR-' + Date.now(),
      nombres: nombres,
      apellidos: apellidos,
      nombreCompleto: `${nombres} ${apellidos}`,
      email: email,
      tipoDoc: tipoDoc,
      dni: dni,
      telefono: phone,
      password: password,
      isLinkedClient: isLinked,
      linkedClientData: matchedPhysicalClient ? {
        pointsCMR: matchedPhysicalClient.pointsCMR || 1200,
        totalPurchases: matchedPhysicalClient.totalPurchases || 2,
        clientSince: matchedPhysicalClient.clientSince || '2023'
      } : null,
      registeredAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    // Save session
    setSession(newUser);
    window.closeFalabellaAuthModal();

    if (isLinked) {
      showGlobalToast(`🎉 ¡Bienvenido/a ${nombres.split(' ')[0]}! Tu cuenta ha sido vinculada a tu historial de tienda física.`);
    } else {
      showGlobalToast(`🎉 ¡Cuenta creada con éxito! Bienvenido/a a falabella.com, ${nombres.split(' ')[0]}.`);
    }
  };

  function showFieldError(errorElementId, message) {
    const el = document.getElementById(errorElementId);
    if (el) {
      el.textContent = message;
      el.classList.remove('hidden');
      el.style.display = 'block';
    }
  }

  // ============================================================
  // USER MENU & LOGOUT
  // ============================================================
  window.openFalabellaUserMenu = function () {
    ensureModalsInDOM();
    const menu = document.getElementById('falabellaUserMenuModal');
    const user = getSession();
    if (!menu || !user) return;

    const initial = (user.nombres || 'U').charAt(0).toUpperCase();
    document.getElementById('falUserAvatarInitial').textContent = initial;
    document.getElementById('falUserMenuFullName').textContent = user.nombreCompleto || user.nombres;
    document.getElementById('falUserMenuEmail').textContent = user.email;

    const badgeContainer = document.getElementById('falUserLinkedBadge');
    const badgeText = document.getElementById('falUserLinkedBadgeText');
    if (user.isLinkedClient) {
      badgeContainer.style.background = '#f0fdf4';
      badgeContainer.style.color = '#166534';
      badgeText.innerHTML = `🏪 <b>Cliente Vinculado</b> · DNI ${user.dni} (${user.linkedClientData?.pointsCMR || 1450} pts CMR)`;
    } else {
      badgeContainer.style.background = '#f8fafc';
      badgeContainer.style.color = '#475569';
      badgeText.innerHTML = `👤 <b>Usuario Digital</b> · DNI ${user.dni}`;
    }

    const favs = getFavorites();
    document.getElementById('falUserMenuFavCountBadge').textContent = favs.length;

    menu.classList.remove('hidden');
    menu.style.display = 'flex';
  };

  window.closeFalabellaUserMenu = function () {
    const menu = document.getElementById('falabellaUserMenuModal');
    if (!menu) return;
    menu.classList.add('hidden');
    menu.style.display = 'none';
  };

  window.logoutFalabellaUser = function () {
    window.closeFalabellaUserMenu();
    clearSession();
    showGlobalToast('Has cerrado sesión correctamente. ¡Esperamos verte pronto!');
  };

  // Combined trigger for the header button: opens menu if logged in, opens login modal if not
  window.openFalabellaAuthOrAccount = function () {
    const user = getSession();
    if (user) {
      window.openFalabellaUserMenu();
    } else {
      window.openFalabellaAuthModal('login');
    }
  };

  // ============================================================
  // FAVORITES DRAWER & MODAL
  // ============================================================
  window.openFalabellaFavoritesModal = function () {
    ensureModalsInDOM();
    const drawer = document.getElementById('falabellaFavoritesDrawer');
    if (!drawer) return;
    renderFavoritesDrawerContent();
    drawer.classList.remove('hidden');
    drawer.style.display = 'block';
    document.body.style.overflow = 'hidden';
  };

  window.closeFalabellaFavoritesModal = function () {
    const drawer = document.getElementById('falabellaFavoritesDrawer');
    if (!drawer) return;
    drawer.classList.add('hidden');
    drawer.style.display = 'none';
    document.body.style.overflow = '';
  };

  function renderFavoritesDrawerContent() {
    const list = document.getElementById('falFavDrawerItemsList');
    const subtitle = document.getElementById('falFavDrawerUserSubtitle');
    const addAllBtn = document.getElementById('falFavAddAllBtn');
    if (!list) return;

    const user = getSession();
    if (subtitle) {
      if (user) {
        subtitle.textContent = `Guardados en la cuenta de ${user.nombres.split(' ')[0]}`;
      } else {
        subtitle.textContent = 'Guarda artículos favoritos para verlos siempre';
      }
    }

    const favs = getFavorites();

    if (!favs || favs.length === 0) {
      if (addAllBtn) addAllBtn.classList.add('hidden');
      list.innerHTML = `
        <div class="py-16 px-4 text-center">
          <div class="w-16 h-16 rounded-full bg-rose-50 text-rose-500 text-3xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            🤍
          </div>
          <h4 class="font-bold text-slate-800 text-base">Aún no tienes favoritos</h4>
          <p class="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Explora las secciones de Tecnología, Deportes y Moda, y haz clic en el corazón de tus productos preferidos para guardarlos aquí.
          </p>
          <button type="button" onclick="window.closeFalabellaFavoritesModal()" class="mt-4 px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-[#aad500] hover:text-slate-900 transition">
            Ver catálogo completo
          </button>
        </div>
      `;
      return;
    }

    if (addAllBtn) addAllBtn.classList.remove('hidden');

    list.innerHTML = favs.map(item => `
      <div class="bg-white rounded-xl p-3 shadow-2xs border border-slate-200 flex gap-3 items-center group hover:border-slate-300 transition">
        <div class="w-20 h-20 bg-slate-50 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center p-1 border border-slate-100">
          <img src="${item.image}" alt="${escapeHtml(item.name)}" class="max-h-full max-w-full object-contain group-hover:scale-105 transition" />
        </div>
        <div class="flex-1 min-w-0">
          <span class="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">${escapeHtml(item.brand || 'Falabella')}</span>
          <h5 class="text-xs font-bold text-slate-800 truncate" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h5>
          
          <div class="flex items-baseline gap-2 mt-1">
            <span class="text-sm font-black text-rose-600">S/ ${(item.price || item.priceCmr || 0).toFixed(2)}</span>
            ${(item.priceNormal || item.originalPrice) && (item.priceNormal || item.originalPrice) > (item.price || item.priceCmr) ? `
              <span class="text-[10.5px] text-slate-400 line-through">S/ ${(item.priceNormal || item.originalPrice).toFixed(2)}</span>
            ` : ''}
          </div>

          <div class="flex items-center gap-2 mt-2">
            <button type="button" onclick="window.addFavItemToCart(${item.id})" class="px-3 py-1.5 bg-[#0f172a] hover:bg-[#aad500] hover:text-slate-950 text-white text-[11px] font-bold rounded-lg transition flex items-center gap-1 shadow-2xs">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
              <span>Añadir a la bolsa</span>
            </button>
            <button type="button" onclick="window.removeFavoriteItem(${item.id})" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition" title="Eliminar de favoritos">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  window.removeFavoriteItem = function (productId) {
    let favs = getFavorites();
    favs = favs.filter(item => Number(item.id) !== Number(productId));
    saveFavorites(favs);
    renderFavoritesDrawerContent();
    showGlobalToast('🤍 Producto retirado de tus favoritos.');
  };

  window.addFavItemToCart = function (productId) {
    // Restrict adding to cart if user has not logged in
    if (!requireAuthForAction('cart')) {
      return false;
    }
    const favs = getFavorites();
    const item = favs.find(f => Number(f.id) === Number(productId));
    if (!item) return;

    let cart = [];
    try {
      cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    } catch (e) {
      cart = [];
    }

    const existing = cart.find(c => Number(c.id) === Number(productId) || Number(c.productId) === Number(productId));
    const effectivePrice = item.priceCmr || item.price || 0;

    if (existing) {
      const q = existing.qty || existing.quantity || 1;
      existing.qty = q + 1;
      existing.quantity = existing.qty;
    } else {
      cart.push({
        id: item.id,
        productId: item.id,
        name: item.name,
        brand: item.brand || 'Falabella',
        image: item.image,
        img: item.image,
        price: effectivePrice,
        originalPrice: item.priceNormal || item.originalPrice || effectivePrice,
        regularPrice: item.priceNormal || item.originalPrice || effectivePrice,
        qty: 1,
        quantity: 1
      });
    }

    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {}

    // Dispatch cart events
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('falabella_cart_updated', { detail: { cart } }));

    // Trigger page-specific cart update functions if they exist
    if (typeof window.updateDeportesCartUI === 'function') window.updateDeportesCartUI();
    if (typeof window.updateCartBadge === 'function') window.updateCartBadge();
    if (typeof window.renderCartModal === 'function') window.renderCartModal();
    if (typeof window.openStoreCartModal === 'function') {
      // update badge
      const b = document.getElementById('storeCartBadge');
      if (b) {
        const totalQty = cart.reduce((acc, it) => acc + (it.qty || it.quantity || 1), 0);
        b.textContent = totalQty;
      }
    }

    showGlobalToast(`✓ "${item.name.slice(0, 24)}..." añadido a tu bolsa.`);
  };

  window.addAllFavoritesToCart = function () {
    // Restrict adding to cart if user has not logged in
    if (!requireAuthForAction('cart')) {
      return false;
    }
    const favs = getFavorites();
    if (!favs || !favs.length) return;

    let cart = [];
    try {
      cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    } catch (e) {
      cart = [];
    }

    favs.forEach(item => {
      const existing = cart.find(c => Number(c.id) === Number(item.id) || Number(c.productId) === Number(item.id));
      const effectivePrice = item.priceCmr || item.price || 0;
      if (existing) {
        const q = existing.qty || existing.quantity || 1;
        existing.qty = q + 1;
        existing.quantity = existing.qty;
      } else {
        cart.push({
          id: item.id,
          productId: item.id,
          name: item.name,
          brand: item.brand || 'Falabella',
          image: item.image,
          img: item.image,
          price: effectivePrice,
          originalPrice: item.priceNormal || item.originalPrice || effectivePrice,
          regularPrice: item.priceNormal || item.originalPrice || effectivePrice,
          qty: 1,
          quantity: 1
        });
      }
    });

    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {}

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('falabella_cart_updated', { detail: { cart } }));

    if (typeof window.updateDeportesCartUI === 'function') window.updateDeportesCartUI();
    if (typeof window.updateCartBadge === 'function') window.updateCartBadge();
    if (typeof window.renderCartModal === 'function') window.renderCartModal();

    showGlobalToast(`✓ ${favs.length} productos añadidos a tu bolsa de compras.`);
    window.closeFalabellaFavoritesModal();
  };

  // ============================================================
  // HEADER SYNCHRONIZATION ("Hola, {nombre}" & Favorites Badge)
  // ============================================================
  function updateHeaderGreeting() {
    const user = getSession();

    // 1. Target by known IDs or classes
    const greetingSpans = document.querySelectorAll('.falabella-user-greeting, #falabellaUserGreetingName');
    greetingSpans.forEach(span => {
      if (span.closest('#falabellaAuthSuiteContainer')) return;
      if (user) {
        const firstName = (user.nombres || 'Cliente').split(' ')[0];
        span.innerHTML = `
          ${escapeHtml(firstName)}
          <svg class="w-2.5 h-2.5 text-slate-600 inline ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
        `;
      } else {
        span.innerHTML = `
          Inicia sesión
          <svg class="w-2.5 h-2.5 text-slate-600 inline ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
        `;
      }
    });

    // 2. Scan elements in header / navigation ONLY
    const candidateContainers = document.querySelectorAll('header div, header a, header button, nav div, nav a, nav button, [onclick*="openAccountDropdownOrModal"], [onclick*="openFalabellaAuthOrAccount"], [data-falabella-user-trigger]');
    candidateContainers.forEach(el => {
      // CRITICAL: NEVER bind to any element inside falabellaAuthSuiteContainer or the modals!
      if (el.closest('#falabellaAuthSuiteContainer')) return;
      if (el.id === 'falabellaAuthModal' || el.classList.contains('fal-auth-card') || el.classList.contains('fal-auth-backdrop')) return;

      const clickAttr = el.getAttribute('onclick') || '';
      const text = el.textContent || '';

      if (clickAttr.includes('openAccountDropdownOrModal') || (text.includes('Inicia sesión') && text.includes('Hola'))) {
        // Prevent binding to large wrappers containing many children
        if (el.children.length > 5) return;

        el.setAttribute('data-fal-auth-bound', 'true');
        el.onclick = function (e) {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          window.openFalabellaAuthOrAccount();
        };

        // Update inner text if matching
        const innerBold = el.querySelector('.font-bold');
        if (innerBold && (innerBold.textContent.includes('Inicia sesión') || innerBold.classList.contains('falabella-user-greeting'))) {
          innerBold.classList.add('falabella-user-greeting');
          if (user) {
            const firstName = (user.nombres || 'Cliente').split(' ')[0];
            innerBold.innerHTML = `
              ${escapeHtml(firstName)}
              <svg class="w-2.5 h-2.5 text-slate-600 inline ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
            `;
          } else {
            innerBold.innerHTML = `
              Inicia sesión
              <svg class="w-2.5 h-2.5 text-slate-600 inline ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
            `;
          }
        }
      }
    });
  }

  function updateFavoritesBadge() {
    const favs = getFavorites();
    const count = favs.length;

    const badges = document.querySelectorAll('.falabella-fav-badge, #falabellaFavCountBadge, #storeFavsBadge, #wishlistBadge');
    badges.forEach(badge => {
      badge.textContent = count;
      if (count > 0) {
        badge.classList.remove('hidden');
        badge.style.display = 'flex';
      } else {
        badge.classList.add('hidden');
        badge.style.display = 'none';
      }
    });

    // Also bind heart buttons in header
    const favButtons = document.querySelectorAll('button[onclick*="toggleStoreFavorites"], button[onclick*="showTechToast"], button[onclick*="openWishlistModal"]');
    favButtons.forEach(btn => {
      if (!btn.getAttribute('data-fal-fav-bound')) {
        btn.setAttribute('data-fal-fav-bound', 'true');
        btn.onclick = function (e) {
          if (e) e.preventDefault();
          window.openFalabellaFavoritesModal();
        };

        // Add badge if not present
        if (!btn.querySelector('.falabella-fav-badge')) {
          const badge = document.createElement('span');
          badge.className = 'falabella-fav-badge absolute -top-1 -right-2 bg-rose-600 text-white font-black text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center border-2 border-white shadow-xs';
          badge.textContent = count;
          if (count === 0) badge.style.display = 'none';
          btn.classList.add('relative');
          btn.appendChild(badge);
        }
      }
    });
  }

  function syncAllHeartIcons() {
    const favs = getFavorites();
    const favIdSet = new Set(favs.map(f => Number(f.id)));

    // Look for all product cards with heart buttons
    const favBtns = document.querySelectorAll('.falabella-card-fav-btn, [data-fav-prod-id]');
    favBtns.forEach(btn => {
      const pid = Number(btn.getAttribute('data-fav-prod-id'));
      const isFav = favIdSet.has(pid);

      const svg = btn.querySelector('svg');
      if (isFav) {
        btn.classList.add('text-rose-600');
        btn.classList.remove('text-slate-400');
        if (svg) {
          svg.setAttribute('fill', 'currentColor');
          svg.classList.add('fill-rose-600', 'text-rose-600');
          svg.classList.remove('text-slate-400');
        }
      } else {
        btn.classList.remove('text-rose-600');
        btn.classList.add('text-slate-400');
        if (svg) {
          svg.setAttribute('fill', 'none');
          svg.classList.remove('fill-rose-600', 'text-rose-600');
          svg.classList.add('text-slate-400');
        }
      }
    });
  }

  // Escape key closes open modals
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const authModal = document.getElementById('falabellaAuthModal');
      if (authModal && !authModal.classList.contains('hidden') && authModal.style.display !== 'none') {
        window.closeFalabellaAuthModal();
        return;
      }
      const userMenu = document.getElementById('falabellaUserMenuModal');
      if (userMenu && !userMenu.classList.contains('hidden') && userMenu.style.display !== 'none') {
        window.closeFalabellaUserMenu();
        return;
      }
      const favDrawer = document.getElementById('falabellaFavoritesDrawer');
      if (favDrawer && !favDrawer.classList.contains('hidden') && favDrawer.style.display !== 'none') {
        window.closeFalabellaFavoritesModal();
        return;
      }
    }
  });

  // ============================================================
  // GLOBAL EXPORTS
  // ============================================================
  window.getFalabellaSession = getSession;
  window.getFalabellaFavorites = getFavorites;
  window.toggleProductFavorite = toggleProductFavorite;
  window.isProductFavorited = isProductFavorited;
  window.showGlobalToast = showGlobalToast;
  window.updateFalabellaHeaderGreeting = updateHeaderGreeting;
  window.syncAllHeartIcons = syncAllHeartIcons;

  // Intercept openAccountDropdownOrModal if called directly from inline onclicks
  window.openAccountDropdownOrModal = function () {
    window.openFalabellaAuthOrAccount();
  };
  window.toggleStoreFavorites = function () {
    window.openFalabellaFavoritesModal();
  };

  // ============================================================
  // INITIALIZE ON DOM READY
  // ============================================================
  // ============================================================
  // CART FUNCTIONS INTERCEPTION & CLICK CAPTURE GUARD
  // ============================================================
  function wrapCartFunction(fnName) {
    if (typeof window[fnName] === 'function' && !window[fnName].__falabellaAuthWrapped) {
      const original = window[fnName];
      const wrapped = function (...args) {
        if (!requireAuthForAction('cart')) {
          return false;
        }
        return original.apply(this, args);
      };
      wrapped.__falabellaAuthWrapped = true;
      wrapped.__original = original;
      window[fnName] = wrapped;
    }
  }

  function applyCartInterceptors() {
    ['addToCart', 'addToStoreCart', 'addToTechCart'].forEach(wrapCartFunction);
  }

  // Intercept global clicks in capture phase before inline handlers fire
  document.addEventListener('click', function (e) {
    const user = getSession();
    if (user) return; // User is logged in, allow action

    // 1. Intercept Favorite heart buttons
    const favBtn = e.target.closest('.falabella-card-fav-btn, [data-fav-prod-id], [onclick*="toggleProductFavorite"], [onclick*="toggleWishlist"]');
    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      requireAuthForAction('favorites');
      return;
    }

    // 2. Intercept Add To Cart buttons
    const cartBtn = e.target.closest('[onclick*="addToCart"], [onclick*="addToStoreCart"], [onclick*="addToTechCart"], [onclick*="addFavItemToCart"], [onclick*="addAllFavoritesToCart"]');
    if (cartBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      requireAuthForAction('cart');
      return;
    }
  }, true);

  function bootFalabellaSuite() {
    ensureModalsInDOM();
    applyCartInterceptors();
    updateHeaderGreeting();
    updateFavoritesBadge();
    syncAllHeartIcons();

    // Listen for storage changes across tabs or window events
    window.addEventListener('storage', function (e) {
      if (e.key === SESSION_KEY || e.key === ACTIVE_FAVS_KEY || e.key === null) {
        updateHeaderGreeting();
        updateFavoritesBadge();
        syncAllHeartIcons();
      }
    });

    window.addEventListener('falabella_session_changed', function () {
      updateHeaderGreeting();
      updateFavoritesBadge();
      syncAllHeartIcons();
    });

    window.addEventListener('falabella_favs_updated', function () {
      updateFavoritesBadge();
      syncAllHeartIcons();
    });
  }

  function checkUrlTriggers() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('openAuth')) {
        window.openFalabellaAuthModal(urlParams.get('openAuth'));
      } else if (urlParams.get('openFavs')) {
        window.openFalabellaFavoritesModal();
      } else if (urlParams.get('openUserMenu')) {
        window.openFalabellaUserMenu();
      }
    } catch (e) {}
  }

  function startSuite() {
    bootFalabellaSuite();
    checkUrlTriggers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSuite);
  } else {
    startSuite();
  }

  // Periodic resync to handle dynamically rendered products
  setInterval(() => {
    updateHeaderGreeting();
    updateFavoritesBadge();
    syncAllHeartIcons();
    applyCartInterceptors();
  }, 1000);

})();
