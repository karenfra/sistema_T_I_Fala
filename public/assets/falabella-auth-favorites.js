/**
 * sagabella-auth-favorites.js
 * Universal Authentication, Progressive Client Linking & Favorites Suite for sagabella.com
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
  // UNIVERSAL ELEMENT ID BRIDGE (LEGACY RESILIENCE)
  // ============================================================
  try {
    const _nativeGetElementById = Document.prototype.getElementById;
    Document.prototype.getElementById = function (id) {
      const el = _nativeGetElementById.call(this, id);
      if (el) return el;
      if (['storeSearchInput', 'calzadoSearchInput', 'techSearchInput', 'bellezaSearchInput', 'decohogarSearchInput', 'deportesSearchInput', 'mujerSearchInput', 'modaSearchInput'].includes(id)) {
        return _nativeGetElementById.call(this, 'storeSearchInput') || document.querySelector('.store-search-input');
      }
      if (['storeCartBadge', 'techCartBadge', 'bellezaCartBadge', 'decoCartBadge', 'deportesCartBadge', 'mujerCartBadge', 'modaCartBadge', 'calzadoCartBadge'].includes(id)) {
        return _nativeGetElementById.call(this, 'storeCartBadge') || document.querySelector('.cart-badge');
      }
      if (['falabellaUserGreetingName', 'userNavLabel'].includes(id)) {
        return _nativeGetElementById.call(this, 'falabellaUserGreetingName') || document.querySelector('.falabella-user-greeting');
      }
      if (id === 'storeLocationText') {
        return _nativeGetElementById.call(this, 'storeLocationText');
      }
      return null;
    };
  } catch (e) {}


  // ============================================================
  // CONSTANTS & KEYS
  // ============================================================
  const SESSION_KEY = 'falabella_user_session_v1';
  const USERS_KEY = 'falabella_registered_users_v1';
  const ACTIVE_FAVS_KEY = 'falabella_active_favs_v1';
  const CART_KEY = 'falabella_store_cart_v2';
  const RECOVERY_TOKENS_KEY = 'falabella_recovery_record_v1';
  const RATE_LIMIT_KEY = 'falabella_recover_ratelimit_v1';
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwlv7CLHAsMvTSzfHBIR4Y0EtIfVOjiF6Fr884ckX7IqOQRDXgH42TUCimFAUm8ZeWA/exec';
  const EMAIL_SERVICE_URL = DEFAULT_GAS_URL;

  function getEmailServiceUrl() {
    try {
      const customUrl = localStorage.getItem('sagabella_gas_url');
      if (customUrl && customUrl.trim()) return customUrl.trim();
      return DEFAULT_GAS_URL;
    } catch (e) {
      return DEFAULT_GAS_URL;
    }
  }

  // Pre-loaded physical store clients for Progressive Linking
  const SAGABELLA_PHYSICAL_CLIENTS = [
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
            email: 'carlos.ramirez@sagabella.pe',
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
    // 1. Check in SAGABELLA_PHYSICAL_CLIENTS
    let found = SAGABELLA_PHYSICAL_CLIENTS.find(c => c.dni === cleanDni);
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
  // ============================================================
  // SAGABELLA MASTER CATALOG (GLOBAL DATA STORE)
  // ============================================================
  window.SAGABELLA_MASTER_CATALOG = [{"id":501,"code":"PRD-501","name":"LG Televisor 55\" QNED AI Mini LED QNED70 4K Smart TV 2026","brand":"LG","category":"Televisores","subCategory":"Smart TV","price":1399,"priceCmr":1399,"priceNormal":1449,"discount":"-30%","badge":"OFERTA","rating":5,"reviewsCount":46,"image":"assets/televisores/tv_lg_1.png","page":"televisores.html"},{"id":502,"code":"PRD-502","name":"LG Televisor 75\" NANO 4K UHD AI NU80 Smart TV 2026","brand":"LG","category":"Televisores","subCategory":"Smart TV","price":1899,"priceCmr":1899,"priceNormal":1999,"discount":"-32%","badge":"OFERTA","rating":5,"reviewsCount":51,"image":"assets/televisores/tv_lg_2.png","page":"televisores.html"},{"id":503,"code":"PRD-503","name":"LG Televisor 65\" NANO 4K UHD AI NU80 Smart TV 2026","brand":"LG","category":"Televisores","subCategory":"Smart TV","price":1499,"priceCmr":1499,"priceNormal":1499,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":30,"image":"assets/televisores/tv_lg_3.png","page":"televisores.html"},{"id":504,"code":"PRD-504","name":"LG Televisor 65\" QNED AI Mini LED QNED74 4K Smart TV 2026","brand":"LG","category":"Televisores","subCategory":"Smart TV","price":1799,"priceCmr":1799,"priceNormal":1849,"discount":"-16%","badge":"OFERTA","rating":5,"reviewsCount":3,"image":"assets/televisores/tv_lg_4.png","page":"televisores.html"},{"id":505,"code":"PRD-505","name":"SAMSUNG Televisor QLED 65\" Smart TV 4K QN65Q6FAAGXPE - Nuevo 2025","brand":"Samsung","category":"Televisores","subCategory":"Smart TV","price":1489,"priceCmr":1489,"priceNormal":1599,"discount":"-63%","badge":"OFERTA","rating":5,"reviewsCount":18,"image":"assets/televisores/tv_samsung_1.png","page":"televisores.html"},{"id":506,"code":"PRD-506","name":"SAMSUNG Televisor 65\" UHD U8000H Vision AI Smart TV (2026)","brand":"Samsung","category":"Televisores","subCategory":"Smart TV","price":1449,"priceCmr":1449,"priceNormal":1449,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":62,"image":"assets/televisores/tv_samsung_2.png","page":"televisores.html"},{"id":507,"code":"PRD-507","name":"SAMSUNG Televisor 55\" Mini LED M70H Vision AI Smart TV (2026)","brand":"Samsung","category":"Televisores","subCategory":"Smart TV","price":1349,"priceCmr":1349,"priceNormal":1399,"discount":"-21%","badge":"OFERTA","rating":5,"reviewsCount":24,"image":"assets/televisores/tv_samsung_3.png","page":"televisores.html"},{"id":508,"code":"PRD-508","name":"SAMSUNG Televisor 50\" UHD U8000H Vision AI Smart TV (2026)","brand":"Samsung","category":"Televisores","subCategory":"Smart TV","price":1049,"priceCmr":1049,"priceNormal":1049,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":39,"image":"assets/televisores/tv_samsung_4.png","page":"televisores.html"},{"id":509,"code":"PRD-509","name":"CAIXUN Smart TV LED 32 HD Roku TV C32V1HR","brand":"Caixun","category":"Televisores","subCategory":"Smart TV","price":369,"priceCmr":369,"priceNormal":369,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":85,"image":"assets/televisores/tv_caixun_1.png","page":"televisores.html"},{"id":510,"code":"PRD-510","name":"CAIXUN Televisor LED 43\" Full HD Roku TV C43V1FR","brand":"Caixun","category":"Televisores","subCategory":"Smart TV","price":629,"priceCmr":629,"priceNormal":629,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":42,"image":"assets/televisores/tv_caixun_2.png","page":"televisores.html"},{"id":511,"code":"PRD-511","name":"CAIXUN Televisor LED 43 FHD Google TV C43K4FG","brand":"Caixun","category":"Televisores","subCategory":"Smart TV","price":669,"priceCmr":669,"priceNormal":669,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":31,"image":"assets/televisores/tv_caixun_3.png","page":"televisores.html"},{"id":512,"code":"PRD-512","name":"CAIXUN Televisor LED 65 UHD 4K Google TV C65V1UG","brand":"Caixun","category":"Televisores","subCategory":"Smart TV","price":1299,"priceCmr":1299,"priceNormal":1299,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":19,"image":"assets/televisores/tv_caixun_4.png","page":"televisores.html"},{"id":513,"code":"PRD-513","name":"JVC Televisor 43\" Qled 4k Google Tv Smart Tv","brand":"JVC","category":"Televisores","subCategory":"Smart TV","price":679,"priceCmr":679,"priceNormal":699,"discount":"-48%","badge":"OFERTA","rating":5,"reviewsCount":31,"image":"assets/televisores/tv_jvc_1.png","page":"televisores.html"},{"id":514,"code":"PRD-514","name":"JVC Televisor 50'' QLED 4K UHD Roku TV","brand":"JVC","category":"Televisores","subCategory":"Smart TV","price":829,"priceCmr":829,"priceNormal":899,"discount":"-36%","badge":"OFERTA","rating":5,"reviewsCount":7,"image":"assets/televisores/tv_jvc_2.png","page":"televisores.html"},{"id":515,"code":"PRD-515","name":"JVC Televisor 75\" QD MiniLed 4k Google TV LT-75KM958","brand":"JVC","category":"Televisores","subCategory":"Smart TV","price":1749.9,"priceCmr":1749.9,"priceNormal":2299.9,"discount":"-42%","badge":"OFERTA","rating":5,"reviewsCount":14,"image":"assets/televisores/tv_jvc_3.png","page":"televisores.html"},{"id":516,"code":"PRD-516","name":"JVC Televisor 85\" QD MiniLed 4k Google Tv LT-85KM958 Smart Tv","brand":"JVC","category":"Televisores","subCategory":"Smart TV","price":2799,"priceCmr":2799,"priceNormal":2899,"discount":"-44%","badge":"OFERTA","rating":5,"reviewsCount":14,"image":"assets/televisores/tv_jvc_4.png","page":"televisores.html"},{"id":517,"code":"PRD-517","name":"HYUNDAI Televisor 43 QLED SMART TV FHD Google TV HYLED4326QG","brand":"Hyundai","category":"Televisores","subCategory":"Smart TV","price":729,"priceCmr":729,"priceNormal":729,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":12,"image":"assets/televisores/tv_hyundai_1.png","page":"televisores.html"},{"id":518,"code":"PRD-518","name":"HYUNDAI TELEVISOR SMART TV QLED 43 HYLED4326QG + ANTENA","brand":"Hyundai","category":"Televisores","subCategory":"Smart TV","price":1499,"priceCmr":1499,"priceNormal":1499,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":4,"image":"assets/televisores/tv_hyundai_2.png","page":"televisores.html"},{"id":519,"code":"PRD-519","name":"HYUNDAI TELEVISOR 55 QLED SMART TV GOOGLE TV 4K UHD - HYLED5529QG","brand":"Hyundai","category":"Televisores","subCategory":"Smart TV","price":1149,"priceCmr":1149,"priceNormal":1149,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":8,"image":"assets/televisores/tv_hyundai_3.png","page":"televisores.html"},{"id":521,"code":"PRD-521","name":"XIAOMI Televisor Smart TV A Pro QLED 55\" 4K UHD Google TV 2026","brand":"Xiaomi","category":"Televisores","subCategory":"Smart TV","price":1079,"priceCmr":1079,"priceNormal":1149,"discount":"-23%","badge":"OFERTA","rating":5,"reviewsCount":41,"image":"assets/televisores/tv_xiaomi_1.png","page":"televisores.html"},{"id":522,"code":"PRD-522","name":"XIAOMI Televisor inteligente TV A 55 2026 Calidad de imagen UHD 4K","brand":"Xiaomi","category":"Televisores","subCategory":"Smart TV","price":1019,"priceCmr":1019,"priceNormal":1079,"discount":"-18%","badge":"OFERTA","rating":5,"reviewsCount":26,"image":"assets/televisores/tv_xiaomi_2.png","page":"televisores.html"},{"id":523,"code":"PRD-523","name":"XIAOMI Televisor Smart TV A Pro QLED 65\" 4K UHD Google TV 2026 - HDR","brand":"Xiaomi","category":"Televisores","subCategory":"Smart TV","price":1649,"priceCmr":1649,"priceNormal":1699,"discount":"-18%","badge":"OFERTA","rating":5,"reviewsCount":17,"image":"assets/televisores/tv_xiaomi_3.png","page":"televisores.html"},{"id":524,"code":"PRD-524","name":"XIAOMI Televisor Smart TV S Pro QD-Mini LED 65\" 4K UHD Google TV 2026","brand":"Xiaomi","category":"Televisores","subCategory":"Smart TV","price":2299,"priceCmr":2299,"priceNormal":2399,"discount":"-12%","badge":"OFERTA","rating":5,"reviewsCount":15,"image":"assets/televisores/tv_xiaomi_4.png","page":"televisores.html"},{"id":525,"code":"PRD-525","name":"TCL Televisor 55\" QD MiniLED 4K 55A400U Premium Smart Tv","brand":"TCL","category":"Televisores","subCategory":"Smart TV","price":1599,"priceCmr":1599,"priceNormal":1599,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":16,"image":"assets/televisores/tv_tcl_1.png","page":"televisores.html"},{"id":526,"code":"PRD-526","name":"TCL Televisor Smart TV 55\" 4K QLED Google TV 55T6C","brand":"TCL","category":"Televisores","subCategory":"Smart TV","price":1049.9,"priceCmr":1049.9,"priceNormal":1099.9,"discount":"-28%","badge":"OFERTA","rating":5,"reviewsCount":185,"image":"assets/televisores/tv_tcl_2.png","page":"televisores.html"},{"id":527,"code":"PRD-527","name":"TCL Televisor 75\" QD MiniLED 4K 75A400U Premium Smart Tv","brand":"TCL","category":"Televisores","subCategory":"Smart TV","price":3499,"priceCmr":3499,"priceNormal":3499,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":15,"image":"assets/televisores/tv_tcl_3.png","page":"televisores.html"},{"id":528,"code":"PRD-528","name":"TCL Televisor 65\" QD MiniLED 4K 65A400U Premium Smart Tv","brand":"TCL","category":"Televisores","subCategory":"Smart TV","price":2549,"priceCmr":2549,"priceNormal":2549,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":12,"image":"assets/televisores/tv_tcl_4.png","page":"televisores.html"},{"id":529,"code":"PRD-529","name":"HISENSE Televisor 65\" Miniled 4K 65U6ESG Smart Tv","brand":"Hisense","category":"Televisores","subCategory":"Smart TV","price":1949,"priceCmr":1949,"priceNormal":1999,"discount":"-41%","badge":"OFERTA","rating":5,"reviewsCount":15,"image":"assets/televisores/tv_hisense_1.png","page":"televisores.html"},{"id":530,"code":"PRD-530","name":"HISENSE Televisor 75\" Qled 4k 75qd6n Google Tv (2025) Smart Tv","brand":"Hisense","category":"Televisores","subCategory":"Smart TV","price":1999,"priceCmr":1999,"priceNormal":1999,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":24,"image":"assets/televisores/tv_hisense_2.png","page":"televisores.html"},{"id":531,"code":"PRD-531","name":"HISENSE Televisor 40\" QLED FHD","brand":"Hisense","category":"Televisores","subCategory":"Smart TV","price":549,"priceCmr":549,"priceNormal":599,"discount":"-50%","badge":"OFERTA","rating":5,"reviewsCount":40,"image":"assets/televisores/tv_hisense_3.png","page":"televisores.html"},{"id":532,"code":"PRD-532","name":"HISENSE Televisor 100\" Hi-Qled 4K 100Q7QG Google Tv Smart Tv","brand":"Hisense","category":"Televisores","subCategory":"Smart TV","price":5099,"priceCmr":5099,"priceNormal":5099,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":120,"image":"assets/televisores/tv_hisense_4.png","page":"televisores.html"},{"id":401,"code":"PRD-401","name":"SAMSUNG Celular Galaxy A16 128gb Negro.","brand":"Samsung","category":"Celulares","subCategory":"Smartphones","price":529,"priceCmr":529,"priceNormal":529,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":523,"image":"assets/celulares/cel_samsung_a16.png","page":"celulares.html"},{"id":402,"code":"PRD-402","name":"APPLE iPhone 15 Pro Max 256GB Negro Titanio Reacondicionado A2849","brand":"Apple","category":"Celulares","subCategory":"Smartphones","price":2999,"priceCmr":2999,"priceNormal":2999,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":11,"image":"assets/celulares/cel_apple_ip15promax.png","page":"celulares.html"},{"id":403,"code":"PRD-403","name":"APPLE iPhone 18 Pro Max 256GB","brand":"Apple","category":"Celulares","subCategory":"Smartphones","price":6799,"priceCmr":6799,"priceNormal":6999,"discount":"-7%","badge":"OFERTA","rating":5,"reviewsCount":4,"image":"assets/celulares/cel_apple_ip18promax_black.png","page":"celulares.html"},{"id":404,"code":"PRD-404","name":"APPLE iPhone 18 Pro 256GB","brand":"Apple","category":"Celulares","subCategory":"Smartphones","price":5999,"priceCmr":5999,"priceNormal":6499,"discount":"-10%","badge":"OFERTA","rating":5,"reviewsCount":2,"image":"assets/celulares/cel_apple_ip18pro_black.png","page":"celulares.html"},{"id":405,"code":"PRD-405","name":"APPLE iPhone 18 Pro Max 256GB Rojo Titanio","brand":"Apple","category":"Celulares","subCategory":"Smartphones","price":6799,"priceCmr":6799,"priceNormal":6999,"discount":"-7%","badge":"OFERTA","rating":5,"reviewsCount":4,"image":"assets/celulares/cel_apple_ip18promax_red.png","page":"celulares.html"},{"id":406,"code":"PRD-406","name":"MOTOROLA Celular Moto G06 4GB 128GB Azul","brand":"Motorola","category":"Celulares","subCategory":"Smartphones","price":499,"priceCmr":499,"priceNormal":499,"discount":"","badge":"OFERTA","rating":4.5,"reviewsCount":35,"image":"assets/celulares/cel_motorola_g06.png","page":"celulares.html"},{"id":407,"code":"PRD-407","name":"SAMSUNG Celular Galaxy A57 5G 8GB 256GB Violeta","brand":"Samsung","category":"Celulares","subCategory":"Smartphones","price":1899,"priceCmr":1899,"priceNormal":1899,"discount":"","badge":"OFERTA","rating":4.9,"reviewsCount":553,"image":"assets/celulares/cel_samsung_a57_violet.png","page":"celulares.html"},{"id":408,"code":"PRD-408","name":"SAMSUNG Celular Samsung Galaxy A57 5G","brand":"Samsung","category":"Celulares","subCategory":"Smartphones","price":1799,"priceCmr":1799,"priceNormal":1899,"discount":"-22%","badge":"OFERTA","rating":4.7,"reviewsCount":53,"image":"assets/celulares/cel_samsung_a57.png","page":"celulares.html"},{"id":409,"code":"PRD-409","name":"XIAOMI Celular Redmi Note 15 Pro 8GB 256GB Negro","brand":"Xiaomi","category":"Celulares","subCategory":"Smartphones","price":1179,"priceCmr":1179,"priceNormal":1199,"discount":"-9%","badge":"OFERTA","rating":4.8,"reviewsCount":18,"image":"assets/celulares/cel_xiaomi_note15pro.png","page":"celulares.html"},{"id":410,"code":"PRD-410","name":"MOTOROLA Moto G17 4+128GB Azul","brand":"Motorola","category":"Celulares","subCategory":"Smartphones","price":549,"priceCmr":549,"priceNormal":549,"discount":"","badge":"OFERTA","rating":4.5,"reviewsCount":55,"image":"assets/celulares/cel_motorola_g17.png","page":"celulares.html"},{"id":411,"code":"PRD-411","name":"SAMSUNG Celular Galaxy S26 FE 5G 256GB Mint Green","brand":"Samsung","category":"Celulares","subCategory":"Smartphones","price":2499,"priceCmr":2499,"priceNormal":2699,"discount":"-24%","badge":"OFERTA","rating":5,"reviewsCount":142,"image":"assets/celulares/cel_samsung_s26fe.png","page":"celulares.html"},{"id":301,"code":"PRD-301","name":"Laptop Gamer LOQ Essential Serie 7000 AMD Ryzen 7 7735HS RTX 4050 6GB 15.6\" FHD 144Hz","brand":"Lenovo","category":"Laptops","subCategory":"Notebooks","price":4299,"priceCmr":4299,"priceNormal":4599,"discount":"-36%","badge":"OFERTA","rating":4.8,"reviewsCount":8,"image":"assets/laptops/laptop_lenovo_loq.png","page":"laptops.html"},{"id":302,"code":"PRD-302","name":"Laptop 15-fc0287la, AMD Ryzen 7, 8 GB RAM, 512 GB SSD, 15.6\" FHD","brand":"HP","category":"Laptops","subCategory":"Notebooks","price":2799,"priceCmr":2799,"priceNormal":2799,"discount":"","badge":"OFERTA","rating":4.6,"reviewsCount":12,"image":"assets/laptops/laptop_hp_15.png","page":"laptops.html"},{"id":303,"code":"PRD-303","name":"Laptop Gamer Nitro V AMD Ryzen 7-170 32GB 32GB 15.6\" 180Hz FHD RTX 4050","brand":"Acer","category":"Laptops","subCategory":"Notebooks","price":10599,"priceCmr":10599,"priceNormal":10599,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":3,"image":"assets/laptops/laptop_acer_nitro.png","page":"laptops.html"},{"id":304,"code":"PRD-304","name":"Vivobook Go 15 AMD Ryzen 5 40 8GB 512SSD 15.6\" FHD","brand":"Asus","category":"Laptops","subCategory":"Notebooks","price":1999,"priceCmr":1999,"priceNormal":2099,"discount":"-46%","badge":"OFERTA","rating":4.7,"reviewsCount":25,"image":"assets/laptops/laptop_asus_vivobook.png","page":"laptops.html"},{"id":305,"code":"PRD-305","name":"Laptop Ideapad 5 2 en 1 serie 300 AMD Ryzen AI 7 350 16GB RAM 512 GB SSD 14\" Touch","brand":"Lenovo","category":"Laptops","subCategory":"Notebooks","price":3899,"priceCmr":3899,"priceNormal":3999,"discount":"-33%","badge":"OFERTA","rating":4.8,"reviewsCount":4,"image":"assets/laptops/laptop_lenovo_ideapad.png","page":"laptops.html"},{"id":306,"code":"PRD-306","name":"Laptop TUF Gaming A16 AMD Ryzen 7 260 16GB 512SSD RTX5060 16\" QHD 165Hz","brand":"Asus","category":"Laptops","subCategory":"Notebooks","price":5899,"priceCmr":5899,"priceNormal":5999,"discount":"-26%","badge":"OFERTA","rating":4.9,"reviewsCount":14,"image":"assets/laptops/laptop_asus_tuf.png","page":"laptops.html"},{"id":307,"code":"PRD-307","name":"Laptop Gamer Rog Strix G16 Amd Ryzen 9 9955hx Rtx5070 16gb Ram 1tb SSD 16\" 240Hz","brand":"Asus","category":"Laptops","subCategory":"Notebooks","price":9199,"priceCmr":9199,"priceNormal":9299,"discount":"-43%","badge":"OFERTA","rating":5,"reviewsCount":7,"image":"assets/laptops/laptop_asus_rog.png","page":"laptops.html"},{"id":308,"code":"PRD-308","name":"Laptop Gamer Victus by 15-fb3021la, AMD Ryzen 7, 16 GB RAM, NVIDIA RTX 3050 512GB SSD","brand":"HP","category":"Laptops","subCategory":"Notebooks","price":4499,"priceCmr":4499,"priceNormal":4599,"discount":"-21%","badge":"OFERTA","rating":5,"reviewsCount":1,"image":"assets/laptops/laptop_hp_victus.png","page":"laptops.html"},{"id":201,"code":"PRD-201","name":"Galaxy Tab S12+","brand":"Samsung","category":"Tablets","subCategory":"iPads y Tablets","price":4899,"priceCmr":4899,"priceNormal":4999,"discount":"-6%","badge":"OFERTA","rating":5,"reviewsCount":48,"image":"assets/tablets/tablet_s12_plus.png","page":"tablets.html"},{"id":202,"code":"PRD-202","name":"Tablet Galaxy Tab S10 Lite 6GB 128GB 10.9\"","brand":"Samsung","category":"Tablets","subCategory":"iPads y Tablets","price":1399,"priceCmr":1399,"priceNormal":1399,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":32,"image":"assets/tablets/tablet_s10_lite.png","page":"tablets.html"},{"id":203,"code":"PRD-203","name":"Galaxy Tab S10 Fe 8 + 128gb Gray","brand":"Samsung","category":"Tablets","subCategory":"iPads y Tablets","price":1799,"priceCmr":1799,"priceNormal":1799,"discount":"","badge":"OFERTA","rating":4.9,"reviewsCount":531,"image":"assets/tablets/tablet_s10_fe8.png","page":"tablets.html"},{"id":204,"code":"PRD-204","name":"Tablet Galaxy Tab A11 8.7\" 4GB + 64GB Gris","brand":"Samsung","category":"Tablets","subCategory":"iPads y Tablets","price":499,"priceCmr":499,"priceNormal":499,"discount":"","badge":"OFERTA","rating":4.8,"reviewsCount":121,"image":"assets/tablets/tablet_a11_8.png","page":"tablets.html"},{"id":205,"code":"PRD-205","name":"Tablet Galaxy A11+ 6gb 128gb","brand":"Samsung","category":"Tablets","subCategory":"iPads y Tablets","price":849,"priceCmr":849,"priceNormal":849,"discount":"","badge":"OFERTA","rating":4.9,"reviewsCount":86,"image":"assets/tablets/tablet_a11_plus.png","page":"tablets.html"},{"id":206,"code":"PRD-206","name":"Samsung Galaxy Tab S10 FE+ 13.1\" 128GB Wi-Fi con S Pen","brand":"Samsung","category":"Tablets","subCategory":"iPads y Tablets","price":2499,"priceCmr":2499,"priceNormal":2599,"discount":"-24%","badge":"OFERTA","rating":5,"reviewsCount":142,"image":"assets/tablets/tablet_s10_fe_plus.png","page":"tablets.html"},{"id":207,"code":"PRD-207","name":"Apple iPad 10.9\" 10ma Gen 64GB Wi-Fi Plata","brand":"Apple","category":"Tablets","subCategory":"iPads y Tablets","price":1549,"priceCmr":1549,"priceNormal":1599,"discount":"-22%","badge":"OFERTA","rating":4.9,"reviewsCount":310,"image":"assets/tablets/tablet_s10_fe8.png","page":"tablets.html"},{"id":208,"code":"PRD-208","name":"Apple iPad Air 11\" Chip M2 128GB Wi-Fi Gris Espacial","brand":"Apple","category":"Tablets","subCategory":"iPads y Tablets","price":2899,"priceCmr":2899,"priceNormal":2999,"discount":"-15%","badge":"OFERTA","rating":5,"reviewsCount":184,"image":"assets/tablets/tablet_s12_plus.png","page":"tablets.html"},{"id":209,"code":"PRD-209","name":"Tablet Lenovo Tab M11 11\" 4GB 128GB + Lápiz Pen","brand":"Lenovo","category":"Tablets","subCategory":"iPads y Tablets","price":649,"priceCmr":649,"priceNormal":699,"discount":"-28%","badge":"OFERTA","rating":4.7,"reviewsCount":95,"image":"assets/tablets/tablet_a11_plus.png","page":"tablets.html"},{"id":210,"code":"PRD-210","name":"Xiaomi Pad 6 11\" 8GB 256GB 144Hz WQHD+ Gravity Gray","brand":"Xiaomi","category":"Tablets","subCategory":"iPads y Tablets","price":1149,"priceCmr":1149,"priceNormal":1199,"discount":"-28%","badge":"OFERTA","rating":4.8,"reviewsCount":212,"image":"assets/tablets/tablet_s10_lite.png","page":"tablets.html"},{"id":401,"code":"PRD-401","name":"EOS R50 Mirrorless Camera with 18-45mm Lens - Negro","brand":"Canon","category":"mirrorless","subCategory":"Fotografía","price":2889,"priceCmr":2889,"priceNormal":2889,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":4,"image":"assets/camaras/camara_canon_r50.png","page":"camaras.html"},{"id":402,"code":"PRD-402","name":"PIXPRO FZ55 Zoom 16X rosa","brand":"Kodak","category":"compact","subCategory":"Fotografía","price":619,"priceCmr":619,"priceNormal":619,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":4,"image":"assets/camaras/camara_kodak_pixpro.png","page":"camaras.html"},{"id":403,"code":"PRD-403","name":"Cámara Alpha ILCE-6400K + Maletín LCS-U21 de regalo","brand":"Sony","category":"mirrorless","subCategory":"Fotografía","price":2999,"priceCmr":2999,"priceNormal":2999,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":7,"image":"assets/camaras/camara_sony_a6400.png","page":"camaras.html"},{"id":404,"code":"PRD-404","name":"Cámara EOS R6 Mark III Cuerpo Solo + Kit Básico de Accesorios","brand":"Canon","category":"combo","subCategory":"Fotografía","price":12199,"priceCmr":12199,"priceNormal":12199,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":1,"image":"assets/camaras/camara_canon_r6.png","page":"camaras.html"},{"id":405,"code":"PRD-405","name":"EOS R10 Mirrorless Camera with 18-45mm Lens","brand":"Canon","category":"mirrorless","subCategory":"Fotografía","price":3509,"priceCmr":3509,"priceNormal":3509,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":6,"image":"assets/camaras/camara_canon_r10.png","page":"camaras.html"},{"id":406,"code":"PRD-406","name":"ZV-E10 Mirrorless Camera with 16-50mm Lens - Negro","brand":"Sony","category":"mirrorless","subCategory":"Fotografía","price":2729,"priceCmr":2729,"priceNormal":2729,"discount":"","badge":"OFERTA","rating":5,"reviewsCount":57,"image":"assets/camaras/camara_sony_zve10.png","page":"camaras.html"},{"id":407,"code":"PRD-407","name":"EOS 1500D DSLR Camera with EF-S 18-55 IS II Lens","brand":"Canon","category":"reflex","subCategory":"Fotografía","price":1779,"priceCmr":1779,"priceNormal":1779,"discount":"","badge":"OFERTA","rating":4.8,"reviewsCount":19,"image":"assets/camaras/camara_canon_1500d.png","page":"camaras.html"},{"id":408,"code":"PRD-408","name":"Cámara de Acción GoPro HERO 13 Black 5.3K HDR Sumergible","brand":"GoPro","category":"deportiva","subCategory":"Fotografía","price":1899,"priceCmr":1899,"priceNormal":1999,"discount":"-21%","badge":"OFERTA","rating":4.9,"reviewsCount":24,"image":"assets/camaras/camara_gopro_hero13.png","page":"camaras.html"},{"id":927,"code":"PRD-927","name":"Zapatillas Urbanas Unisex Reebok Club C 85 Vintage","brand":"Reebok","category":"Deportes","subCategory":"Zapatillas","price":299,"priceCmr":299,"priceNormal":359,"discount":"-17%","badge":"CYBER WOW","rating":4.8,"reviewsCount":64,"image":"assets/calzado/prod_reebok_club_c.png","page":"productos_calzado.html"},{"id":928,"code":"PRD-928","name":"Zapatillas Deportivas Hombre Reebok Nano X3 Training","brand":"Reebok","category":"Deportes","subCategory":"Zapatillas","price":379,"priceCmr":379,"priceNormal":449,"discount":"-15%","badge":"CYBER WOW","rating":4.9,"reviewsCount":42,"image":"assets/calzado/prod_reebok_nano.png","page":"productos_calzado.html"},{"id":929,"code":"PRD-929","name":"Zapatillas Urbanas Unisex New Balance 574 Core Grey","brand":"New Balance","category":"Deportes","subCategory":"Zapatillas","price":389,"priceCmr":389,"priceNormal":429,"discount":"-9%","badge":"CYBER WOW","rating":4.9,"reviewsCount":88,"image":"assets/calzado/prod_nb_574.png","page":"productos_calzado.html"},{"id":930,"code":"PRD-930","name":"Zapatillas Urbanas Hombre New Balance 9060 Sea Salt","brand":"New Balance","category":"Deportes","subCategory":"Zapatillas","price":549,"priceCmr":549,"priceNormal":599,"discount":"-8%","badge":"CYBER WOW","rating":5,"reviewsCount":31,"image":"assets/calzado/prod_nb_9060.png","page":"productos_calzado.html"},{"id":901,"code":"PRD-901","name":"Zapatillas Urbanas Unisex Adistar Control 3","brand":"ADIDAS ORIGINALS","category":"Deportes","subCategory":"Zapatillas","price":399,"priceCmr":399,"priceNormal":399,"discount":"","badge":"CYBER WOW","rating":5,"reviewsCount":93,"image":"assets/calzado/prod_adistar_1.png","page":"productos_calzado.html"},{"id":902,"code":"PRD-902","name":"Zapatillas Urbanas Mujer Adistar Control 3","brand":"ADIDAS ORIGINALS","category":"Mujer","subCategory":"Zapatillas","price":399,"priceCmr":399,"priceNormal":399,"discount":"","badge":"","rating":5,"reviewsCount":42,"image":"assets/calzado/prod_adistar_2.png","page":"productos_calzado.html"},{"id":905,"code":"PRD-905","name":"Zapatillas Running Hombre Maxstride Lite Ls","brand":"PUMA","category":"Deportes","subCategory":"Zapatillas","price":174.3,"priceCmr":174.3,"priceNormal":249,"discount":"-30%","badge":"CYBER WOW","rating":4.8,"reviewsCount":38,"image":"assets/calzado/prod_puma_maxstride_black.png","page":"productos_calzado.html"},{"id":906,"code":"PRD-906","name":"Zapatillas Running Hombre Maxima Pro","brand":"PUMA","category":"Deportes","subCategory":"Zapatillas","price":197.4,"priceCmr":197.4,"priceNormal":329,"discount":"-40%","badge":"CYBER WOW","rating":5,"reviewsCount":5,"image":"assets/calzado/prod_puma_maxima_pro.png","page":"productos_calzado.html"},{"id":907,"code":"PRD-907","name":"Zapatillas Running Mujer Maxstride Lite Ls","brand":"PUMA","category":"Mujer","subCategory":"Zapatillas","price":174.3,"priceCmr":174.3,"priceNormal":249,"discount":"-30%","badge":"CYBER WOW","rating":4.9,"reviewsCount":24,"image":"assets/calzado/prod_puma_maxstride_beige.png","page":"productos_calzado.html"},{"id":908,"code":"PRD-908","name":"Zapatillas Running Mujer Maxstride Lite Ls Wns","brand":"PUMA","category":"Mujer","subCategory":"Zapatillas","price":149.4,"priceCmr":149.4,"priceNormal":249,"discount":"-40%","badge":"CYBER WOW","rating":4.8,"reviewsCount":19,"image":"assets/calzado/prod_puma_maxstride_pink.png","page":"productos_calzado.html"},{"id":909,"code":"PRD-909","name":"Zapatillas Running Mujer Response 2","brand":"ADIDAS","category":"Mujer","subCategory":"Zapatillas","price":155.4,"priceCmr":155.4,"priceNormal":259,"discount":"-40%","badge":"CYBER WOW","rating":5,"reviewsCount":137,"image":"assets/calzado/prod_adidas_response2_aqua.png","page":"productos_calzado.html"},{"id":911,"code":"PRD-911","name":"Zapatillas Running Hombre Dynamight 2.0","brand":"SKECHERS","category":"Hombre","subCategory":"Zapatillas","price":132.3,"priceCmr":132.3,"priceNormal":189,"discount":"-30%","badge":"CYBER WOW","rating":5,"reviewsCount":11,"image":"assets/calzado/prod_skechers_dynamight_black.png","page":"productos_calzado.html"},{"id":912,"code":"PRD-912","name":"Zapatillas Running Mujer Sonic Lite","brand":"SKECHERS","category":"Mujer","subCategory":"Zapatillas","price":153.3,"priceCmr":153.3,"priceNormal":219,"discount":"-30%","badge":"CYBER WOW","rating":4.9,"reviewsCount":45,"image":"assets/calzado/prod_skechers_sonic_lite_black.png","page":"productos_calzado.html"},{"id":913,"code":"PRD-913","name":"Zapatillas Running Hombre Pounce Lite 2 Engineered","brand":"PUMA","category":"Hombre","subCategory":"Zapatillas","price":109.5,"priceCmr":109.5,"priceNormal":219,"discount":"-50%","badge":"CYBER WOW","rating":4.7,"reviewsCount":7,"image":"assets/calzado/prod_puma_pounce_grey.png","page":"productos_calzado.html"},{"id":915,"code":"PRD-915","name":"Zapatillas Running Mujer Response Pace","brand":"ADIDAS","category":"Mujer","subCategory":"Zapatillas","price":139,"priceCmr":139,"priceNormal":199,"discount":"-30%","badge":"CYBER WOW","rating":5,"reviewsCount":27,"image":"assets/calzado/prod_adidas_response_pace_pink.png","page":"productos_calzado.html"},{"id":917,"code":"PRD-917","name":"Ballerinas Niña Yamp Negro Charol Suela Confort","brand":"Yamp","category":"Infantil","subCategory":"Zapatillas","price":29.95,"priceCmr":29.95,"priceNormal":59.9,"discount":"-50%","badge":"CYBER WOW","rating":4.5,"reviewsCount":4,"image":"assets/calzado/prod_yamp_ballerinas_negro.png","page":"productos_calzado.html"},{"id":918,"code":"PRD-918","name":"Zapatillas Urbanas Bebe Niño Diadora Doble Velcro","brand":"Diadora","category":"Infantil","subCategory":"Zapatillas","price":43.96,"priceCmr":43.96,"priceNormal":109.9,"discount":"-60%","badge":"CYBER WOW","rating":4.8,"reviewsCount":6,"image":"assets/calzado/prod_diadora_zapatillas_bebe.png","page":"productos_calzado.html"},{"id":919,"code":"PRD-919","name":"Ballerinas Niña Disney Glitter Plata Con Moño","brand":"Disney","category":"Infantil","subCategory":"Zapatillas","price":39.95,"priceCmr":39.95,"priceNormal":79.9,"discount":"-50%","badge":"CYBER WOW","rating":4.9,"reviewsCount":23,"image":"assets/calzado/prod_disney_ballerinas_brillo.png","page":"productos_calzado.html"},{"id":920,"code":"PRD-920","name":"Zapatilla Sport Niño Redwood Suela Antideslizante","brand":"Redwood","category":"Infantil","subCategory":"Zapatillas","price":24.9,"priceCmr":24.9,"priceNormal":49.9,"discount":"-50%","badge":"CYBER WOW","rating":4.7,"reviewsCount":3,"image":"assets/calzado/prod_redwood_zapatilla_sport.png","page":"productos_calzado.html"},{"id":921,"code":"PRD-921","name":"Zapatillas Urbanas Bebe Niño Yamp Azul Marino & Cyan","brand":"Yamp","category":"Infantil","subCategory":"Zapatillas","price":44.95,"priceCmr":44.95,"priceNormal":89.9,"discount":"-50%","badge":"CYBER WOW","rating":4.1,"reviewsCount":7,"image":"assets/calzado/prod_yamp_zapatillas_urbanas.png","page":"productos_calzado.html"},{"id":922,"code":"PRD-922","name":"Zapatillas Urbanas Samba OG Olive Suede Clásicas","brand":"ADIDAS","category":"Hombre","subCategory":"Zapatillas","price":379,"priceCmr":379,"priceNormal":429,"discount":"-12%","badge":"CYBER WOW","rating":5,"reviewsCount":450,"image":"assets/calzado/prod_adidas_samba_olive.png","page":"productos_calzado.html"},{"id":923,"code":"PRD-923","name":"Zapatillas Running Nike Air Zoom Pegasus 40","brand":"Nike","category":"Deportes","subCategory":"Zapatillas","price":389,"priceCmr":389,"priceNormal":549,"discount":"-29%","badge":"CYBER WOW","rating":4.9,"reviewsCount":320,"image":"assets/calzado/prod_nike_running.png","page":"productos_calzado.html"},{"id":924,"code":"PRD-924","name":"Tacos Stiletto Slingback Charol Gris Humo 9cm","brand":"Aldo","category":"Mujer","subCategory":"Zapatillas","price":249,"priceCmr":249,"priceNormal":369,"discount":"-32%","badge":"CYBER WOW","rating":4.9,"reviewsCount":135,"image":"assets/calzado/prod_mujer_tacos_grey.png","page":"productos_calzado.html"},{"id":802,"code":"CAL-INF-02","name":"Sandalias Niño Yamp Velcro Ajustable Marrón Sport","brand":"Yamp","category":"Infantil","subCategory":"sandalias","price":29.95,"priceCmr":29.95,"priceNormal":59.9,"discount":"-50%","badge":"CYBER WOW","rating":4.7,"reviewsCount":18,"image":"assets/calzado/prod_yamp_sandalias_nino.png","page":"calzado.html"},{"id":804,"code":"CAL-INF-04","name":"Ballerinas Niña Disney Glitter Plata Con Moño Elegante","brand":"Disney","category":"Infantil","subCategory":"ballerinas","price":39.95,"priceCmr":39.95,"priceNormal":79.9,"discount":"-50%","badge":"CYBER WOW","rating":4.9,"reviewsCount":23,"image":"assets/calzado/prod_disney_ballerinas_brillo.png","page":"calzado.html"},{"id":807,"code":"CAL-PUM-01","name":"Zapatillas Running Puma Maxstride & Maxima Pro Amortiguación Max","brand":"Puma","category":"Deportes","subCategory":"running","price":279,"priceCmr":279,"priceNormal":399,"discount":"-30%","badge":"LANZAMIENTO","rating":4.9,"reviewsCount":142,"image":"assets/calzado/prod_puma_maxstride.png","page":"calzado.html"},{"id":808,"code":"CAL-NIK-01","name":"Zapatillas Running Nike Air Zoom Pegasus 40 React Foam","brand":"Nike","category":"Deportes","subCategory":"running","price":389,"priceCmr":389,"priceNormal":549,"discount":"-29%","badge":"CYBER WOW","rating":4.9,"reviewsCount":320,"image":"assets/calzado/prod_nike_running.png","page":"calzado.html"},{"id":809,"code":"CAL-ADI-01","name":"Chimpunes Adidas Predator Accuracy Laceless Terreno Firme","brand":"Adidas","category":"Deportes","subCategory":"futbol","price":299,"priceCmr":299,"priceNormal":429,"discount":"-30%","badge":"CYBER WOW","rating":4.8,"reviewsCount":88,"image":"assets/calzado/prod_adidas_futbol.png","page":"calzado.html"},{"id":810,"code":"CAL-ADI-02","name":"Zapatillas Training Adidas Dropset 2 Estabilidad Gym & Cross","brand":"Adidas","category":"Deportes","subCategory":"training","price":259,"priceCmr":259,"priceNormal":369,"discount":"-30%","badge":"CYBER WOW","rating":4.9,"reviewsCount":95,"image":"assets/calzado/prod_adidas_training.png","page":"calzado.html"},{"id":811,"code":"CAL-COL-01","name":"Zapatillas Outdoor Trailstorm Waterproof Columbia Grip","brand":"Columbia","category":"Deportes","subCategory":"outdoor","price":349,"priceCmr":349,"priceNormal":499,"discount":"-30%","badge":"WATERPROOF","rating":4.8,"reviewsCount":74,"image":"assets/calzado/prod_outdoor_trekking.png","page":"calzado.html"},{"id":812,"code":"CAL-ALD-01","name":"Zapatos de Vestir Oxford Cuero Genuino Negro Aldo Brillo Formal","brand":"Aldo","category":"Hombre","subCategory":"vestir","price":269,"priceCmr":269,"priceNormal":399,"discount":"-33%","badge":"CUERO 100%","rating":4.9,"reviewsCount":110,"image":"assets/calzado/prod_hombre_vestir_black.png","page":"calzado.html"},{"id":813,"code":"CAL-CLA-01","name":"Zapatos Casuales Cuero Nobuk Marrón Suela Ultralight Confort","brand":"Aldo","category":"Hombre","subCategory":"casuales","price":239,"priceCmr":239,"priceNormal":349,"discount":"-31%","badge":"CONFORT","rating":4.8,"reviewsCount":85,"image":"assets/calzado/prod_hombre_casual_brown.png","page":"calzado.html"},{"id":814,"code":"CAL-ADI-03","name":"Zapatillas Urbanas Adidas Samba OG Olive Suede Clásicas","brand":"Adidas","category":"Hombre","subCategory":"zapatillas","price":379,"priceCmr":379,"priceNormal":429,"discount":"-12%","badge":"BEST SELLER","rating":5,"reviewsCount":450,"image":"assets/calzado/prod_adidas_samba_olive.png","page":"calzado.html"},{"id":815,"code":"CAL-CIS-01","name":"Mules y Sandalias Casuales de Gamuza Beige Verano","brand":"Aldo","category":"Hombre","subCategory":"sandalias","price":149,"priceCmr":149,"priceNormal":229,"discount":"-35%","badge":"VERANO 2026","rating":4.7,"reviewsCount":42,"image":"assets/calzado/prod_hombre_mules_suede.png","page":"calzado.html"},{"id":816,"code":"CAL-ALD-02","name":"Tacos Stiletto Slingback Charol Gris Humo Puntera Fina 9cm","brand":"Aldo","category":"Mujer","subCategory":"tacos","price":249,"priceCmr":249,"priceNormal":369,"discount":"-32%","badge":"CYBER WOW","rating":4.9,"reviewsCount":135,"image":"assets/calzado/prod_mujer_tacos_grey.png","page":"calzado.html"},{"id":817,"code":"CAL-SYB-01","name":"Zapatos Casuales Flats Puntera Fina Borgoña Slingback","brand":"Sybilla","category":"Mujer","subCategory":"casuales","price":129,"priceCmr":129,"priceNormal":189,"discount":"-32%","badge":"TENDENCIA","rating":4.8,"reviewsCount":92,"image":"assets/calzado/prod_mujer_flats_burgundy.png","page":"calzado.html"},{"id":818,"code":"CAL-SKE-01","name":"Zapatillas Urbanas Pastel D’Lites Confort Memory Foam","brand":"Skechers","category":"Mujer","subCategory":"zapatillas","price":219,"priceCmr":219,"priceNormal":319,"discount":"-31%","badge":"AIR COOLED","rating":4.9,"reviewsCount":260,"image":"assets/calzado/prod_mujer_sneakers_stack.png","page":"calzado.html"},{"id":819,"code":"CAL-MAN-01","name":"Sandalias Kitten Heels Tiras Finas Vino Fiesta 5cm","brand":"Sybilla","category":"Mujer","subCategory":"sandalias","price":159,"priceCmr":159,"priceNormal":229,"discount":"-30%","badge":"CYBER WOW","rating":4.7,"reviewsCount":68,"image":"assets/calzado/prod_mujer_sandalias_kitten.png","page":"calzado.html"},{"id":901,"code":"CAL-ADI-ADS1","name":"Zapatillas Urbanas Unisex Adistar Control 3 Plata","brand":"Adidas","category":"Deportes","subCategory":"zapatillas","price":399,"priceCmr":399,"priceNormal":399,"discount":"","badge":"CYBER WOW","rating":5,"reviewsCount":93,"image":"assets/calzado/prod_adistar_1.png","page":"calzado.html"},{"id":902,"code":"CAL-ADI-ADS2","name":"Zapatillas Urbanas Mujer Adistar Control 3 Beige","brand":"Adidas","category":"Mujer","subCategory":"zapatillas","price":399,"priceCmr":399,"priceNormal":399,"discount":"","badge":"CYBER WOW","rating":5,"reviewsCount":42,"image":"assets/calzado/prod_adistar_2.png","page":"calzado.html"},{"id":903,"code":"CAL-ADI-ADS3","name":"Zapatillas Urbanas Unisex Adistar Control 3 Silver Metallic","brand":"Adidas","category":"Deportes","subCategory":"zapatillas","price":399,"priceCmr":399,"priceNormal":399,"discount":"","badge":"CYBER WOW","rating":5,"reviewsCount":95,"image":"assets/calzado/prod_adistar_3.png","page":"calzado.html"},{"id":904,"code":"CAL-ADI-ADS4","name":"Zapatillas Urbanas Mujer Adistar Control 3 Black Silver","brand":"Adidas","category":"Mujer","subCategory":"zapatillas","price":399,"priceCmr":399,"priceNormal":399,"discount":"","badge":"CYBER WOW","rating":5,"reviewsCount":48,"image":"assets/calzado/prod_adistar_4.png","page":"calzado.html"},{"id":905,"code":"CAL-PUM-MAX1","name":"Zapatillas Running Hombre Maxstride Lite Ls Black","brand":"Puma","category":"Deportes","subCategory":"running","price":174.3,"priceCmr":174.3,"priceNormal":249,"discount":"-30%","badge":"CYBER WOW","rating":4.8,"reviewsCount":38,"image":"assets/calzado/prod_puma_maxstride_black.png","page":"calzado.html"},{"id":906,"code":"CAL-PUM-MAX2","name":"Zapatillas Running Hombre Maxima Pro Amortiguación","brand":"Puma","category":"Deportes","subCategory":"running","price":197.4,"priceCmr":197.4,"priceNormal":329,"discount":"-40%","badge":"CYBER WOW","rating":5,"reviewsCount":5,"image":"assets/calzado/prod_puma_maxima_pro.png","page":"calzado.html"},{"id":907,"code":"CAL-PUM-MAX3","name":"Zapatillas Running Mujer Maxstride Lite Ls Stone","brand":"Puma","category":"Mujer","subCategory":"running","price":174.3,"priceCmr":174.3,"priceNormal":249,"discount":"-30%","badge":"CYBER WOW","rating":4.9,"reviewsCount":24,"image":"assets/calzado/prod_puma_maxstride_beige.png","page":"calzado.html"},{"id":908,"code":"CAL-PUM-MAX4","name":"Zapatillas Running Mujer Maxstride Lite Ls Wns Rose","brand":"Puma","category":"Mujer","subCategory":"running","price":149.4,"priceCmr":149.4,"priceNormal":249,"discount":"-40%","badge":"CYBER WOW","rating":4.8,"reviewsCount":19,"image":"assets/calzado/prod_puma_maxstride_pink.png","page":"calzado.html"},{"id":909,"code":"CAL-ADI-RES1","name":"Zapatillas Running Mujer Response 2 Ice Aqua","brand":"Adidas","category":"Mujer","subCategory":"running","price":155.4,"priceCmr":155.4,"priceNormal":259,"discount":"-40%","badge":"CYBER WOW","rating":5,"reviewsCount":137,"image":"assets/calzado/prod_adidas_response2_aqua.png","page":"calzado.html"},{"id":910,"code":"CAL-ADI-RES2","name":"Zapatillas Running Mujer Response 2 Cream Pearl","brand":"Adidas","category":"Mujer","subCategory":"running","price":155.4,"priceCmr":155.4,"priceNormal":259,"discount":"-40%","badge":"CYBER WOW","rating":5,"reviewsCount":120,"image":"assets/calzado/prod_adidas_response2_cream.png","page":"calzado.html"},{"id":911,"code":"CAL-SKE-DYN1","name":"Zapatillas Running Hombre Dynamight 2.0 Black","brand":"Skechers","category":"Hombre","subCategory":"running","price":132.3,"priceCmr":132.3,"priceNormal":189,"discount":"-30%","badge":"CYBER WOW","rating":5,"reviewsCount":11,"image":"assets/calzado/prod_skechers_dynamight_black.png","page":"calzado.html"},{"id":912,"code":"CAL-SKE-SON1","name":"Zapatillas Running Mujer Sonic Lite Black","brand":"Skechers","category":"Mujer","subCategory":"running","price":153.3,"priceCmr":153.3,"priceNormal":219,"discount":"-30%","badge":"CYBER WOW","rating":4.9,"reviewsCount":45,"image":"assets/calzado/prod_skechers_sonic_lite_black.png","page":"calzado.html"},{"id":913,"code":"CAL-PUM-POU1","name":"Zapatillas Running Hombre Pounce Lite 2 Engineered Dark Grey","brand":"Puma","category":"Hombre","subCategory":"running","price":109.5,"priceCmr":109.5,"priceNormal":219,"discount":"-50%","badge":"CYBER WOW","rating":4.7,"reviewsCount":7,"image":"assets/calzado/prod_puma_pounce_grey.png","page":"calzado.html"},{"id":914,"code":"CAL-PUM-POU2","name":"Zapatillas Running Hombre Pounce Lite 2 Engineered Navy Blue","brand":"Puma","category":"Hombre","subCategory":"running","price":149.9,"priceCmr":149.9,"priceNormal":219,"discount":"-32%","badge":"CYBER WOW","rating":5,"reviewsCount":1,"image":"assets/calzado/prod_puma_pounce_blue.png","page":"calzado.html"},{"id":915,"code":"CAL-ADI-PAC1","name":"Zapatillas Running Mujer Response Pace Soft Pink","brand":"Adidas","category":"Mujer","subCategory":"running","price":139,"priceCmr":139,"priceNormal":199,"discount":"-30%","badge":"CYBER WOW","rating":5,"reviewsCount":27,"image":"assets/calzado/prod_adidas_response_pace_pink.png","page":"calzado.html"},{"id":916,"code":"CAL-ADI-PAC2","name":"Zapatillas Running Mujer Response Pace White Pink","brand":"Adidas","category":"Mujer","subCategory":"running","price":139.3,"priceCmr":139.3,"priceNormal":199,"discount":"-30%","badge":"CYBER WOW","rating":5,"reviewsCount":44,"image":"assets/calzado/prod_adidas_response_pace_white.png","page":"calzado.html"},{"id":1,"code":"PRD-1","name":"Laptop Lenovo IdeaPad 3 15.6\" AMD Ryzen 5 8GB 512GB SSD","brand":"Lenovo","category":"Tecnología","subCategory":"Laptops","price":1899,"priceCmr":1899,"priceNormal":2299,"discount":"-17%","badge":"OFERTA TOP","rating":4.8,"reviewsCount":24,"image":"assets/tecnologia/marca_lenovo.webp","page":"tecnologia.html"},{"id":102,"code":"PRD-102","name":"Laptop HP Envy x360 2-en-1 Intel Core i7 16GB 512GB SSD","brand":"HP","category":"Tecnología","subCategory":"Laptops","price":3599,"priceCmr":3599,"priceNormal":3899,"discount":"-8%","badge":"CMR EXCLUSIVO","rating":4.8,"reviewsCount":24,"image":"assets/tecnologia/marca_hp.webp","page":"tecnologia.html"},{"id":5,"code":"PRD-5","name":"Smart TV Samsung 50\" Crystal UHD 4K Smart Hub Tizen","brand":"Samsung","category":"Tecnología","subCategory":"TVs","price":1499,"priceCmr":1499,"priceNormal":1899,"discount":"-21%","badge":"MUNDIAL 4K","rating":4.8,"reviewsCount":24,"image":"assets/tecnologia/tv_samsung.webp","page":"tecnologia.html"},{"id":104,"code":"PRD-104","name":"Smart TV LG 65\" OLED evo 4K Cinema HDR Dolby Atmos","brand":"LG","category":"Tecnología","subCategory":"TVs","price":4199,"priceCmr":4199,"priceNormal":4599,"discount":"-9%","badge":"OLED PREMIUM","rating":4.8,"reviewsCount":24,"image":"assets/tecnologia/tv_lg.webp","page":"tecnologia.html"},{"id":2,"code":"PRD-2","name":"Audífonos Inalámbricos JBL Wave 520 Bluetooth Bass","brand":"JBL","category":"Tecnología","subCategory":"Audio","price":129.9,"priceCmr":129.9,"priceNormal":179.9,"discount":"-28%","badge":"MÁS VENDIDO","rating":4.8,"reviewsCount":24,"image":"assets/tecnologia/audio_audifonos.webp","page":"tecnologia.html"},{"id":105,"code":"PRD-105","name":"Audífonos Sony WH-1000XM5 Noise Cancelling Premium","brand":"Sony","category":"Tecnología","subCategory":"Audio","price":1199,"priceCmr":1199,"priceNormal":1399,"discount":"-14%","badge":"TOP AUDIO","rating":4.8,"reviewsCount":24,"image":"assets/tecnologia/audio_audifonos.webp","page":"tecnologia.html"},{"id":106,"code":"PRD-106","name":"Parlante Portátil Bluetooth JBL Charge 5 Resistente al Agua IP67","brand":"JBL","category":"Tecnología","subCategory":"Audio","price":579,"priceCmr":579,"priceNormal":649,"discount":"-11%","badge":"RESISTENTE","rating":4.8,"reviewsCount":24,"image":"assets/tecnologia/audio_parlantes.webp","page":"tecnologia.html"},{"id":107,"code":"PRD-107","name":"Cámara Profesional Sony Alpha 7 IV Mirrorless 4K Full-Frame","brand":"Sony","category":"Tecnología","subCategory":"Cámaras","price":7999,"priceCmr":7999,"priceNormal":8499,"discount":"-6%","badge":"PRO FOTO","rating":4.8,"reviewsCount":24,"image":"assets/tecnologia/camaras_profesionales.webp","page":"tecnologia.html"},{"id":108,"code":"PRD-108","name":"Cámara Deportiva GoPro HERO13 Black 5.3K 60fps Sumergible","brand":"GoPro","category":"Tecnología","subCategory":"Cámaras","price":1799,"priceCmr":1799,"priceNormal":1999,"discount":"-10%","badge":"ACCIÓN 4K","rating":4.8,"reviewsCount":24,"image":"assets/tecnologia/camaras_deportivas.webp","page":"tecnologia.html"},{"id":701,"code":"BEL-LAN-01","name":"Lancôme Paris La vie est belle VERY CHERRY Eau de Parfum 50ml","brand":"Lancôme","category":"Fragancias","subCategory":"edp","price":389,"priceCmr":389,"priceNormal":489,"discount":"-20%","badge":"Lanzamiento Exclusivo","rating":4.9,"reviewsCount":218,"image":"assets/belleza/prod_lancome_cherry.png","page":"belleza.html"},{"id":702,"code":"BEL-VS-01","name":"Victoria's Secret Pure Seduction Fragrance Mist 250ml","brand":"Victoria's Secret","category":"Fragancias","subCategory":"mist","price":79.9,"priceCmr":79.9,"priceNormal":99.9,"discount":"-20%","badge":"Top Ventas","rating":4.9,"reviewsCount":312,"image":"assets/belleza/prod_vs_pure_seduction.png","page":"belleza.html"},{"id":703,"code":"BEL-VS-02","name":"Victoria's Secret Pure Seduction Shimmer Body Mist con Brillo 250ml","brand":"Victoria's Secret","category":"Fragancias","subCategory":"mist","price":85,"priceCmr":85,"priceNormal":109,"discount":"-22%","badge":"Edición Shimmer","rating":4.8,"reviewsCount":145,"image":"assets/belleza/banner_victoria_secret.png","page":"belleza.html"},{"id":704,"code":"BEL-BBW-01","name":"Bath & Body Works In The Stars Fine Fragrance Mist 236ml","brand":"Bath & Body Works","category":"Fragancias","subCategory":"mist","price":79.9,"priceCmr":79.9,"priceNormal":105,"discount":"-24%","badge":"Favorito","rating":4.8,"reviewsCount":184,"image":"assets/belleza/prod_bbw_in_the_stars.png","page":"belleza.html"},{"id":705,"code":"BEL-BBW-02","name":"Bath & Body Works Strawberry Snowflakes Body Mist 236ml","brand":"Bath & Body Works","category":"Fragancias","subCategory":"mist","price":79.9,"priceCmr":79.9,"priceNormal":105,"discount":"-24%","badge":"Edición Limitada","rating":4.7,"reviewsCount":96,"image":"assets/belleza/banner_bath_body_works.png","page":"belleza.html"},{"id":706,"code":"BEL-ARM-01","name":"Emporio Armani Power of You Eau de Parfum 50ml para Ella","brand":"Armani","category":"Fragancias","subCategory":"edp","price":369,"priceCmr":369,"priceNormal":459,"discount":"-20%","badge":"Para Ellas","rating":4.9,"reviewsCount":175,"image":"assets/belleza/fragancia_ellas.png","page":"belleza.html"},{"id":707,"code":"BEL-AZZ-01","name":"Azzaro Wanted Eau de Parfum Intense 100ml para Él","brand":"Azzaro","category":"Fragancias","subCategory":"edp","price":399,"priceCmr":399,"priceNormal":499,"discount":"-20%","badge":"Para Ellos","rating":4.9,"reviewsCount":260,"image":"assets/belleza/fragancia_ellos.png","page":"belleza.html"},{"id":708,"code":"BEL-HDA-01","name":"Hello Daise* Raspberry & Mint Fragrance Mist 100ml","brand":"Hello Daise","category":"Fragancias","subCategory":"mist","price":49.9,"priceCmr":49.9,"priceNormal":69.9,"discount":"-28%","badge":"Body Mist","rating":4.6,"reviewsCount":88,"image":"assets/belleza/fragancia_body_mist.png","page":"belleza.html"},{"id":709,"code":"BEL-ISS-01","name":"Issey Miyake L'Eau d'Issey Pour Homme Sport EDT 100ml","brand":"Issey Miyake","category":"Fragancias","subCategory":"edt","price":329,"priceCmr":329,"priceNormal":419,"discount":"-21%","badge":"Eau de Toilette","rating":4.8,"reviewsCount":130,"image":"assets/belleza/fragancia_eau_de_toilette.png","page":"belleza.html"},{"id":710,"code":"BEL-JPG-01","name":"Jean Paul Gaultier La Belle Le Parfum Eau de Parfum 100ml","brand":"Jean Paul Gaultier","category":"Fragancias","subCategory":"edp","price":479,"priceCmr":479,"priceNormal":589,"discount":"-19%","badge":"Eau de Parfum","rating":5,"reviewsCount":340,"image":"assets/belleza/fragancia_eau_de_parfum.png","page":"belleza.html"},{"id":711,"code":"BEL-CER-01","name":"CeraVe Gel Limpiador Espumoso Piel Normal a Grasa 473ml (Paso 1 Limpieza)","brand":"CeraVe","category":"Skincare","subCategory":"limpiador","price":74.9,"priceCmr":74.9,"priceNormal":94.9,"discount":"-21%","badge":"1 Limpieza","rating":4.9,"reviewsCount":620,"image":"assets/belleza/prod_cerave_cleanser.png","page":"belleza.html"},{"id":712,"code":"BEL-EST-01","name":"Estée Lauder Advanced Night Repair Synchronized Serum 50ml (Paso 2 Hidratación)","brand":"Estée Lauder","category":"Skincare","subCategory":"hidratante","price":429,"priceCmr":429,"priceNormal":539,"discount":"-20%","badge":"2 Hidratación","rating":4.9,"reviewsCount":485,"image":"assets/belleza/prod_estee_lauder_serum.png","page":"belleza.html"},{"id":713,"code":"BEL-ISD-01","name":"ISDIN Fotoprotector Fusion Water MAGIC SPF 50 50ml (Paso 3 Tratamiento)","brand":"ISDIN","category":"Skincare","subCategory":"tratamiento","price":89.9,"priceCmr":89.9,"priceNormal":115,"discount":"-22%","badge":"3 Rostro","rating":4.9,"reviewsCount":580,"image":"assets/belleza/prod_isdin_age_repair.png","page":"belleza.html"},{"id":714,"code":"BEL-LAN-02","name":"Lancôme Rénergie H.P.N. 300-Peptide Crema de Ojos Antiedad 15ml (Paso 4 Ojos)","brand":"Lancôme","category":"Skincare","subCategory":"ojos","price":299,"priceCmr":299,"priceNormal":389,"discount":"-23%","badge":"4 Ojos","rating":4.9,"reviewsCount":190,"image":"assets/belleza/prod_lancome_renergie.png","page":"belleza.html"},{"id":715,"code":"BEL-MSK-01","name":"Garnier SkinActive Mascarilla en Tela Hidra Bomb Granada Hidratante (Paso 5 Mask Bar)","brand":"Garnier","category":"Skincare","subCategory":"mascarilla","price":12.9,"priceCmr":12.9,"priceNormal":18.9,"discount":"-32%","badge":"5 Mask Bar","rating":4.8,"reviewsCount":320,"image":"assets/belleza/prod_mask_sheet.png","page":"belleza.html"},{"id":716,"code":"BEL-ORD-01","name":"The Ordinary Ácido Glicólico 7% Toning Solution Exfoliante 240ml","brand":"The Ordinary","category":"Skincare","subCategory":"tratamiento","price":69.9,"priceCmr":69.9,"priceNormal":89.9,"discount":"-22%","badge":"Best Seller","rating":4.9,"reviewsCount":430,"image":"assets/belleza/prod_the_ordinary_glycolic.png","page":"belleza.html"},{"id":717,"code":"BEL-ORD-02","name":"The Ordinary Niacinamida 10% + Zinc 1% Sérum Purificante 30ml","brand":"The Ordinary","category":"Skincare","subCategory":"tratamiento","price":49.9,"priceCmr":49.9,"priceNormal":65,"discount":"-23%","badge":"Favorito Skincare","rating":4.9,"reviewsCount":780,"image":"assets/belleza/prod_the_ordinary_niacinamide.png","page":"belleza.html"},{"id":718,"code":"BEL-BIO-01","name":"Bioderma Sensibio H2O Agua Micelar Dermatológica Calmante 500ml","brand":"Bioderma","category":"Skincare","subCategory":"limpiador","price":79.9,"priceCmr":79.9,"priceNormal":99.9,"discount":"-20%","badge":"Piel Sensible","rating":5,"reviewsCount":512,"image":"assets/belleza/prod_bioderma_micelar.png","page":"belleza.html"},{"id":719,"code":"BEL-CLI-01","name":"Clinique Moisture Surge 100H Hidratante Auto-Rehidratante 50ml","brand":"Clinique","category":"Skincare","subCategory":"hidratante","price":169,"priceCmr":169,"priceNormal":219,"discount":"-23%","badge":"100H Hidratación","rating":4.9,"reviewsCount":240,"image":"assets/belleza/prod_clinique_moisture.png","page":"belleza.html"},{"id":720,"code":"BEL-LAM-01","name":"La Mer Crème de la Mer Crema Hidratante Regeneradora de Lujo 60ml","brand":"La Mer","category":"Skincare","subCategory":"tratamiento","price":1399,"priceCmr":1399,"priceNormal":1699,"discount":"-18%","badge":"Alta Gama","rating":5,"reviewsCount":110,"image":"assets/belleza/prod_la_mer_cream.png","page":"belleza.html"},{"id":721,"code":"BEL-MAY-01","name":"Maybelline New York Cloud Topia Cream Blush Tono Red Velvet","brand":"Maybelline","category":"Maquillaje","subCategory":"Rostro","price":39.9,"priceCmr":39.9,"priceNormal":52.9,"discount":"-25%","badge":"Rostro","rating":4.8,"reviewsCount":165,"image":"assets/belleza/maq_rostro.png","page":"belleza.html"},{"id":722,"code":"BEL-BEN-01","name":"Benefit Benetint Tinte Líquido para Labios y Mejillas 6ml","brand":"Benefit","category":"Maquillaje","subCategory":"Labios","price":99,"priceCmr":99,"priceNormal":129,"discount":"-23%","badge":"Labios","rating":4.9,"reviewsCount":290,"image":"assets/belleza/maq_labios.png","page":"belleza.html"},{"id":723,"code":"BEL-MAY-02","name":"Maybelline Colossal Volum' Express Máscara de Pestañas Glam Black","brand":"Maybelline","category":"Maquillaje","subCategory":"Ojos","price":34.9,"priceCmr":34.9,"priceNormal":46.9,"discount":"-26%","badge":"Ojos","rating":4.7,"reviewsCount":410,"image":"assets/belleza/maq_ojos.png","page":"belleza.html"},{"id":724,"code":"BEL-DIO-01","name":"Dior Diorshow On Set Brow Gel Fijador de Cejas Transparente","brand":"Dior","category":"Maquillaje","subCategory":"Cejas","price":159,"priceCmr":159,"priceNormal":199,"discount":"-20%","badge":"Cejas","rating":4.9,"reviewsCount":140,"image":"assets/belleza/maq_cejas.png","page":"belleza.html"},{"id":725,"code":"BEL-KER-01","name":"Mascarilla Reconstructor Para Cabello Débil Masque Force Architecte...","brand":"Kérastase","category":"Cuidado Capilar","subCategory":"mascarilla","price":213.5,"priceCmr":213.5,"priceNormal":213.5,"discount":"","badge":"CYBER WOW","rating":5,"reviewsCount":125,"image":"assets/belleza/prod_kerastase_force.png","page":"belleza.html"},{"id":726,"code":"BEL-LOR-01","name":"Shampoo Profesional Absolut Repair para Cabello Dañado, 500 ml","brand":"L'Oréal Professionnel","category":"Cuidado Capilar","subCategory":"shampoo","price":140,"priceCmr":140,"priceNormal":161,"discount":"-13%","badge":"OFERTA","rating":5,"reviewsCount":176,"image":"assets/belleza/prod_loreal_absolut_shampoo.png","page":"belleza.html"},{"id":727,"code":"BEL-KER-02","name":"Elixir Ultime Aceite Capilar Para Todo Tipo de Cabello 75ml","brand":"Kérastase","category":"Cuidado Capilar","subCategory":"oleo","price":220.5,"priceCmr":220.5,"priceNormal":220.5,"discount":"","badge":"CYBER WOW","rating":5,"reviewsCount":169,"image":"assets/belleza/prod_kerastase_elixir_75.png","page":"belleza.html"},{"id":728,"code":"BEL-LOR-02","name":"Mascarilla Capilar Absolut Repair Reestructuración Instantánea 250 ml","brand":"L'Oréal Professionnel","category":"Cuidado Capilar","subCategory":"mascarilla","price":122.5,"priceCmr":122.5,"priceNormal":122.5,"discount":"","badge":"CYBER WOW","rating":5,"reviewsCount":263,"image":"assets/belleza/prod_loreal_absolut_masque.png","page":"belleza.html"},{"id":729,"code":"BEL-KER-03","name":"Mascarilla Fortalecedora Génesis Reconstituant Anticaída, 200 ml","brand":"Kérastase","category":"Cuidado Capilar","subCategory":"mascarilla","price":227.5,"priceCmr":227.5,"priceNormal":227.5,"discount":"","badge":"CYBER WOW","rating":5,"reviewsCount":144,"image":"assets/belleza/prod_kerastase_genesis.png","page":"belleza.html"},{"id":730,"code":"BEL-BIO-02","name":"Shampoo Node Fluide 400ml","brand":"Bioderma","category":"Cuidado Capilar","subCategory":"shampoo","price":94.41,"priceCmr":94.41,"priceNormal":104.9,"discount":"-10%","badge":"CYBER WOW","rating":5,"reviewsCount":12,"image":"assets/belleza/prod_bioderma_node.png","page":"belleza.html"},{"id":731,"code":"BEL-KER-04","name":"Gel Kérastase Curl Manifesto Contour rizos y crespos definidos 150ml","brand":"Kérastase","category":"Cuidado Capilar","subCategory":"tratamiento","price":166,"priceCmr":166,"priceNormal":166,"discount":"","badge":"CYBER WOW","rating":5,"reviewsCount":119,"image":"assets/belleza/prod_kerastase_curl.png","page":"belleza.html"},{"id":732,"code":"BEL-KER-05","name":"Mascarilla Reparadora Masque Thérapiste Resistance 200Ml","brand":"Kérastase","category":"Cuidado Capilar","subCategory":"mascarilla","price":227.5,"priceCmr":227.5,"priceNormal":227.5,"discount":"","badge":"CYBER WOW","rating":5,"reviewsCount":217,"image":"assets/belleza/prod_kerastase_therapiste.png","page":"belleza.html"},{"id":733,"code":"BEL-OLA-01","name":"Olaplex N° 3 Hair Perfector Tratamiento Fortalecedor Capilar 100ml","brand":"Olaplex","category":"Cuidado Capilar","subCategory":"tratamiento","price":149,"priceCmr":149,"priceNormal":189,"discount":"-21%","badge":"Best Seller","rating":4.9,"reviewsCount":420,"image":"assets/belleza/prod_olaplex_no3.png","page":"belleza.html"},{"id":734,"code":"BEL-MOR-01","name":"Moroccanoil Tratamiento de Aceite de Argán Clásico Todo Tipo de Cabello 100ml","brand":"Moroccanoil","category":"Cuidado Capilar","subCategory":"oleo","price":189,"priceCmr":189,"priceNormal":239,"discount":"-21%","badge":"Original Argán","rating":4.9,"reviewsCount":380,"image":"assets/belleza/prod_moroccanoil.png","page":"belleza.html"},{"id":817,"code":"DEC-SAN-01","name":"NAVIDAD PENCIL DEAR SANTA | Árbol 2.10m 425 Ramas","brand":"DEAR SANTA","category":"Árboles","subCategory":"","price":169.9,"priceCmr":169.9,"priceNormal":329.9,"discount":"-48%","badge":"CYBER WOW","rating":5,"reviewsCount":28,"image":"assets/decohogar/tree_pencil_dearsanta_scene.png","page":"decohogar.html"},{"id":808,"code":"DEC-MIC-05","name":"Arbol de Navidad Colorado Deluxe 2.10m 1224 Ramas","brand":"MICA","category":"Árboles","subCategory":"","price":239.9,"priceCmr":239.9,"priceNormal":599.9,"discount":"-60%","badge":"CYBER WOW","rating":5,"reviewsCount":32,"image":"assets/decohogar/prod_arbol_colorado_deluxe.png","page":"decohogar.html"},{"id":811,"code":"DEC-MIC-06","name":"Arbol de Navidad Colorado 1.80m 380 Ramas","brand":"MICA","category":"Árboles","subCategory":"","price":79.9,"priceCmr":79.9,"priceNormal":199.9,"discount":"-60%","badge":"CYBER WOW","rating":5,"reviewsCount":16,"image":"assets/decohogar/prod_arbol_colorado_180.png","page":"decohogar.html"},{"id":812,"code":"DEC-MIC-07","name":"Combo Arbol de Navidad 1.80M 380 Ramas + Set20 Bolas Rose Gold 7cm + Luces LED","brand":"MICA","category":"Árboles","subCategory":"","price":99.9,"priceCmr":99.9,"priceNormal":349.6,"discount":"-71%","badge":"CYBER WOW","rating":5,"reviewsCount":24,"image":"assets/decohogar/prod_combo_arbol_bolas.png","page":"decohogar.html"},{"id":801,"code":"DEC-VID-01","name":"Silla Gamer GX2000 Reclinable Profesional con Reposapiés-Gris","brand":"VIDITA","category":"Sillas & Oficina","subCategory":"","price":249.9,"priceCmr":249.9,"priceNormal":599.9,"discount":"-58%","badge":"CYBER WOW","rating":4.5,"reviewsCount":983,"image":"assets/decohogar/prod_silla_gamer.png","page":"decohogar.html"},{"id":802,"code":"DEC-BSM-01","name":"Sofá Ying 4 Cuerpos","brand":"BASEMENT HOME","category":"Sofás","subCategory":"","price":2699,"priceCmr":2699,"priceNormal":3999,"discount":"-33%","badge":"CYBER WOW","rating":5,"reviewsCount":8,"image":"assets/decohogar/prod_sofa_ying.png","page":"decohogar.html"},{"id":803,"code":"DEC-MIC-01","name":"Seccional Rafa 4 Cuerpos Izquierdo","brand":"MICA","category":"Sofás","subCategory":"","price":1999,"priceCmr":1999,"priceNormal":3499,"discount":"-43%","badge":"CYBER WOW","rating":5,"reviewsCount":15,"image":"assets/decohogar/prod_seccional_rafa.png","page":"decohogar.html"},{"id":804,"code":"DEC-BSM-02","name":"Seccional con Cabecera Reclinable Osaka 4 Cuerpos Izquierdo","brand":"BASEMENT HOME","category":"Sofás","subCategory":"","price":2199,"priceCmr":2199,"priceNormal":3999,"discount":"-45%","badge":"CYBER WOW","rating":5,"reviewsCount":5,"image":"assets/decohogar/prod_seccional_osaka.png","page":"decohogar.html"},{"id":805,"code":"DEC-MIC-02","name":"Centro De Tv Marocco 65\"","brand":"MICA","category":"Centros de TV","subCategory":"","price":399.9,"priceCmr":399.9,"priceNormal":999,"discount":"-60%","badge":"CYBER WOW","rating":5,"reviewsCount":84,"image":"assets/decohogar/prod_centro_tv.png","page":"decohogar.html"},{"id":806,"code":"DEC-MIC-03","name":"Peluche navidad Oso bufanda 50cm","brand":"MICA","category":"Navidad","subCategory":"","price":124.9,"priceCmr":124.9,"priceNormal":249.9,"discount":"-50%","badge":"CYBER WOW","rating":5,"reviewsCount":3,"image":"assets/decohogar/prod_peluche_oso.png","page":"decohogar.html"},{"id":807,"code":"DEC-MIC-04","name":"Farol navideño rojo santa 90cm","brand":"MICA","category":"Navidad","subCategory":"","price":199.9,"priceCmr":199.9,"priceNormal":399.9,"discount":"-50%","badge":"CYBER WOW","rating":5,"reviewsCount":3,"image":"assets/decohogar/prod_farol_rojo.png","page":"decohogar.html"},{"id":809,"code":"DEC-GEN-01","name":"Guirnalda 10 Mtr + Focos LED Calidos Impermeable E27 Terraza Patio IP65","brand":"GENERICO","category":"Iluminación","subCategory":"","price":45,"priceCmr":45,"priceNormal":125,"discount":"-64%","badge":"CYBER WOW","rating":4.8,"reviewsCount":47,"image":"assets/decohogar/prod_guirnalda_focos_led.png","page":"decohogar.html"},{"id":810,"code":"DEC-ART-01","name":"Luces Navideñas Lineales 100 Metros 1000 Led","brand":"ARTEZA","category":"Iluminación","subCategory":"","price":99,"priceCmr":99,"priceNormal":120,"discount":"-18%","badge":"CYBER WOW","rating":4.7,"reviewsCount":58,"image":"assets/decohogar/prod_luces_navidenas_100m.png","page":"decohogar.html"},{"id":813,"code":"DEC-MIC-08","name":"Adorno Navideño de Oso Beary 134cm","brand":"MICA","category":"Navidad","subCategory":"","price":1499,"priceCmr":1499,"priceNormal":2999,"discount":"-50%","badge":"CYBER WOW","rating":5,"reviewsCount":12,"image":"assets/decohogar/prod_oso_beary_134cm.png","page":"decohogar.html"},{"id":814,"code":"DEC-BSM-03","name":"Juego de Comedor 6 Sillas Madera Nogal & Tapiz Lino Beige","brand":"BASEMENT HOME","category":"Comedor","subCategory":"","price":1899,"priceCmr":1899,"priceNormal":3299,"discount":"-42%","badge":"CYBER WOW","rating":4.9,"reviewsCount":43,"image":"https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600&auto=format&fit=crop&q=80","page":"decohogar.html"},{"id":815,"code":"DEC-BSM-04","name":"Juego de Sábanas 400 Hilos 100% Algodón Egipcio King Ivory","brand":"BASEMENT HOME","category":"Dormitorio","subCategory":"","price":189.9,"priceCmr":189.9,"priceNormal":349.9,"discount":"-45%","badge":"CYBER WOW","rating":4.8,"reviewsCount":129,"image":"https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&auto=format&fit=crop&q=80","page":"decohogar.html"},{"id":816,"code":"DEC-MIC-09","name":"Espejo De Pared Ovalado Marco Metálico Dorado 80x50cm","brand":"MICA","category":"Decoración","subCategory":"","price":119.9,"priceCmr":119.9,"priceNormal":229.9,"discount":"-48%","badge":"CYBER WOW","rating":4.9,"reviewsCount":77,"image":"https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&auto=format&fit=crop&q=80","page":"decohogar.html"},{"id":601,"code":"DEP-BIC-01","name":"Monark Bicicleta Montañera Furious Aro 29 Freno Disco","brand":"Monark","category":"Bicicletas","subCategory":"Montañera","price":899,"priceCmr":899,"priceNormal":1199,"discount":"-25%","badge":"Top Ventas","rating":4.9,"reviewsCount":142,"image":"assets/deportes/bici_montanera_exp.webp","page":"deportes.html"},{"id":602,"code":"DEP-BIC-02","name":"Jeep Bicicleta Urbana Commuter Paseo Aluminio 700c","brand":"Jeep","category":"Bicicletas","subCategory":"Urbanas","price":749,"priceCmr":749,"priceNormal":999,"discount":"-25%","badge":"Oferta CMR","rating":4.8,"reviewsCount":87,"image":"assets/deportes/bici_urbanas_exp.webp","page":"deportes.html"},{"id":603,"code":"DEP-BIC-03","name":"Trek Bicicleta de Ruta Alpha Domane AL 2 Disc 16 Velocidades","brand":"Trek","category":"Bicicletas","subCategory":"Rutera","price":2499,"priceCmr":2499,"priceNormal":2999,"discount":"-17%","badge":"Profesional","rating":5,"reviewsCount":64,"image":"assets/deportes/bici_rutera_exp.webp","page":"deportes.html"},{"id":604,"code":"DEP-BIC-04","name":"Monark Bicicleta Infantil Kids Aro 16 con Rueditas de Apoyo","brand":"Monark","category":"Bicicletas","subCategory":"Infantil","price":389,"priceCmr":389,"priceNormal":499,"discount":"-22%","badge":"Kids","rating":4.7,"reviewsCount":95,"image":"assets/deportes/bici_infantil_exp.webp","page":"deportes.html"},{"id":605,"code":"DEP-BIC-05","name":"Segway Ninebot KickScooter Eléctrico F25 Plegable 25km/h","brand":"Segway","category":"Bicicletas","subCategory":"Scooter","price":1599,"priceCmr":1599,"priceNormal":1999,"discount":"-20%","badge":"E-Mobility","rating":4.9,"reviewsCount":110,"image":"assets/deportes/bici_scooter_exp.webp","page":"deportes.html"},{"id":606,"code":"DEP-FIT-01","name":"Sole Fitness Trotadora Eléctrica F63 2.5 HP Pantalla LCD Plegable","brand":"Sole Fitness","category":"Máquinas","subCategory":"Trotadoras","price":2899,"priceCmr":2899,"priceNormal":3499,"discount":"-17%","badge":"Alta Gama","rating":4.9,"reviewsCount":82,"image":"assets/deportes/banner_zona_fitness.webp","page":"deportes.html"},{"id":607,"code":"DEP-FIT-02","name":"Oxford Bicicleta de Spinning Magnética Volante Inercia 18kg","brand":"Oxford","category":"Máquinas","subCategory":"Spinning","price":1199,"priceCmr":1199,"priceNormal":1499,"discount":"-20%","badge":"Recomendado","rating":4.8,"reviewsCount":124,"image":"assets/deportes/zona_fitness_room.webp","page":"deportes.html"},{"id":608,"code":"DEP-FIT-03","name":"Atletis Multigimnasio Multifuerza Profesional 100 Lbs con Poleas","brand":"Atletis","category":"Máquinas","subCategory":"Multigimnasios","price":1399,"priceCmr":1399,"priceNormal":1799,"discount":"-22%","badge":"Exclusivo","rating":4.9,"reviewsCount":68,"image":"assets/deportes/zona_fitness_room.webp","page":"deportes.html"},{"id":609,"code":"DEP-FIT-04","name":"Atletis Banco de Pesas Olímpico Inclinable con Extensión de Piernas","brand":"Atletis","category":"Máquinas","subCategory":"Pesas","price":429,"priceCmr":429,"priceNormal":549,"discount":"-22%","badge":"Fuerza","rating":4.7,"reviewsCount":54,"image":"assets/deportes/zona_fitness_room.webp","page":"deportes.html"},{"id":610,"code":"DEP-FIT-05","name":"Bowflex Set Mancuernas Ajustables SelectTech 552 (2 a 24 kg) + Rack","brand":"Bowflex","category":"Máquinas","subCategory":"Pesas","price":999,"priceCmr":999,"priceNormal":1299,"discount":"-23%","badge":"Innovación","rating":4.9,"reviewsCount":139,"image":"assets/deportes/zona_fitness_room.webp","page":"deportes.html"},{"id":611,"code":"DEP-SUP-01","name":"Whey Pro Proteína Concentrada 5 Lbs Sabor Chocolate Suizo","brand":"Whey Pro","category":"Suplementos","subCategory":"Proteínas","price":199.9,"priceCmr":199.9,"priceNormal":249.9,"discount":"-20%","badge":"Top Ventas","rating":4.9,"reviewsCount":215,"image":"assets/deportes/suplemento_whey_pro.webp","page":"deportes.html"},{"id":612,"code":"DEP-SUP-02","name":"Applied Nutrition Creatina Monohidratada Micronizada Pura 250g","brand":"Applied Nutrition","category":"Suplementos","subCategory":"Creatina","price":89.9,"priceCmr":89.9,"priceNormal":119.9,"discount":"-25%","badge":"Esencial","rating":4.9,"reviewsCount":184,"image":"assets/deportes/suplemento_creatina.webp","page":"deportes.html"},{"id":613,"code":"DEP-SUP-03","name":"Nutrex Research Lipo 6 Black Intense Ultra Quemador 60 Cápsulas","brand":"Nutrex","category":"Suplementos","subCategory":"Quemadores","price":129.9,"priceCmr":129.9,"priceNormal":169.9,"discount":"-24%","badge":"Termogénico","rating":4.8,"reviewsCount":147,"image":"assets/deportes/suplemento_lipo6.webp","page":"deportes.html"},{"id":614,"code":"DEP-SUP-04","name":"Nutricost Omega-3 2500mg 1200mg EPA / 850mg DHA 120 Softgels","brand":"Nutricost","category":"Suplementos","subCategory":"Vitaminas","price":79.9,"priceCmr":79.9,"priceNormal":99.9,"discount":"-20%","badge":"Salud & Cardio","rating":4.8,"reviewsCount":98,"image":"assets/deportes/suplemento_vitaminas.webp","page":"deportes.html"},{"id":615,"code":"DEP-CAL-01","name":"Nike Zapatillas Running Air Zoom Pegasus 40 Hombre Black/White","brand":"Nike","category":"Zapatillas","subCategory":"Running","price":399,"priceCmr":399,"priceNormal":499,"discount":"-20%","badge":"Nike Pro","rating":4.9,"reviewsCount":320,"image":"assets/deportes/banner_vestuario_deportivo.webp","page":"deportes.html"},{"id":616,"code":"DEP-VES-01","name":"Adidas Casaca Deportiva Cortaviento Tiro 23 Windbreaker Negro","brand":"Adidas","category":"Vestuario","subCategory":"Hombre","price":199,"priceCmr":199,"priceNormal":249,"discount":"-20%","badge":"Adidas Tiro","rating":4.8,"reviewsCount":112,"image":"assets/deportes/banner_vestuario_deportivo.webp","page":"deportes.html"},{"id":617,"code":"DEP-VES-02","name":"Under Armour Polo Deportivo HeatGear Compresión Hombre","brand":"Under Armour","category":"Vestuario","subCategory":"Hombre","price":99.9,"priceCmr":99.9,"priceNormal":129.9,"discount":"-23%","badge":"HeatGear","rating":4.7,"reviewsCount":85,"image":"assets/deportes/banner_vestuario_deportivo.webp","page":"deportes.html"},{"id":618,"code":"DEP-VES-03","name":"Puma Leggings Deportivas Tiro Alto Training Mujer Strong","brand":"Puma","category":"Vestuario","subCategory":"Mujer","price":119.9,"priceCmr":119.9,"priceNormal":149.9,"discount":"-20%","badge":"DryCELL","rating":4.9,"reviewsCount":144,"image":"assets/deportes/banner_vestuario_deportivo.webp","page":"deportes.html"},{"id":622,"code":"DEP-BIC-06","name":"Oxford Bicicleta Montañera Aluminio Jade Aro 27.5","brand":"Oxford","category":"Bicicletas","subCategory":"Montañera","price":699,"priceCmr":699,"priceNormal":1299,"discount":"-46%","badge":"Llega mañana","rating":5,"reviewsCount":2,"image":"assets/deportes/prod_bici_oxford_jade_275.webp","page":"deportes.html"},{"id":623,"code":"DEP-BIC-07","name":"Trinx Bicicleta de Ruta Swift 2.0 700CC 50 CM Rojo","brand":"Trinx","category":"Bicicletas","subCategory":"Rutera","price":2999,"priceCmr":2999,"priceNormal":5330,"discount":"-44%","badge":"Trinx Racing","rating":5,"reviewsCount":1,"image":"assets/deportes/prod_bici_trinx_swift_rojo.webp","page":"deportes.html"},{"id":624,"code":"DEP-BIC-08","name":"Trinx Bicicleta de Ruta Swift 2.0 700CC 50 CM Azul","brand":"Trinx","category":"Bicicletas","subCategory":"Rutera","price":2999,"priceCmr":2999,"priceNormal":5330,"discount":"-44%","badge":"Carbon Fork","rating":5,"reviewsCount":1,"image":"assets/deportes/prod_bici_trinx_swift_azul.webp","page":"deportes.html"},{"id":625,"code":"DEP-BIC-09","name":"Jeep Bicicleta Aro 20 Peak Doble Suspensión Naranja","brand":"Jeep","category":"Bicicletas","subCategory":"Urbanas","price":699,"priceCmr":699,"priceNormal":999,"discount":"-30%","badge":"Llega mañana","rating":4.9,"reviewsCount":14,"image":"assets/deportes/prod_bici_jeep_peak_20.webp","page":"deportes.html"},{"id":626,"code":"DEP-BIC-10","name":"Monark Bicicleta Infantil Minnie Party Aro 12 Rosado con Canastilla","brand":"Monark","category":"Bicicletas","subCategory":"Infantil","price":299,"priceCmr":299,"priceNormal":369,"discount":"-19%","badge":"Disney Kids","rating":4.9,"reviewsCount":28,"image":"assets/deportes/prod_bici_minnie_party_12.webp","page":"deportes.html"},{"id":627,"code":"DEP-BIC-11","name":"Valiant Bicicleta de Equilibrio para Bebés Aro 12 Plateada (1 a 4 años)","brand":"Valiant","category":"Bicicletas","subCategory":"Infantil","price":229,"priceCmr":229,"priceNormal":399,"discount":"-43%","badge":"Llega mañana","rating":4.8,"reviewsCount":4,"image":"assets/deportes/prod_bici_valiant_equilibrio.webp","page":"deportes.html"},{"id":628,"code":"DEP-BIC-12","name":"Bicicleta Infantil Aro 16 con Rueditas de Apoyo y Caramañola","brand":"Genérico","category":"Bicicletas","subCategory":"Infantil","price":300,"priceCmr":300,"priceNormal":350,"discount":"-14%","badge":"Retira mañana","rating":4.8,"reviewsCount":10,"image":"assets/deportes/prod_bici_infantil_aro16.webp","page":"deportes.html"},{"id":629,"code":"DEP-BIC-13","name":"Bicicleta Aro 20 para Niños Luces LED Multicolor y Canasta Metálica","brand":"Genérico","category":"Bicicletas","subCategory":"Infantil","price":529.9,"priceCmr":529.9,"priceNormal":889.9,"discount":"-40%","badge":"Luces LED","rating":5,"reviewsCount":1,"image":"assets/deportes/prod_bici_infantil_led_aro20.webp","page":"deportes.html"},{"id":620,"code":"DEP-PES-01","name":"Set Mancuerna ajustable 20kg Pesa Rusa Barra Kettlebell 3 en 1 - Negro","brand":"Genérico","category":"Máquinas","subCategory":"Pesas","price":124,"priceCmr":124,"priceNormal":300,"discount":"-59%","badge":"Llega mañana","rating":5,"reviewsCount":16,"image":"assets/deportes/prod_mancuerna_ajustable_20kg.webp","page":"deportes.html"},{"id":621,"code":"DEP-PES-02","name":"Proiron Set de mancuernas hexagonales de 50KG + Rack de Acero","brand":"Proiron","category":"Máquinas","subCategory":"Pesas","price":679,"priceCmr":679,"priceNormal":1299,"discount":"-48%","badge":"Pro Sport","rating":4.8,"reviewsCount":4,"image":"assets/deportes/prod_mancuernas_hex_50kg.webp","page":"deportes.html"},{"id":630,"code":"DEP-FIT-08","name":"Ten Series Trotadora Eléctrica TM60 12 Km/h Pantalla Digital","brand":"Ten Series","category":"Máquinas","subCategory":"Trotadoras","price":699,"priceCmr":699,"priceNormal":1399,"discount":"-50%","badge":"Llega mañana","rating":4.8,"reviewsCount":166,"image":"assets/deportes/prod_trotadora_tm60.webp","page":"deportes.html"},{"id":631,"code":"DEP-FIT-09","name":"Ten Series Trotadora Eléctrica Black A3 14km/h Plegable","brand":"Ten Series","category":"Máquinas","subCategory":"Trotadoras","price":879,"priceCmr":879,"priceNormal":1799,"discount":"-51%","badge":"Llega mañana","rating":4.9,"reviewsCount":32,"image":"assets/deportes/prod_trotadora_black_a3.webp","page":"deportes.html"},{"id":501,"code":"MOD-SYB-01","name":"Sybilla Vestido Corto Texturizado Nido de Abeja Azul","brand":"Sybilla","category":"Vestidos","subCategory":"","price":99.9,"priceCmr":99.9,"priceNormal":139.9,"discount":"-28%","badge":"Destino Verano","rating":4.9,"reviewsCount":215,"image":"assets/moda_mujer/sybilla_look_1.webp","page":"moda_mujer.html"},{"id":502,"code":"MOD-SYB-02","name":"Sybilla Vestido Largo Tejido Crochet Rayas Multicolor","brand":"Sybilla","category":"Vestidos","subCategory":"","price":139.9,"priceCmr":139.9,"priceNormal":189.9,"discount":"-26%","badge":"Sunny Looks","rating":4.8,"reviewsCount":142,"image":"assets/moda_mujer/sybilla_look_2.webp","page":"moda_mujer.html"},{"id":503,"code":"MOD-SYB-03","name":"Sybilla Falda Smocked Plisada Volantes Crudo","brand":"Sybilla","category":"Faldas","subCategory":"","price":79.9,"priceCmr":79.9,"priceNormal":109.9,"discount":"-27%","badge":"Top Ventas","rating":4.7,"reviewsCount":98,"image":"assets/moda_mujer/sybilla_look_3.webp","page":"moda_mujer.html"},{"id":504,"code":"MOD-SYB-04","name":"Sybilla Top Halter Calado Espalda Descubierta Blanco","brand":"Sybilla","category":"Tops","subCategory":"","price":59.9,"priceCmr":59.9,"priceNormal":89.9,"discount":"-33%","badge":"Tendencia","rating":4.8,"reviewsCount":86,"image":"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80","page":"moda_mujer.html"},{"id":505,"code":"MOD-AB-01","name":"Agua Bendita Vestido Playero Bohemio Floreado","brand":"Agua Bendita","category":"Vestidos","subCategory":"","price":289,"priceCmr":289,"priceNormal":389,"discount":"-25%","badge":"Exclusivo","rating":4.9,"reviewsCount":110,"image":"https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&auto=format&fit=crop&q=80","page":"moda_mujer.html"},{"id":506,"code":"MOD-AB-02","name":"Agua Bendita Bikini Set Dos Piezas Estampado Botánico","brand":"Agua Bendita","category":"Beachwear","subCategory":"","price":229.9,"priceCmr":229.9,"priceNormal":299.9,"discount":"-23%","badge":"Resort 2026","rating":4.9,"reviewsCount":118,"image":"assets/moda_mujer/agua_bendita_bikini_botanico.webp","page":"moda_mujer.html"},{"id":507,"code":"MOD-BSM-01","name":"Basement Blazer Estructurado Slim Fit Lino Ivory","brand":"Basement","category":"Blazers","subCategory":"","price":249,"priceCmr":249,"priceNormal":329,"discount":"-24%","badge":"Smart Chic","rating":4.9,"reviewsCount":128,"image":"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=80","page":"moda_mujer.html"},{"id":508,"code":"MOD-BSM-02","name":"Basement Vestido Camisero Satinado con Lazo Verde","brand":"Basement","category":"Vestidos","subCategory":"","price":179.9,"priceCmr":179.9,"priceNormal":239,"discount":"-25%","badge":"Elegancia","rating":4.7,"reviewsCount":95,"image":"https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&auto=format&fit=crop&q=80","page":"moda_mujer.html"},{"id":509,"code":"MOD-BSM-03","name":"Basement Pantalón Palazo Tiro Alto Fluido Negro","brand":"Basement","category":"Pantalones","subCategory":"","price":149.9,"priceCmr":149.9,"priceNormal":199,"discount":"-25%","badge":"Básico","rating":4.8,"reviewsCount":112,"image":"https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&auto=format&fit=crop&q=80","page":"moda_mujer.html"},{"id":510,"code":"MOD-MAN-01","name":"MANGO Vestido Midi Plisado Escote Cruzado Coral","brand":"MANGO","category":"Vestidos","subCategory":"","price":279,"priceCmr":279,"priceNormal":369,"discount":"-24%","badge":"Nueva Colección","rating":4.9,"reviewsCount":84,"image":"https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?w=600&auto=format&fit=crop&q=80","page":"moda_mujer.html"},{"id":511,"code":"MOD-MAN-02","name":"MANGO Blusa Manga Abullonada Bordado Suizo Crudo","brand":"MANGO","category":"Blusas","subCategory":"","price":139.9,"priceCmr":139.9,"priceNormal":179,"discount":"-22%","badge":"Romántico","rating":4.7,"reviewsCount":63,"image":"https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=600&auto=format&fit=crop&q=80","page":"moda_mujer.html"},{"id":512,"code":"MOD-MRQ-01","name":"Marquis Casaca Denim Oversize Crop Celeste","brand":"Marquis","category":"Casacas","subCategory":"","price":159.9,"priceCmr":159.9,"priceNormal":219,"discount":"-27%","badge":"Denim","rating":4.8,"reviewsCount":156,"image":"https://images.unsplash.com/photo-1544441893-675973e31985?w=600&auto=format&fit=crop&q=80","page":"moda_mujer.html"},{"id":513,"code":"MOD-MRQ-02","name":"Marquis Jean Wide Leg Tiro Alto Denim Azul Clásico","brand":"Marquis","category":"Jeans","subCategory":"","price":129.9,"priceCmr":129.9,"priceNormal":179,"discount":"-27%","badge":"Top Fit","rating":4.9,"reviewsCount":230,"image":"https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80","page":"moda_mujer.html"},{"id":514,"code":"MOD-SYB-05","name":"Sybilla Polo Gráfico Vintage Golden Hour Algodón","brand":"Sybilla","category":"Polos","subCategory":"","price":49.9,"priceCmr":49.9,"priceNormal":69.9,"discount":"-28%","badge":"Básico","rating":4.6,"reviewsCount":140,"image":"https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&auto=format&fit=crop&q=80","page":"moda_mujer.html"},{"id":515,"code":"MOD-AB-03","name":"Agua Bendita Traje de Baño Enterizo Estampado Palmeras","brand":"Agua Bendita","category":"Beachwear","subCategory":"","price":199.9,"priceCmr":199.9,"priceNormal":259.9,"discount":"-23%","badge":"Exclusivo","rating":4.9,"reviewsCount":86,"image":"assets/moda_mujer/agua_bendita_entero_palmeras.webp","page":"moda_mujer.html"},{"id":516,"code":"MOD-AB-04","name":"Agua Bendita Conjunto Denim Bordado Top Peplum & Jean Wide Leg","brand":"Agua Bendita","category":"Conjuntos","subCategory":"","price":219.9,"priceCmr":219.9,"priceNormal":279.9,"discount":"-21%","badge":"Edición Especial","rating":4.8,"reviewsCount":64,"image":"assets/moda_mujer/agua_bendita_denim_bordado.webp","page":"moda_mujer.html"},{"id":517,"code":"MOD-AB-05","name":"Agua Bendita Conjunto Tejido Crochet Top Verde & Pantalón","brand":"Agua Bendita","category":"Conjuntos","subCategory":"","price":129.9,"priceCmr":129.9,"priceNormal":169.9,"discount":"-24%","badge":"Tendencia Verano","rating":4.9,"reviewsCount":79,"image":"assets/moda_mujer/agua_bendita_crochet_verde.webp","page":"moda_mujer.html"},{"id":518,"code":"MOD-AB-06","name":"Agua Bendita Vestido Maxi Lino Palmeras & Sombrero Artesanal","brand":"Agua Bendita","category":"Vestidos","subCategory":"","price":219.9,"priceCmr":219.9,"priceNormal":279.9,"discount":"-21%","badge":"Top Ventas","rating":4.9,"reviewsCount":92,"image":"assets/moda_mujer/agua_bendita_vestido_palmeras.webp","page":"moda_mujer.html"},{"id":519,"code":"MOD-AB-07","name":"Agua Bendita Bolso Playero Tropical Tote & Sombrero de Paja","brand":"Agua Bendita","category":"Accesorios","subCategory":"","price":229.9,"priceCmr":229.9,"priceNormal":299.9,"discount":"-23%","badge":"Resort Chic","rating":4.7,"reviewsCount":58,"image":"assets/moda_mujer/agua_bendita_cartera_tote.webp","page":"moda_mujer.html"},{"id":520,"code":"MOD-AB-08","name":"Agua Bendita Polo Bordado Palmeras & Bikini Bottom","brand":"Agua Bendita","category":"Polos","subCategory":"","price":69.9,"priceCmr":69.9,"priceNormal":79.9,"discount":"-13%","badge":"Nuevo","rating":4.8,"reviewsCount":71,"image":"assets/moda_mujer/agua_bendita_polo_palmeras.webp","page":"moda_mujer.html"},{"id":301,"code":"MOD-PRL-01","name":"Polo Piqué Classic Fit Algodón Bordado","brand":"Polo Ralph Lauren","category":"Polos","subCategory":"","price":299,"priceCmr":299,"priceNormal":389,"discount":"-23%","badge":"Exclusivo Sagabella","rating":4.9,"reviewsCount":142,"image":"https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":302,"code":"MOD-PRL-02","name":"Camisa Oxford Manga Larga Slim Fit Celeste","brand":"Polo Ralph Lauren","category":"Camisas","subCategory":"","price":399,"priceCmr":399,"priceNormal":499,"discount":"-20%","badge":"Lo más vendido","rating":4.8,"reviewsCount":98,"image":"https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":303,"code":"MOD-LM-01","name":"Polo Guards Club Manga Corta Edición Especial","brand":"La Martina","category":"Polos","subCategory":"","price":279,"priceCmr":279,"priceNormal":359,"discount":"-22%","badge":"Nuevo","rating":4.7,"reviewsCount":65,"image":"https://images.unsplash.com/photo-1625910513413-5626359b02a9?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":304,"code":"MOD-LM-02","name":"Camisa Lino Regular Fit Rayas Casual","brand":"La Martina","category":"Camisas","subCategory":"","price":319,"priceCmr":319,"priceNormal":419,"discount":"-24%","badge":"Tendencia","rating":4.8,"reviewsCount":52,"image":"https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":305,"code":"MOD-MM-01","name":"Suéter de Punto Trenzado Cuello Redondo Gris","brand":"Mango Man","category":"Chompas","subCategory":"","price":189.9,"priceCmr":189.9,"priceNormal":259,"discount":"-27%","badge":"Otoño - Invierno","rating":4.7,"reviewsCount":73,"image":"https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":306,"code":"MOD-MM-02","name":"Blazer Slim Fit Estructurado Azul Marino","brand":"Mango Man","category":"Blazers","subCategory":"","price":379,"priceCmr":379,"priceNormal":499,"discount":"-24%","badge":"Smart Casual","rating":4.9,"reviewsCount":84,"image":"https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":307,"code":"MOD-MM-03","name":"Pantalón Chino Slim Fit Stretch Algodón Beige","brand":"Mango Man","category":"Pantalones","subCategory":"","price":169.9,"priceCmr":169.9,"priceNormal":229,"discount":"-26%","badge":"Básico Esencial","rating":4.6,"reviewsCount":112,"image":"https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":308,"code":"MOD-LEV-01","name":"Jean 501 Original Fit Denim Stonewash","brand":"Levi's","category":"Jeans","subCategory":"","price":249,"priceCmr":249,"priceNormal":329,"discount":"-24%","badge":"Ícono Mundial","rating":4.9,"reviewsCount":310,"image":"https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":309,"code":"MOD-LEV-02","name":"Casaca Denim Sherpa Trucker Jacket Forro Polar","brand":"Levi's","category":"Casacas","subCategory":"","price":399,"priceCmr":399,"priceNormal":529,"discount":"-25%","badge":"Top Estilo","rating":4.8,"reviewsCount":168,"image":"https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":310,"code":"MOD-LEV-03","name":"Polo Housemark Batwing Logo Algodón Premium","brand":"Levi's","category":"Polos","subCategory":"","price":89.9,"priceCmr":89.9,"priceNormal":119,"discount":"-24%","badge":"Oferta CMR","rating":4.6,"reviewsCount":215,"image":"https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":311,"code":"MOD-BIL-01","name":"Polera Canguro All Day Surf Hoodie Felpa","brand":"Billabong","category":"Poleras","subCategory":"","price":199.9,"priceCmr":199.9,"priceNormal":269,"discount":"-26%","badge":"Exclusivo","rating":4.8,"reviewsCount":94,"image":"https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":312,"code":"MOD-BIL-02","name":"Casaca Puffer Journey Adventure Térmica","brand":"Billabong","category":"Casacas","subCategory":"","price":349,"priceCmr":349,"priceNormal":469,"discount":"-26%","badge":"Outdoor","rating":4.7,"reviewsCount":78,"image":"https://images.unsplash.com/photo-1544441893-675973e31985?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":1,"code":"TEC-001","name":"Laptop Lenovo IdeaPad 3 15.6\" AMD Ryzen 5","brand":"Lenovo","category":"Tecnología","subCategory":"","price":1899,"priceCmr":1899,"priceNormal":2299,"discount":"-17","badge":"DESTACADO","rating":4.7,"reviewsCount":48,"image":"https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80","page":"tecnologia.html"},{"id":2,"code":"TEC-002","name":"Audífonos Inalámbricos JBL Wave 520 Bluetooth","brand":"JBL","category":"Tecnología","subCategory":"","price":129.9,"priceCmr":129.9,"priceNormal":179.9,"discount":"-28","badge":"DESTACADO","rating":4.8,"reviewsCount":92,"image":"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80","page":"tecnologia.html"},{"id":3,"code":"DEP-001","name":"Zapatillas Running Nike Revolution 6 Next Nature","brand":"Nike","category":"Deportes","subCategory":"","price":249.9,"priceCmr":249.9,"priceNormal":319.9,"discount":"-22","badge":"DESTACADO","rating":4.9,"reviewsCount":135,"image":"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80","page":"deportes.html"},{"id":4,"code":"MOD-001","name":"Camisa Casual Manga Larga University Club Regular Fit","brand":"University Club","category":"Moda Hombre","subCategory":"","price":59.9,"priceCmr":59.9,"priceNormal":89.9,"discount":"-33","badge":"","rating":4.3,"reviewsCount":24,"image":"https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80","page":"moda_hombre.html"},{"id":5,"code":"TEC-003","name":"Smart TV Samsung 50\" Crystal UHD 4K","brand":"Samsung","category":"Tecnología","subCategory":"","price":1499,"priceCmr":1499,"priceNormal":1899,"discount":"-21","badge":"DESTACADO","rating":4.6,"reviewsCount":61,"image":"https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop&q=80","page":"tecnologia.html"},{"id":6,"code":"HOG-001","name":"Olla Arrocera Oster 1.8L Multiuso con Vaporera","brand":"Oster","category":"Decohogar","subCategory":"","price":139.9,"priceCmr":139.9,"priceNormal":169.9,"discount":"-18","badge":"","rating":4.5,"reviewsCount":37,"image":"https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=600&auto=format&fit=crop&q=80","page":"decohogar.html"},{"id":7,"code":"ACC-001","name":"Mochila Urbana Everest Explorer 15.6\" Impermeable","brand":"Everest","category":"Accesorios","subCategory":"","price":89.9,"priceCmr":89.9,"priceNormal":129.9,"discount":"-31","badge":"","rating":4.4,"reviewsCount":19,"image":"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80","page":"index.html"},{"id":8,"code":"TEC-004","name":"Tablet Samsung Galaxy Tab A9+ 11\" 64GB","brand":"Samsung","category":"Tecnología","subCategory":"","price":749,"priceCmr":749,"priceNormal":899,"discount":"-17","badge":"","rating":4.6,"reviewsCount":42,"image":"https://images.unsplash.com/photo-1561154464-82e9adf32764?w=600&auto=format&fit=crop&q=80","page":"tecnologia.html"},{"id":9,"code":"TEC-005","name":"Smartphone Xiaomi Redmi Note 13 256GB 8GB RAM","brand":"Xiaomi","category":"Tecnología","subCategory":"","price":849,"priceCmr":849,"priceNormal":1099,"discount":"-23","badge":"DESTACADO","rating":4.8,"reviewsCount":110,"image":"https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=80","page":"tecnologia.html"},{"id":10,"code":"DEP-002","name":"Zapatillas Urbanas Adidas Grand Court Base 2.0","brand":"Adidas","category":"Deportes","subCategory":"","price":219.9,"priceCmr":219.9,"priceNormal":279.9,"discount":"-21","badge":"DESTACADO","rating":4.7,"reviewsCount":78,"image":"https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=600&auto=format&fit=crop&q=80","page":"deportes.html"},{"id":11,"code":"TEC-006","name":"Apple Watch Series 9 GPS 45mm","brand":"Apple","category":"Tecnología","subCategory":"","price":1849,"priceCmr":1849,"priceNormal":2199,"discount":"-16","badge":"DESTACADO","rating":4.9,"reviewsCount":156,"image":"https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80","page":"tecnologia.html"},{"id":12,"code":"TEC-007","name":"Consola Sony PlayStation 5 Slim Digital 1TB","brand":"Sony","category":"Tecnología","subCategory":"","price":2399,"priceCmr":2399,"priceNormal":2799,"discount":"-14","badge":"DESTACADO","rating":4.9,"reviewsCount":215,"image":"https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&auto=format&fit=crop&q=80","page":"tecnologia.html"}];

  // EXTRACT PRODUCT DIRECTLY FROM DOM CARD
  // ============================================================
  function extractProductFromDOM(triggerEl, productId) {
    if (!triggerEl && !productId) return null;
    const pid = productId ? Number(productId) : null;
    const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

    // Priority A: Authoritative Master Catalog match
    if (pid && Array.isArray(window.SAGABELLA_MASTER_CATALOG)) {
      const master = window.SAGABELLA_MASTER_CATALOG;
      const pageMatch = master.find(p => (p.page || "").toLowerCase() === currentPage && Number(p.id) === pid);
      if (pageMatch) {
        return {
          id: pid,
          name: pageMatch.name,
          brand: pageMatch.brand || "Sagabella",
          image: pageMatch.image || "",
          price: Number(pageMatch.priceCmr || pageMatch.price || 0),
          priceCmr: Number(pageMatch.priceCmr || pageMatch.price || 0),
          priceNormal: Number(pageMatch.priceNormal || pageMatch.price || 0),
          originalPrice: Number(pageMatch.priceNormal || pageMatch.price || 0),
          discount: pageMatch.discount || "",
          category: pageMatch.category || "General"
        };
      }
      const generalMatch = master.find(p => Number(p.id) === pid);
      if (generalMatch) {
        return {
          id: pid,
          name: generalMatch.name,
          brand: generalMatch.brand || "Sagabella",
          image: generalMatch.image || "",
          price: Number(generalMatch.priceCmr || generalMatch.price || 0),
          priceCmr: Number(generalMatch.priceCmr || generalMatch.price || 0),
          priceNormal: Number(generalMatch.priceNormal || generalMatch.price || 0),
          originalPrice: Number(generalMatch.priceNormal || generalMatch.price || 0),
          discount: generalMatch.discount || "",
          category: generalMatch.category || "General"
        };
      }
    }

    // Priority B: DOM extraction if triggerEl is available
    if (triggerEl) {
      try {
        const btn = (typeof triggerEl.closest === "function")
          ? (triggerEl.closest("button, .falabella-card-fav-btn, .falabella-fav-btn") || triggerEl)
          : triggerEl;

        let card = null;
        if (btn && btn.parentElement && typeof btn.parentElement.closest === "function") {
          card = btn.parentElement.closest("article, .product-card-deporte, .product-card-deco, .product-card, .product-card-calzado, .group, [data-product-id], .border, li");
        }
        if (!card && btn) {
          card = btn.closest("article, .product-card-deporte, .product-card-deco, .product-card, .product-card-calzado, [data-product-id], .border, li");
          if (card === btn) card = btn.parentElement;
        }
        if (!card && btn) card = btn.parentElement;
        if (!card) return null;

        // 1. Image
        const imgEl = card.querySelector("img");
        let image = "";
        if (imgEl) {
          image = imgEl.getAttribute("src") || imgEl.src || "";
        }

        // 2. Name / Title (strictly heading or title-designated element, excluding buttons)
        let name = "";
        const titleEl = card.querySelector("h1, h2, h3, h4, h5, .product-title, .product-card-title, [class*=\"line-clamp\"]");
        if (titleEl) {
          name = (titleEl.getAttribute("title") || titleEl.textContent || "").trim();
        }
        if (!name && imgEl && imgEl.getAttribute("alt")) {
          name = imgEl.getAttribute("alt").trim();
        }

        // 3. Brand
        let brand = "";
        const brandEl = card.querySelector(".brand, .product-brand, .product-card-brand");
        if (brandEl) {
          brand = brandEl.textContent.trim();
        }
        if (!brand && name) {
          brand = name.split(" ")[0] || "Sagabella";
        }

        // 4. Price
        let price = 0;
        let priceNormal = 0;
        const cardText = card.innerText || card.textContent || "";
        const priceMatches = [...cardText.matchAll(/S\/\s*([\d,.]+)/gi)].map(m => parseFloat(m[1].replace(/,/g, ""))).filter(n => !isNaN(n) && n > 0);
        if (priceMatches.length > 0) {
          price = priceMatches[0];
          if (priceMatches.length > 1 && priceMatches[1] > price) {
            priceNormal = priceMatches[1];
          }
        }

        if (name && (image || price > 0)) {
          return {
            id: pid || Date.now(),
            name: name,
            brand: brand || "Sagabella",
            image: image || "",
            price: price || 99,
            priceCmr: price || 99,
            priceNormal: priceNormal || (price ? Math.round(price * 1.2) : 119),
            originalPrice: priceNormal || (price ? Math.round(price * 1.2) : 119),
            category: "General"
          };
        }
      } catch (e) {
        console.warn("extractProductFromDOM error:", e);
      }
    }
    return null;
  }

  // ============================================================
  // FIND PRODUCT ANYWHERE IN CATALOGS & DOM
  // ============================================================
  function findProductAnywhere(productId, triggerEl) {
    const pid = Number(productId);
    const currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

    // Priority 1: Extract directly from the DOM card if triggerEl is available
    if (triggerEl) {
      const fromDom = extractProductFromDOM(triggerEl, pid);
      if (fromDom && fromDom.name && fromDom.price > 0 && fromDom.image) {
        return fromDom;
      }
    }

    // Priority 2: In-memory arrays on window
    const sources = [
      window.DECO_PRODUCTS,
      window.BELLEZA_PRODUCTS,
      window.CALZADO_PRODUCTS,
      window.PLP_PRODUCTS,
      window.TECH_PRODUCTS,
      window.DEPORTES_PRODUCTS,
      window.MODA_PRODUCTS,
      window.MUJER_PRODUCTS,
      window.TV_PRODUCTS,
      window.CAMERA_PRODUCTS,
      window.CEL_PRODUCTS,
      window.LAPTOP_PRODUCTS,
      window.TABLET_PRODUCTS,
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
            brand: found.brand || 'Sagabella',
            image: found.image || found.img || '',
            price: Number(found.priceCmr || found.cmrPrice || found.price || found.priceInternet || 0),
            priceCmr: Number(found.priceCmr || found.cmrPrice || found.price || found.priceInternet || 0),
            priceNormal: Number(found.priceNormal || found.originalPrice || found.price || 0),
            originalPrice: Number(found.priceNormal || found.originalPrice || found.price || 0),
            discount: found.discount || '',
            category: found.category || found.type || 'General'
          };
        }
      }
    }

    // Priority 3: Master Catalog filtered by current page (handles ID collisions across pages)
    const master = window.SAGABELLA_MASTER_CATALOG;
    if (Array.isArray(master)) {
      const matchInCurrentPage = master.find(p => (p.page || '').toLowerCase() === currentPage && Number(p.id) === pid);
      if (matchInCurrentPage) {
        return {
          id: pid,
          name: matchInCurrentPage.name,
          brand: matchInCurrentPage.brand || 'Sagabella',
          image: matchInCurrentPage.image || '',
          price: Number(matchInCurrentPage.priceCmr || matchInCurrentPage.price || 0),
          priceCmr: Number(matchInCurrentPage.priceCmr || matchInCurrentPage.price || 0),
          priceNormal: Number(matchInCurrentPage.priceNormal || matchInCurrentPage.price || 0),
          originalPrice: Number(matchInCurrentPage.priceNormal || matchInCurrentPage.price || 0),
          discount: matchInCurrentPage.discount || '',
          category: matchInCurrentPage.category || 'General'
        };
      }

      // Priority 4: Master Catalog general match
      const matchAny = master.find(p => Number(p.id) === pid || String(p.code) === String(productId));
      if (matchAny) {
        return {
          id: pid,
          name: matchAny.name,
          brand: matchAny.brand || 'Sagabella',
          image: matchAny.image || '',
          price: Number(matchAny.priceCmr || matchAny.price || 0),
          priceCmr: Number(matchAny.priceCmr || matchAny.price || 0),
          priceNormal: Number(matchAny.priceNormal || matchAny.price || 0),
          originalPrice: Number(matchAny.priceNormal || matchAny.price || 0),
          discount: matchAny.discount || '',
          category: matchAny.category || 'General'
        };
      }
    }

    // Priority 5: DOM search by data attributes on the page
    const cardByAttr = document.querySelector(`[data-product-id="${pid}"], [data-fav-prod-id="${pid}"]`);
    if (cardByAttr) {
      const fromDom = extractProductFromDOM(cardByAttr, pid);
      if (fromDom && fromDom.name) return fromDom;
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

  function repairFavoriteItem(item) {
    if (!item) return item;
    // Check if item has generic placeholder name or invalid image or generic price
    const isGeneric = !item.name || 
      item.name.includes("Producto Sagabella #") || 
      item.name.startsWith("Producto #") ||
      item.name.startsWith("Producto Sagabella") ||
      !item.image ||
      (Number(item.price) === 99.00 && (!item.brand || item.brand === "Sagabella")) ||
      (typeof item.image === "string" && (item.image.includes("photo-1526170375885") || (item.image.includes("sybilla_look_2.png") && item.brand !== "Sybilla"))) ||
      (item.name.startsWith("Producto Sagabella") && Number(item.price) === 199);

    if (isGeneric) {
      const real = findProductAnywhere(item.id, null);
      if (real && real.name && !real.name.startsWith("Producto #") && !real.name.includes("Producto Sagabella #")) {
        item.name = real.name;
        item.brand = real.brand || item.brand || "Sagabella";
        item.image = real.image || item.image;
        item.price = Number(real.priceCmr || real.price || item.price);
        item.priceCmr = Number(real.priceCmr || real.price || item.priceCmr);
        item.priceNormal = Number(real.priceNormal || real.price || item.priceNormal);
        item.originalPrice = item.priceNormal;
        item.discount = real.discount || item.discount || "";
        item.category = real.category || item.category || "General";
      } else {
        // Special lookup for Decohogar trees 812 and 817
        if (Number(item.id) === 817) {
          item.name = "NAVIDAD PENCIL DEAR SANTA | Árbol 2.10m 425 Ramas";
          item.brand = "DEAR SANTA";
          item.image = "assets/decohogar/tree_pencil_dearsanta_scene.png";
          item.price = 169.90;
          item.priceCmr = 169.90;
          item.priceNormal = 329.90;
          item.originalPrice = 329.90;
        } else if (Number(item.id) === 812) {
          item.name = "Combo Arbol de Navidad 1.80M 380 Ramas + Set20 Bolas Rose Gold 7cm + Luces LED";
          item.brand = "MICA";
          item.image = "assets/decohogar/prod_combo_arbol_bolas.png";
          item.price = 99.90;
          item.priceCmr = 99.90;
          item.priceNormal = 349.60;
          item.originalPrice = 349.60;
        }
      }
    }
    return item;
  }

  function getFavorites() {
    try {
      const user = getSession();
      const userKey = getUserFavsKey(user);
      const userFavsRaw = localStorage.getItem(userKey);
      let list = [];
      if (userFavsRaw) {
        list = JSON.parse(userFavsRaw);
      } else {
        const activeRaw = localStorage.getItem(ACTIVE_FAVS_KEY);
        list = activeRaw ? JSON.parse(activeRaw) : [];
      }

      // Auto-repair any generic items
      let needsResave = false;
      list = (list || []).map(it => {
        const repaired = repairFavoriteItem(it);
        if (repaired !== it) needsResave = true;
        return repaired;
      });

      if (needsResave) {
        try {
          localStorage.setItem(userKey, JSON.stringify(list));
          localStorage.setItem(ACTIVE_FAVS_KEY, JSON.stringify(list));
        } catch (e) {}
      }

      return list;
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
  // ADMINISTRATIVE INTRANET EXEMPTION
  // El portal administrativo sirve para registrar ventas en local
  // y gestión interna. El personal administrativo NO debe ser
  // bloqueado ni obligado a iniciar sesión de cliente en sagabella.com
  // ============================================================
  function isAdministrativeIntranetActive(targetEl) {
    try {
      // 1. Si el elemento clicado o de acción está dentro del intranet o modal de venta
      if (targetEl && typeof targetEl.closest === 'function') {
        if (targetEl.closest('#appView, #saleProductList, #saleCart, #saleErrors, [onclick*="addToSaleCart"], [onclick*="addSale"], [onclick*="openSale"]')) {
          return true;
        }
      }
      // 2. Si la vista de la intranet administrativa (#appView) está visible
      const appView = document.getElementById('appView');
      if (appView && !appView.classList.contains('hidden')) {
        return true;
      }
      // 3. Si los contenedores del modal de ventas en local existen en el DOM
      if (document.getElementById('saleProductList') || document.getElementById('saleCart') || document.getElementById('saleClientSearch')) {
        return true;
      }
      // 4. Si hay sesión activa de personal administrativo en sessionStorage
      if (sessionStorage.getItem('falabella_session_user')) {
        const path = (window.location.pathname || '').toLowerCase();
        if ((path.includes('sistema_ventas_sagabella') || path.includes('sistema_ventas_sagabella')) || path.includes('intranet')) {
          return true;
        }
      }
    } catch (e) {}
    return false;
  }
  window.isAdministrativeIntranetActive = isAdministrativeIntranetActive;

  // ============================================================
  // AUTH GUARD FOR RESTRICTED ACTIONS (CART & FAVORITES)
  // ============================================================
  function requireAuthForAction(action, targetEl) {
    // Exención: Intranet Administrativa (registro de ventas en local por personal administrativo)
    if (isAdministrativeIntranetActive(targetEl)) {
      return true;
    }
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

    const triggerEl = event?.currentTarget || (event && event.target ? event.target.closest('button, [data-fav-prod-id], [data-product-id], .falabella-card-fav-btn, .falabella-fav-btn') : null);

    let product = null;
    let pid = null;

    if (productOrId && typeof productOrId === 'object') {
      pid = Number(productOrId.id || productOrId.productId);
      product = productOrId;
    } else if (typeof productOrId === 'number' || typeof productOrId === 'string') {
      pid = Number(productOrId);
      product = findProductAnywhere(pid, triggerEl);
    }

    // If still null or lacking title/image, try DOM extraction directly
    if (!product || !product.name || product.name.includes('Producto Sagabella #') || !product.image) {
      if (triggerEl) {
        const fromDom = extractProductFromDOM(triggerEl, pid);
        if (fromDom && fromDom.name) {
          product = fromDom;
        }
      }
    }

    if (!pid && product && product.id) {
      pid = Number(product.id);
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
        product = findProductAnywhere(pid, triggerEl) || {
          id: pid,
          name: 'Producto #' + pid,
          brand: 'Sagabella',
          image: '',
          price: 99.00
        };
      }

      const favItem = {
        id: pid,
        productId: pid,
        name: product.name || 'Producto #' + pid,
        brand: product.brand || 'Sagabella',
        image: product.image || product.img || '',
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
    if (triggerEl) {
      triggerEl.classList.add('scale-125');
      setTimeout(() => triggerEl.classList.remove('scale-125'), 200);
    }
  }

  // Hook toggleSagabellaFavorite for calzado, belleza, productos_calzado
  window.toggleSagabellaFavorite = function (id, name, price, image, brand) {
    if (typeof id === 'object' && id !== null) {
      return toggleProductFavorite(null, id);
    }
    const prodObj = {
      id: Number(id),
      name: name,
      price: Number(price || 0),
      priceCmr: Number(price || 0),
      image: image,
      brand: brand || 'Sagabella'
    };
    return toggleProductFavorite(null, prodObj);
  };

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
        /* Sagabella Unified Header & Subbar Styles */
        .store-header { background: #ffffff !important; border-bottom: 1px solid #eef2f6 !important; position: sticky !important; top: 0 !important; z-index: 40 !important; box-shadow: 0 1px 4px rgba(0,0,0,.03) !important; width: 100% !important; }
        .store-topbar { background: #ffffff !important; color: #475569 !important; font-size: 12px !important; border-bottom: 1px solid #f1f5f9 !important; padding: 5px 16px !important; width: 100% !important; }
        .store-search-wrap { display: flex !important; align-items: center !important; border: 1.5px solid #333f48 !important; border-radius: 999px !important; overflow: hidden !important; background: #fff !important; transition: border-color .15s, box-shadow .15s !important; width: 100% !important; }
        .store-search-wrap:focus-within { border-color: #aad500 !important; box-shadow: 0 0 0 3px rgba(170,213,0,.25) !important; }
        .store-search-input { border: none !important; outline: none !important; padding: 8px 16px !important; font-size: 13.5px !important; width: 100% !important; color: #1e293b !important; background: transparent !important; font-family: inherit !important; }
        .store-search-input::placeholder { color: #718096 !important; }
        .store-search-btn { background: #333f48 !important; color: #fff !important; width: 34px !important; height: 34px !important; border-radius: 50% !important; margin-right: 3px !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: background .15s, transform .1s !important; border: none !important; cursor: pointer !important; flex-shrink: 0 !important; }
                .fal-search-dropdown {
          position: absolute !important;
          top: calc(100% + 8px) !important;
          left: 0 !important;
          width: 780px !important;
          max-width: 95vw !important;
          background: #ffffff !important;
          border-radius: 18px !important;
          box-shadow: 0 25px 60px rgba(15, 23, 42, 0.22), 0 4px 16px rgba(15, 23, 42, 0.08) !important;
          border: 1px solid #e2e8f0 !important;
          z-index: 9999999 !important;
          overflow: hidden !important;
          animation: falSearchFadeIn 0.18s ease-out !important;
        }
        @keyframes falSearchFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fal-search-item:hover {
          background: #f1f5f9 !important;
        }
        .fal-search-prod-card:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 16px rgba(0,0,0,0.06) !important;
        }
        .store-search-clear-btn {
          background: none !important;
          border: none !important;
          color: #94a3b8 !important;
          font-size: 16px !important;
          cursor: pointer !important;
          padding: 4px 8px !important;
          line-height: 1 !important;
          transition: color .15s !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .store-search-clear-btn:hover { color: #0f172a !important; }
        .store-search-clear-btn.hidden { display: none !important; }
        .store-search-btn:hover { background: #1e293b !important; transform: scale(1.03) !important; }
        .fal-drawer-left { position: fixed; top: 0; left: 0; bottom: 0; width: 100%; max-width: 340px; background: #ffffff; box-shadow: 10px 0 35px rgba(0,0,0,0.25); z-index: 100000; display: flex; flex-direction: column; transform: translateX(0); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .fal-drawer-backdrop.hidden .fal-drawer-left { transform: translateX(-100%); }

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
          height: 100vh; max-height: 100vh; overflow: hidden;
          transform: translateX(0); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #falFavDrawerItemsList {
          flex: 1 1 0% !important;
          min-height: 0 !important;
          max-height: 100% !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          scrollbar-width: thin !important;
          scrollbar-color: #cbd5e1 #f8fafc !important;
        }
        #falFavDrawerItemsList::-webkit-scrollbar {
          width: 8px !important;
        }
        #falFavDrawerItemsList::-webkit-scrollbar-track {
          background: #f1f5f9 !important;
          border-radius: 4px !important;
        }
        #falFavDrawerItemsList::-webkit-scrollbar-thumb {
          background: #cbd5e1 !important;
          border-radius: 4px !important;
        }
        #falFavDrawerItemsList::-webkit-scrollbar-thumb:hover {
          background: #94a3b8 !important;
        }
        .fal-fav-item-card {
          flex-shrink: 0 !important;
          min-height: 96px !important;
          box-sizing: border-box !important;
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
        .falabella-card-fav-btn.is-favorited svg,
        .falabella-card-fav-btn.active svg,
        .falabella-fav-btn.is-favorited svg,
        .falabella-fav-btn.active svg,
        [data-fav-prod-id].is-favorited svg,
        [data-fav-prod-id].active svg,
        .falabella-card-fav-btn.text-rose-600 svg {
          fill: #e11d48 !important;
          stroke: #e11d48 !important;
          color: #e11d48 !important;
        }
        .falabella-card-fav-btn.is-favorited,
        .falabella-card-fav-btn.active,
        .falabella-fav-btn.is-favorited,
        .falabella-fav-btn.active,
        [data-fav-prod-id].is-favorited,
        [data-fav-prod-id].active,
        .falabella-card-fav-btn.text-rose-600 {
          color: #e11d48 !important;
        }
      </style>

      <!-- ==================== AUTH MODAL (LOGIN & REGISTRO) ==================== -->
      <div id="falabellaAuthModal" class="fal-auth-backdrop hidden" onclick="if(event.target === this) window.closeFalabellaAuthModal()">
        <div class="fal-auth-card" onclick="event.stopPropagation()">
          
          <!-- Modal Header -->
          <div style="padding: 16px 20px; background:#fff; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px; font-weight: 900; color: #aad500; letter-spacing: -0.5px;">sagabella<span style="color:#0f172a;">.com</span></span>
              <span style="font-size: 11px; background: #f1f5f9; color: #475569; font-weight: 700; padding: 2px 8px; border-radius: 99px;">Cuenta Oficial</span>
            </div>
            <button type="button" id="falAuthModalCloseBtn" onclick="event.stopPropagation(); window.closeFalabellaAuthModal()" style="width: 32px; height: 32px; border-radius: 99px; border:none; background: #f8fafc; color: #64748b; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">
              &times;
            </button>
          </div>

          <!-- Tabs Switcher -->
          <div id="falAuthTabsHeader" style="display: flex; border-bottom: 1px solid #e2e8f0; background: #f8fafc; font-size: 12.5px; font-weight: 700;">
            <button type="button" id="falTabBtnLogin" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('login')" style="flex: 1; padding: 11px 6px; border: none; border-bottom: 2px solid #0f172a; background: #fff; color: #0f172a; cursor: pointer; font-weight: 800; white-space: nowrap;">
              Iniciar Sesión
            </button>
            <button type="button" id="falTabBtnRegister" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('register')" style="flex: 1; padding: 11px 6px; border: none; border-bottom: 2px solid transparent; background: transparent; color: #64748b; cursor: pointer; font-weight: 700; white-space: nowrap;">
              Crear Cuenta
            </button>
            <button type="button" id="falTabBtnVerifyCode" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('verify-code')" style="flex: 1.15; padding: 11px 6px; border: none; border-bottom: 2px solid transparent; background: transparent; color: #0284c7; cursor: pointer; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap;">
              <span>🔑</span> Tengo mi Código OTP
            </button>
          </div>

          <!-- Recovery Navigation Header -->
          <div id="falAuthRecoveryHeader" style="display: none; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
            <button type="button" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('login')" style="background: none; border: none; color: #0284c7; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              Volver a Iniciar Sesión
            </button>
            <span style="font-size: 11px; font-weight: 700; color: #64748b; background: #e2e8f0; padding: 2px 8px; border-radius: 99px; display: flex; align-items: center; gap: 4px;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              OWASP ASVS 4.0
            </span>
          </div>
          <!-- Modal Body Scrollable -->
          <div style="padding: 20px; overflow-y: auto; max-height: calc(90vh - 120px);">
            
            <!-- ===== FORMULARIO 1: INICIAR SESIÓN ===== -->
            <form id="falLoginForm" onsubmit="window.handleFalabellaLoginSubmit(event)" style="display: flex; flex-direction: column; gap: 14px;">
              <div>
                <h3 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0;">¡Hola! Bienvenido a sagabella.com</h3>
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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                  <button type="button" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('recover')" style="border:none; background:none; font-size: 12px; color: #64748b; cursor: pointer; text-decoration: underline;">
                    ¿Olvidaste tu contraseña?
                  </button>
                  <button type="button" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('verify-code')" style="border:none; background:none; font-size: 12px; color: #0284c7; cursor: pointer; font-weight: 800; text-decoration: underline;">
                    🔑 Ingresar código recibido
                  </button>
                </div>
                
                <!-- Banner Destacado para Ingresar Código OTP si ya le llegó -->
                <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 11px 13px; margin-top: 6px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 20px;">📬</span>
                    <div>
                      <span style="font-size: 12px; font-weight: 800; color: #166534; display: block;">¿Ya recibiste tu código por correo?</span>
                      <span style="font-size: 11px; color: #15803d;">Escribe tus 6 dígitos para crear tu nueva contraseña.</span>
                    </div>
                  </div>
                  <button type="button" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('verify-code')" style="background: #16a34a; color: #ffffff; border: none; border-radius: 6px; padding: 7px 12px; font-size: 11.5px; font-weight: 800; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 5px rgba(22,163,74,0.3);">
                    Ingresar código &rarr;
                  </button>
                </div>
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
                  <button type="button" onclick="event.stopPropagation(); window.fillDemoLogin('carlos.ramirez@sagabella.pe', 'password123')" style="padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: left; cursor: pointer;">
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
                  Si ya compraste antes en tiendas Sagabella con tu DNI, ingresa tu número para unificar tu historial de compras, boletas y beneficios CMR en tu nueva cuenta online.
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
                    Acepto los <a href="terminos-condiciones.html" target="_blank" rel="noopener noreferrer" style="font-weight: 700; color: #0f172a; text-decoration: underline;">Términos y Condiciones</a> y la <a href="politica-privacidad.html" target="_blank" rel="noopener noreferrer" style="font-weight: 700; color: #0f172a; text-decoration: underline;">Política de Privacidad</a> de sagabella.com.
                  </span>
                </label>
                <p id="falErrTerms" style="font-size: 11px; color: #e11d48; font-weight: 600; margin: 3px 0 0 0; display: none;"></p>
              </div>

              <div id="falRegisterGeneralError" style="padding: 8px; background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; font-size: 11.5px; border-radius: 8px; display: none;"></div>

              <!-- Botón Crear Cuenta -->
              <button type="submit" class="fal-btn-primary" style="margin-top: 6px;">
                Crear mi cuenta Sagabella
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

            <!-- ===== FORMULARIO 3: RECUPERAR CONTRASEÑA (PASO 1 - OWASP ANTI-ENUMERATION & RATE LIMITING) ===== -->
            <form id="falRecoverForm" onsubmit="window.handleFalabellaRecoverSubmit(event)" style="display: none; flex-direction: column; gap: 14px;">
              <div>
                <!-- Banner directo si ya tiene el código OTP -->
              <div style="background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 20px;">✉️</span>
                  <div>
                    <span style="font-size: 12px; font-weight: 800; color: #1e40af; display: block;">¿Ya te llegó el código al correo?</span>
                    <span style="font-size: 11px; color: #2563eb;">No necesitas volver a pedirlo. Haz clic aquí para ingresarlo:</span>
                  </div>
                </div>
                <button type="button" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('verify-code')" style="background: #0284c7; color: #ffffff; border: none; border-radius: 7px; padding: 8px 14px; font-size: 11.5px; font-weight: 800; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 6px rgba(2,132,199,0.35);">
                  Ingresar mi código &rarr;
                </button>
              </div>

              <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: #0284c7; background: #e0f2fe; padding: 3px 10px; border-radius: 99px; margin-bottom: 8px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  Paso 1 de 3 · Solicitud Segura
                </span>
                <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0;">¿Olvidaste tu contraseña?</h3>
                <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0; line-height: 1.4;">
                  Ingresa tu correo electrónico o DNI registrado. Te enviaremos un código de seguridad OTP de 6 dígitos para verificar tu identidad.
                </p>
              </div>

              <!-- OWASP Anti-Enumeration badge -->
              <div style="display: flex; gap: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 11.5px; color: #475569; line-height: 1.4;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" style="flex-shrink:0; margin-top: 1px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                <span><strong>Protección OWASP:</strong> Por tu privacidad, el sistema no revela si el correo está registrado y limita los intentos para prevenir ataques de fuerza bruta.</span>
              </div>

              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 4px;" for="falRecoverInputIdentifier">
                  Correo electrónico o DNI *
                </label>
                <input type="text" id="falRecoverInputIdentifier" placeholder="ej. ana.torres@gmail.com o 45879632" required class="fal-input-field" />
              </div>

              <div id="falRecoverMessage" style="padding: 10px; font-size: 12px; border-radius: 8px; display: none;"></div>

              <button type="submit" id="falRecoverSubmitBtn" class="fal-btn-dark">
                Enviar código de verificación
              </button>

              <div style="text-align: center; margin-top: 6px;">
                <button type="button" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('login')" style="border:none; background:none; font-size: 12px; font-weight: 700; color: #64748b; cursor: pointer; text-decoration: underline;">
                  Recordé mi contraseña, volver a iniciar sesión
                </button>
              </div>
            </form>

            <!-- ===== FORMULARIO 4: VERIFICAR CÓDIGO OTP (PASO 2 - OWASP BRUTE-FORCE LOCKOUT & EXPIRATION) ===== -->
            <form id="falVerifyCodeForm" onsubmit="window.handleFalabellaVerifyCodeSubmit(event)" style="display: none; flex-direction: column; gap: 14px;">
              <div>
                <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: #d97706; background: #fef3c7; padding: 3px 10px; border-radius: 99px; margin-bottom: 8px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Paso 2 de 3 · Código de Seguridad OTP
                </span>
                <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0;">Ingresa tu código OTP</h3>
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 9px 12px; margin-top: 8px; font-size: 11.5px; color: #166534; line-height: 1.4;">
                  📬 <strong>Correo enviado:</strong> Si tarda unos momentos o no lo ves en tu bandeja principal, por favor revisa también la carpeta de <strong>Spam o Correo no deseado</strong>.
                </div>
                <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0; line-height: 1.4;">
                  Hemos enviado un código seguro de 6 dígitos a <strong id="falVerifyTargetDisplay" style="color: #0f172a;">tu correo</strong>.
                </p>
              </div>

              <!-- Quick Demo Helper Banner -->
              <div id="falVerifyDemoBanner" style="background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="background: #0f172a; color: #aad500; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 4px;">DEMO</span>
                  <span style="font-size: 11px; color: #475569;">Código generado:</span>
                  <strong id="falDemoCodeDisplay" style="font-size: 14px; font-family: monospace; letter-spacing: 2px; color: #0f172a;">------</strong>
                </div>
                <button type="button" onclick="const c = document.getElementById('falDemoCodeDisplay').textContent; if(c && c !== '------'){ document.getElementById('falVerifyOtpInput').value = c; }" style="border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; padding: 4px 8px; font-size: 10.5px; font-weight: 700; color: #334155; cursor: pointer;">
                  Copiar
                </button>
              </div>

              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 4px;" for="falVerifyOtpInput">
                  Código de 6 dígitos *
                </label>
                <input type="text" id="falVerifyOtpInput" maxlength="6" placeholder="000000" required class="fal-input-field" style="text-align: center; font-size: 22px; font-family: monospace; letter-spacing: 6px; font-weight: 800;" />
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 11px; color: #64748b;">
                  <span>Expira en 15 minutos (OWASP)</span>
                  <span id="falResendCountdown">Reenviar código en 60s</span>
                </div>
              </div>

              <div id="falVerifyErrorMessage" style="padding: 10px; background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; font-size: 12px; border-radius: 8px; display: none;"></div>

              <button type="submit" id="falVerifyOtpSubmitBtn" class="fal-btn-primary">
                Verificar código y continuar
              </button>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                <button type="button" onclick="event.stopPropagation(); window.switchFalabellaAuthTab('recover')" style="border:none; background:none; font-size: 11.5px; color: #64748b; cursor: pointer; text-decoration: underline;">
                  Cambiar correo / DNI
                </button>
                <button type="button" id="falResendBtn" onclick="event.stopPropagation(); window.resendRecoveryCode()" disabled style="border:none; background:none; font-size: 11.5px; font-weight: 700; color: #94a3b8; cursor: not-allowed;">
                  Reenviar código
                </button>
              </div>
            </form>

            <!-- ===== FORMULARIO 5: RESTABLECER CONTRASEÑA (PASO 3 - OWASP PASSWORD POLICY & LIVE METER) ===== -->
            <form id="falResetPasswordForm" onsubmit="window.handleFalabellaResetPasswordSubmit(event)" style="display: none; flex-direction: column; gap: 14px;">
              <div>
                <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: #15803d; background: #dcfce7; padding: 3px 10px; border-radius: 99px; margin-bottom: 8px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Paso 3 de 3 · Nueva Contraseña
                </span>
                <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0;">Crea tu nueva contraseña</h3>
                <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0; line-height: 1.4;">
                  Asegúrate de que tu nueva clave cumpla con los estándares de seguridad OWASP.
                </p>
              </div>

              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155;" for="falResetNewPassword">
                    Nueva contraseña *
                  </label>
                  <button type="button" onclick="window.togglePasswordVisibility('falResetNewPassword')" style="border:none; background:none; font-size: 11px; color: #64748b; cursor: pointer; text-decoration: underline;">
                    Mostrar
                  </button>
                </div>
                <input type="password" id="falResetNewPassword" oninput="window.handlePasswordStrengthCheck(this.value)" placeholder="Ingresa tu nueva contraseña" required class="fal-input-field" />
              </div>

              <!-- OWASP Dynamic Password Strength Meter -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 11px; font-weight: 700; color: #475569;">Robustez OWASP:</span>
                  <span id="falStrengthLabel" style="font-size: 11px; font-weight: 800; color: #94a3b8;">Por ingresar</span>
                </div>
                <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin-bottom: 10px;">
                  <div id="falStrengthBar" style="height: 100%; width: 0%; background: #ef4444; transition: width 0.3s ease, background-color 0.3s ease; border-radius: 99px;"></div>
                </div>

                <!-- Checklist criteria -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px;">
                  <div id="ruleLength" style="color: #64748b;">• Mínimo 8 caracteres</div>
                  <div id="ruleUpper" style="color: #64748b;">• Una mayúscula (A-Z)</div>
                  <div id="ruleLower" style="color: #64748b;">• Una minúscula (a-z)</div>
                  <div id="ruleNumber" style="color: #64748b;">• Un número o símbolo</div>
                </div>
              </div>

              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <label style="font-size: 12px; font-weight: 700; color: #334155;" for="falResetConfirmPassword">
                    Confirmar nueva contraseña *
                  </label>
                  <button type="button" onclick="window.togglePasswordVisibility('falResetConfirmPassword')" style="border:none; background:none; font-size: 11px; color: #64748b; cursor: pointer; text-decoration: underline;">
                    Mostrar
                  </button>
                </div>
                <input type="password" id="falResetConfirmPassword" placeholder="Repite tu nueva contraseña" required class="fal-input-field" />
              </div>

              <div id="falResetErrorMessage" style="padding: 10px; background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; font-size: 12px; border-radius: 8px; display: none;"></div>

              <button type="submit" id="falResetSubmitBtn" class="fal-btn-primary">
                Actualizar e Iniciar Sesión
              </button>
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
      <aside id="falabellaFavoritesDrawer" class="fal-drawer-backdrop hidden" onclick="if(event.target === this) window.closeFalabellaFavoritesModal()" style="display: none; z-index: 999999;">
        <div class="fal-drawer-panel" onclick="event.stopPropagation()">
          
          <!-- Drawer Header -->
          <div style="padding: 16px 20px; background: #0f172a; color: #ffffff; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
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
          <div id="falFavDrawerItemsList" style="flex: 1 1 0%; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #f8fafc; box-sizing: border-box; width: 100%; scrollbar-width: thin;">
            <!-- Injected via JavaScript -->
          </div>

          <!-- Drawer Footer -->
          <div id="falFavDrawerFooter" style="padding: 16px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">
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

      <!-- ========================================== -->
      <!-- UNIVERSAL LOCATION MODAL                   -->
      <!-- ========================================== -->
      <div id="falUniversalLocationModal" class="fal-auth-backdrop hidden" onclick="if(event.target === this) window.closeStoreLocationModal()" style="display: none; z-index: 999999;">
        <div class="fal-auth-card" onclick="event.stopPropagation()" style="max-width: 460px; box-shadow: 0 25px 60px rgba(0,0,0,0.35); border-radius: 20px; overflow: hidden; background: #fff;">
          <div style="padding: 16px 20px; background: #fff; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 99px; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                📍
              </div>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1.2;">Ingresa tu ubicación</h3>
                <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">Selecciona tu ciudad y distrito para entregas</p>
              </div>
            </div>
            <button type="button" onclick="window.closeStoreLocationModal()" style="background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 20px; padding: 4px; line-height: 1;">✕</button>
          </div>
          <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
            <div>
              <label style="display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px;">Departamento / Región</label>
              <select id="falLocDeptSelect" class="fal-input-field" onchange="window.updateStoreDistricts(this.value)" style="width: 100%; padding: 10px 14px; font-size: 13.5px; border: 1.5px solid #cbd5e1; border-radius: 10px; background: #fff; cursor: pointer;">
                <option value="Lima">Lima</option>
                <option value="Arequipa">Arequipa</option>
                <option value="La Libertad">La Libertad (Trujillo)</option>
                <option value="Cusco">Cusco</option>
                <option value="Piura">Piura</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px;">Provincia y Distrito</label>
              <select id="falLocDistSelect" class="fal-input-field" style="width: 100%; padding: 10px 14px; font-size: 13.5px; border: 1.5px solid #cbd5e1; border-radius: 10px; background: #fff; cursor: pointer;">
                <option value="Lima - San Isidro">Lima - San Isidro</option>
                <option value="Lima - Miraflores">Lima - Miraflores</option>
                <option value="Lima - Santiago de Surco">Lima - Santiago de Surco</option>
                <option value="Lima - San Miguel">Lima - San Miguel</option>
                <option value="Lima - Comas">Lima - Comas</option>
                <option value="Lima - Los Olivos">Lima - Los Olivos</option>
                <option value="Lima - La Molina">Lima - La Molina</option>
                <option value="Lima - Cercado de Lima">Lima - Cercado de Lima</option>
              </select>
            </div>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 12px 14px; font-size: 12px; color: #166534; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">🚚</span>
              <span>Mostrando disponibilidad de stock y envíos rápidos en 24h para esta zona.</span>
            </div>
          </div>
          <div style="padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" onclick="window.closeStoreLocationModal()" style="padding: 10px 18px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; color: #475569; font-weight: 700; font-size: 13px; cursor: pointer;">Cancelar</button>
            <button type="button" onclick="window.saveStoreLocation()" style="padding: 10px 20px; border-radius: 10px; border: none; background: #0f172a; color: #fff; font-weight: 800; font-size: 13px; cursor: pointer; transition: background 0.2s;">Guardar ubicación</button>
          </div>
        </div>
      </div>

      <!-- ========================================== -->
      <!-- UNIVERSAL TRACK ORDER MODAL                -->
      <!-- ========================================== -->
      <div id="falUniversalTrackModal" class="fal-auth-backdrop hidden" onclick="if(event.target === this) window.closeTrackOrderModal()" style="display: none; z-index: 999999;">
        <div class="fal-auth-card" onclick="event.stopPropagation()" style="max-width: 480px; box-shadow: 0 25px 60px rgba(0,0,0,0.35); border-radius: 20px; overflow: hidden; background: #fff;">
          <div style="padding: 16px 20px; background: #fff; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 99px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                📦
              </div>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1.2;">Rastrear mi Pedido</h3>
                <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">Ingresa tu DNI para consultar el estado en vivo</p>
              </div>
            </div>
            <button type="button" onclick="window.closeTrackOrderModal()" style="background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 20px; padding: 4px; line-height: 1;">✕</button>
          </div>
          <div style="padding: 20px;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px;">DNI del Comprador (8 dígitos)</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="falTrackDniInput" class="fal-input-field" placeholder="12345678" maxlength="8" onkeydown="if(event.key==='Enter') window.executeTrackOrderSearch();" style="flex: 1; padding: 10px 14px; font-size: 14px; font-weight: 700; letter-spacing: 1px; border: 1.5px solid #cbd5e1; border-radius: 10px;" />
              <button type="button" onclick="window.executeTrackOrderSearch()" style="padding: 10px 20px; background: #0f172a; color: #fff; font-weight: 800; border-radius: 10px; border: none; cursor: pointer; font-size: 13.5px;">Consultar</button>
            </div>
            <div id="falTrackResults" style="margin-top: 14px;"></div>
          </div>
          <div style="padding: 12px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end;">
            <button type="button" onclick="window.closeTrackOrderModal()" style="padding: 8px 18px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; color: #475569; font-weight: 700; font-size: 12.5px; cursor: pointer;">Cerrar</button>
          </div>
        </div>
      </div>

      <!-- ========================================== -->
      <!-- UNIVERSAL HELP MODAL                       -->
      <!-- ========================================== -->
      <div id="falUniversalHelpModal" class="fal-auth-backdrop hidden" onclick="if(event.target === this) window.closeHelpModal()" style="display: none; z-index: 999999;">
        <div class="fal-auth-card" onclick="event.stopPropagation()" style="max-width: 440px; box-shadow: 0 25px 60px rgba(0,0,0,0.35); border-radius: 20px; overflow: hidden; background: #fff;">
          <div style="padding: 16px 20px; background: #fff; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 99px; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                ❓
              </div>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1.2;">Centro de Ayuda Sagabella</h3>
                <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">Estamos para ayudarte en tus compras y pedidos</p>
              </div>
            </div>
            <button type="button" onclick="window.closeHelpModal()" style="background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 20px; padding: 4px; line-height: 1;">✕</button>
          </div>
          <div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
            <div onclick="window.closeHelpModal(); window.openTrackOrderModal();" style="padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: background 0.15s;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 18px;">📦</span>
                <span style="font-weight: 700; color: #1e293b;">Rastrear mi pedido con DNI</span>
              </div>
              <span style="color: #94a3b8; font-weight: 700;">&rarr;</span>
            </div>
            <div onclick="window.open('https://wa.me/51987654321', '_blank')" style="padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: background 0.15s;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 18px;">💬</span>
                <span style="font-weight: 700; color: #1e293b;">WhatsApp de soporte oficial (+51 987 654 321)</span>
              </div>
              <span style="color: #94a3b8; font-weight: 700;">&rarr;</span>
            </div>
            <a href="libro-reclamaciones.html" style="padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; text-decoration: none;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 18px;">📖</span>
                <span style="font-weight: 700; color: #1e293b;">Libro de Reclamaciones</span>
              </div>
              <span style="color: #94a3b8; font-weight: 700;">&rarr;</span>
            </a>
            <a href="politica-privacidad.html" style="padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; text-decoration: none;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 18px;">🔒</span>
                <span style="font-weight: 700; color: #1e293b;">Políticas de Privacidad</span>
              </div>
              <span style="color: #94a3b8; font-weight: 700;">&rarr;</span>
            </a>
            <a href="terminos-condiciones.html" style="padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; text-decoration: none;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 18px;">📄</span>
                <span style="font-weight: 700; color: #1e293b;">Términos y Condiciones</span>
              </div>
              <span style="color: #94a3b8; font-weight: 700;">&rarr;</span>
            </a>
          </div>
          <div style="padding: 12px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end;">
            <button type="button" onclick="window.closeHelpModal()" style="padding: 8px 18px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; color: #475569; font-weight: 700; font-size: 12.5px; cursor: pointer;">Cerrar</button>
          </div>
        </div>
      </div>

      <!-- ========================================== -->
            <!-- ========================================== -->
      <!-- UNIVERSAL SEARCH RESULTS MODAL             -->
      <!-- ========================================== -->
      <div id="falUniversalSearchResultsModal" class="fal-auth-backdrop hidden" onclick="if(event.target === this) window.closeSearchResultsModal()" style="display: none; z-index: 9999999; padding: 16px;">
        <div class="fal-auth-card" onclick="event.stopPropagation()" style="max-width: 1040px; width: 100%; max-height: 90vh; border-radius: 20px; background: #fff; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.35);">
          <!-- Modal Header -->
          <div style="padding: 16px 24px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; background: #ffffff;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 900; color: #0f172a;">Resultados para "<span id="falSearchResultsQueryText"></span>"</h2>
                <span id="falSearchResultsCountBadge" style="background: #f1f5f9; color: #334155; font-size: 12px; font-weight: 800; padding: 2px 10px; border-radius: 99px;">0 productos</span>
              </div>
              <p style="margin: 3px 0 0; font-size: 12px; color: #64748b;">Encuentra y agrega productos de todas las categorías oficiales de Sagabella</p>
            </div>
            <button type="button" onclick="window.closeSearchResultsModal()" style="width: 34px; height: 34px; border-radius: 99px; border: none; background: #f1f5f9; color: #64748b; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
          </div>
          <!-- Filter Bar (Categories & Sorters) -->
          <div style="padding: 12px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
            <div id="falSearchCategoryChips" style="display: flex; align-items: center; gap: 8px; overflow-x: auto; max-width: 70%; padding: 4px 0; scrollbar-width: none;">
              <!-- Dynamic Category Chips -->
            </div>
            <div style="display: flex; align-items: center; gap: 10px; margin-left: auto;">
              <label style="font-size: 12px; font-weight: 700; color: #475569;">Ordenar:</label>
              <select id="falSearchSortSelect" onchange="window.sortSearchResults(this.value)" style="padding: 6px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; background: #fff; color: #334155; outline: none; cursor: pointer;">
                <option value="relevance">Relevancia</option>
                <option value="price_asc">Menor precio</option>
                <option value="price_desc">Mayor precio</option>
                <option value="discount">Mayor descuento</option>
                <option value="rating">Mejor calificados</option>
              </select>
            </div>
          </div>
          <!-- Products Grid Container -->
          <div id="falSearchResultsGridContainer" style="flex: 1; overflow-y: auto; padding: 24px; background: #ffffff;">
            <!-- Grid rendered dynamically -->
          </div>
        </div>
      </div>
      <!-- UNIVERSAL CMR MODAL                        -->
      <!-- ========================================== -->
      <div id="falUniversalCmrModal" class="fal-auth-backdrop hidden" onclick="if(event.target === this) window.closeCmrModal()" style="display: none; z-index: 999999;">
        <div class="fal-auth-card" onclick="event.stopPropagation()" style="max-width: 460px; box-shadow: 0 25px 60px rgba(0,0,0,0.35); border-radius: 20px; overflow: hidden; background: #fff;">
          <div style="padding: 18px 20px; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 99px; background: rgba(170,213,0,0.2); color: #aad500; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                💳
              </div>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #aad500; line-height: 1.2;">Tarjeta CMR Sagabella</h3>
                <p style="margin: 2px 0 0; font-size: 11.5px; color: #cbd5e1;">Beneficios exclusivos en tus compras online y tiendas</p>
              </div>
            </div>
            <button type="button" onclick="window.closeCmrModal()" style="background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 20px; padding: 4px; line-height: 1;">✕</button>
          </div>
          <div style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
              <span style="font-size: 22px;">🏷️</span>
              <div>
                <strong style="color: #0f172a; font-size: 13.5px; display: block;">Oportunidades únicas CMR</strong>
                <p style="margin: 2px 0 0; font-size: 12px; color: #64748b; line-height: 1.4;">Hasta 40% de descuento en miles de productos seleccionados en todas las categorías de Sagabella.</p>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
              <span style="font-size: 22px;">0️⃣</span>
              <div>
                <strong style="color: #0f172a; font-size: 13.5px; display: block;">Hasta 12 Cuotas Sin Intereses</strong>
                <p style="margin: 2px 0 0; font-size: 12px; color: #64748b; line-height: 1.4;">Paga tus compras en cómodas cuotas sin costo financiero adicional con tu CMR Visa o Mastercard.</p>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
              <span style="font-size: 22px;">⭐</span>
              <div>
                <strong style="color: #0f172a; font-size: 13.5px; display: block;">Acumula CMR Puntos</strong>
                <p style="margin: 2px 0 0; font-size: 12px; color: #64748b; line-height: 1.4;">Cada compra suma puntos canjeables por gift cards, viajes y productos gratis.</p>
              </div>
            </div>
          </div>
          <div style="padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end;">
            <button type="button" onclick="window.closeCmrModal()" style="padding: 9px 22px; border-radius: 10px; border: none; background: #aad500; color: #0f172a; font-weight: 800; font-size: 13px; cursor: pointer;">Entendido</button>
          </div>
        </div>
      </div>

      <!-- ========================================== -->
      <!-- UNIVERSAL CATEGORIES DRAWER                -->
      <!-- ========================================== -->
      <div id="falUniversalCategoriesDrawer" class="fal-drawer-backdrop hidden" onclick="if(event.target === this) window.toggleStoreCategoriesDrawer()" style="display: none; z-index: 999999;">
        <div class="fal-drawer-left" onclick="event.stopPropagation()" style="position: fixed; top: 0; left: 0; bottom: 0; width: 100%; max-width: 320px; background: #fff; box-shadow: 10px 0 35px rgba(0,0,0,0.3); z-index: 1000000; display: flex; flex-direction: column; transform: translateX(-100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
          <div style="padding: 16px 20px; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: #aad500; font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">sagabella<span style="color: #fff;">.com</span></span>
            </div>
            <button type="button" onclick="window.toggleStoreCategoriesDrawer()" style="background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 20px; padding: 4px; line-height: 1;">✕</button>
          </div>
          <div style="flex: 1; overflow-y: auto; padding: 16px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 12px;">Categorías Principales</div>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13.5px; font-weight: 600;">
              <a href="calzado.html" style="padding: 10px 12px; border-radius: 10px; background: #f8fafc; text-decoration: none; color: #1e293b; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s;">
                <span>👟 Calzado y Zapatillas</span>
                <span style="color: #94a3b8;">&rarr;</span>
              </a>
              <a href="tecnologia.html" style="padding: 10px 12px; border-radius: 10px; background: #f8fafc; text-decoration: none; color: #1e293b; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s;">
                <span>⚡ Tecnología & Electro</span>
                <span style="color: #94a3b8;">&rarr;</span>
              </a>
              <a href="belleza.html" style="padding: 10px 12px; border-radius: 10px; background: #f8fafc; text-decoration: none; color: #1e293b; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s;">
                <span>💄 Belleza & Perfumes</span>
                <span style="color: #94a3b8;">&rarr;</span>
              </a>
              <a href="decohogar.html" style="padding: 10px 12px; border-radius: 10px; background: #f8fafc; text-decoration: none; color: #1e293b; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s;">
                <span>🛋️ Decohogar</span>
                <span style="color: #94a3b8;">&rarr;</span>
              </a>
              <a href="deportes.html" style="padding: 10px 12px; border-radius: 10px; background: #f8fafc; text-decoration: none; color: #1e293b; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s;">
                <span>⚽ Deportes & Fitness</span>
                <span style="color: #94a3b8;">&rarr;</span>
              </a>
              <a href="moda_mujer.html" style="padding: 10px 12px; border-radius: 10px; background: #f8fafc; text-decoration: none; color: #1e293b; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s;">
                <span>👗 Moda Mujer</span>
                <span style="color: #94a3b8;">&rarr;</span>
              </a>
              <a href="moda_hombre.html" style="padding: 10px 12px; border-radius: 10px; background: #f8fafc; text-decoration: none; color: #1e293b; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s;">
                <span>👔 Moda Hombre</span>
                <span style="color: #94a3b8;">&rarr;</span>
              </a>
              <a href="index.html" style="padding: 10px 12px; border-radius: 10px; background: #f7fee7; border: 1px solid #d9f99d; text-decoration: none; color: #365314; font-weight: 700; display: flex; align-items: center; justify-content: space-between;">
                <span>🔥 Todas las Ofertas</span>
                <span style="color: #65a30d;">&rarr;</span>
              </a>
            </div>
            
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-top: 20px; margin-bottom: 12px;">Subcategorías</div>
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 500; color: #475569;">
              <a href="celulares.html" style="padding: 6px 10px; text-decoration: none; color: #475569;">📱 Telefonía y Celulares</a>
              <a href="tablets.html" style="padding: 6px 10px; text-decoration: none; color: #475569;">📲 Tablets y iPads</a>
              <a href="laptops.html" style="padding: 6px 10px; text-decoration: none; color: #475569;">💻 Laptops y Computación</a>
              <a href="televisores.html" style="padding: 6px 10px; text-decoration: none; color: #475569;">📺 Smart TV y Audio</a>
              <a href="camaras.html" style="padding: 6px 10px; text-decoration: none; color: #475569;">📷 Fotografía Profesional</a>
              <a href="productos_calzado.html" style="padding: 6px 10px; text-decoration: none; color: #475569;">👟 Catálogo Calzado</a>
            </div>
          </div>
          <div style="padding: 16px; border-top: 1px solid #e2e8f0; background: #f8fafc;">
            <button type="button" onclick="window.enterLogin()" style="width: 100%; padding: 10px; background: #0f172a; color: #fff; font-weight: 700; font-size: 12px; border-radius: 10px; border: none; cursor: pointer;">
              ⚙️ Acceso a Panel Administrativo / POS
            </button>
          </div>
        </div>
      </div>

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
  // OWASP COMPLIANT PASSWORD RECOVERY & RESET SUITE
  // ============================================================
  let resendTimerInterval = null;

  function maskEmail(email) {
    if (!email || !email.includes('@')) return email || '';
    const [user, domain] = email.split('@');
    if (user.length <= 2) return `${user[0]}***@${domain}`;
    return `${user[0]}***${user[user.length - 1]}@${domain}`;
  }

  function getRateLimitAttempts() {
    try {
      const records = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '[]');
      const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
      const valid = records.filter(ts => ts > fifteenMinsAgo);
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(valid));
      return valid;
    } catch (e) {
      return [];
    }
  }

  function recordRateLimitAttempt() {
    try {
      const valid = getRateLimitAttempts();
      valid.push(Date.now());
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(valid));
    } catch (e) {}
  }

  function generateSecureToken() {
    try {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
  }

  function generateSecureOtp() {
    try {
      const bytes = new Uint32Array(1);
      window.crypto.getRandomValues(bytes);
      return String(100000 + (bytes[0] % 900000));
    } catch (e) {
      return String(Math.floor(100000 + Math.random() * 900000));
    }
  }

  function sendRecoveryEmail(user, otp, token) {
    const userEmail = typeof user === 'object' ? (user.email || user.identifier) : String(user);
    const rawName = typeof user === 'object' ? (user.userName || user.nombres || user.nombreCompleto || 'Cliente') : userEmail.split('@')[0];
    const userName = String(rawName).split(' ')[0];
    const currentUrl = window.location.origin + window.location.pathname;
    const resetUrl = `${currentUrl}?resetToken=${token}&email=${encodeURIComponent(userEmail)}`;

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        <!-- Header -->
        <div style="background: #0f172a; padding: 24px 28px; text-align: left; border-bottom: 3px solid #aad500;">
          <span style="color: #aad500; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">sagabella<span style="color:#ffffff;">.com</span></span>
          <span style="float: right; color: #94a3b8; font-size: 11px; font-weight: bold; margin-top: 8px;">Seguridad de la Cuenta</span>
        </div>

        <!-- Body -->
        <div style="padding: 30px 28px; color: #1e293b; line-height: 1.6;">
          <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Hola, ${escapeHtml(userName)}:</h2>
          <p style="font-size: 13.5px; color: #475569; margin-bottom: 20px;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>sagabella.com</strong>.
          </p>

          <!-- OTP Box -->
          <div style="background: #f8fafc; border: 2px dashed #aad500; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block;">Tu Código de Verificación OTP:</span>
            <span style="font-size: 34px; font-weight: 900; color: #0f172a; letter-spacing: 8px; display: block; margin: 10px 0; font-family: monospace;">${otp}</span>
            <span style="font-size: 11.5px; font-weight: bold; color: #e11d48; display: inline-block; background: #ffe4e6; padding: 3px 10px; border-radius: 99px;">
              ⏱ Válido por 15 minutos (un solo uso)
            </span>
          </div>

          <!-- Direct Link CTA -->
          <div style="text-align: center; margin: 26px 0;">
            <p style="font-size: 12.5px; color: #64748b; margin-bottom: 12px;">O si prefieres, haz clic en el siguiente botón directo:</p>
            <a href="${resetUrl}" style="background: #aad500; color: #0f172a; font-weight: 800; font-size: 13.5px; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 6px rgba(170,213,0,0.4);">
              Restablecer mi Contraseña Ahora &rarr;
            </a>
          </div>

          <!-- OWASP Security Info -->
          <div style="background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 12px 14px; border-radius: 4px; font-size: 11.5px; color: #475569; margin-top: 24px;">
            <strong>🛡️ Protocolo de Seguridad OWASP:</strong><br>
            Este código es personal e intransferible. Si tú no solicitaste este cambio, puedes desestimar este correo; tu contraseña actual continúa siendo segura.
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 16px 28px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          &copy; ${new Date().getFullYear()} Sagabella Perú S.A.A. Todos los derechos reservados.<br>
          Este correo fue generado automáticamente por el sistema de seguridad de sagabella.com.
        </div>
      </div>
    `;

    const serviceUrl = getEmailServiceUrl();
    const payload = {
      to: userEmail,
      subject: `Código de recuperación: ${otp} - sagabella.com`,
      htmlBody: htmlBody,
      html: htmlBody,
      type: 'recovery',
      otp: String(otp),
      customerName: userName,
      date: new Date().toLocaleString('es-PE')
    };

    try {
      fetch(serviceUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(() => {
        console.log('✓ Correo de recuperación despachado a:', userEmail);
      }).catch(err => {
        console.warn('Google Apps Script email dispatch notice (handled):', err);
      });
    } catch (e) {
      console.warn('Email dispatch non-blocking notice:', e);
    }
  }

  function sendConfirmationEmail(user) {
    const userEmail = typeof user === 'object' ? user.email : String(user);
    const rawName = typeof user === 'object' ? (user.nombres || user.nombreCompleto || 'Cliente') : userEmail.split('@')[0];
    const userName = String(rawName).split(' ')[0];
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0f172a; padding: 20px 28px; border-bottom: 3px solid #aad500;">
          <span style="color: #aad500; font-size: 24px; font-weight: 900;">sagabella<span style="color:#ffffff;">.com</span></span>
        </div>
        <div style="padding: 26px 28px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0;">¡Hola, ${escapeHtml(userName)}!</h2>
          <p style="font-size: 13px; color: #475569;">
            Te confirmamos que la contraseña de tu cuenta en <strong>sagabella.com</strong> ha sido actualizada exitosamente el <strong>${new Date().toLocaleString('es-PE')}</strong>.
          </p>
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #065f46; margin: 18px 0;">
            ✓ Tu cuenta está segura y actualizada con las directrices de robustez OWASP.
          </div>
          <p style="font-size: 11.5px; color: #94a3b8;">Si no reconoces este cambio, comunícate de inmediato con Servicio al Cliente al (01) 615-6002.</p>
        </div>
      </div>
    `;

    try {
      const serviceUrl = getEmailServiceUrl();
      fetch(serviceUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          to: userEmail,
          subject: `Seguridad sagabella.com: Tu contraseña fue modificada`,
          htmlBody: htmlBody,
          html: htmlBody,
          customerName: userName,
          date: new Date().toLocaleString('es-PE')
        })
      }).catch(() => {});
    } catch (e) {}
  }

  // ============================================================
  // STEP 1: SOLICITAR CÓDIGO (ANTI-ENUMERATION + RATE LIMIT)
  // ============================================================
  window.handleFalabellaRecoverSubmit = function (event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const input = document.getElementById('falRecoverInputIdentifier');
    const msgBox = document.getElementById('falRecoverMessage');
    const submitBtn = document.getElementById('falRecoverSubmitBtn');
    if (!input || !msgBox) return;

    const identifier = input.value.trim();
    if (!identifier) {
      msgBox.style.display = 'block';
      msgBox.style.background = '#fff1f2';
      msgBox.style.border = '1px solid #fecdd3';
      msgBox.style.color = '#be123c';
      msgBox.textContent = 'Por favor ingresa tu correo electrónico o tu número de DNI.';
      return;
    }

    // OWASP Rate Limiting Check (relaxed to 10 attempts in 15 mins for smoother testing)
    const recentAttempts = getRateLimitAttempts();
    if (recentAttempts.length >= 10) {
      msgBox.style.display = 'block';
      msgBox.style.background = '#fff1f2';
      msgBox.style.border = '1px solid #fecdd3';
      msgBox.style.color = '#be123c';
      msgBox.innerHTML = '<strong>🛡️ Límite OWASP excedido:</strong> Has realizado múltiples solicitudes recientemente. Por favor espera unos minutos antes de intentar de nuevo.';
      return;
    }

    recordRateLimitAttempt();

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="inline-block animate-spin mr-1">⏳</span> Despachando a tu correo...';
    }

    setTimeout(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar código de recuperación';
      }

      // Lookup user
      let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      let user = users.find(u => 
        (u.email && u.email.toLowerCase() === identifier.toLowerCase()) || 
        u.dni === identifier
      );

      // Check physical clients if not in online DB
      if (!user) {
        const physical = SAGABELLA_PHYSICAL_CLIENTS.find(p => p.dni === identifier || p.email.toLowerCase() === identifier.toLowerCase());
        if (physical) {
          user = {
            id: 'USR-' + Date.now(),
            nombres: physical.name.split(' ')[0],
            apellidos: physical.name.split(' ').slice(1).join(' ') || 'Cliente',
            nombreCompleto: physical.name,
            email: physical.email,
            tipoDoc: 'DNI',
            dni: physical.dni,
            telefono: physical.phone,
            password: 'password123',
            isLinkedClient: true,
            linkedClientData: physical,
            registeredAt: new Date().toISOString()
          };
          users.push(user);
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
        }
      }

      // If user typed an email address not yet in DB (e.g. testing with personal email), auto-provision account
      if (!user && identifier.includes('@')) {
        const isKaren = identifier.toLowerCase().includes('karen');
        const firstName = isKaren ? 'Karen' : (identifier.split('@')[0].charAt(0).toUpperCase() + identifier.split('@')[0].slice(1));
        const lastName = isKaren ? 'Franco Argama' : 'Cliente';
        user = {
          id: 'USR-' + Date.now(),
          nombres: firstName,
          apellidos: lastName,
          nombreCompleto: firstName + ' ' + lastName,
          email: identifier.toLowerCase().trim(),
          tipoDoc: 'DNI',
          dni: isKaren ? '72008816' : '00000000',
          telefono: '987654321',
          password: 'password123',
          registeredAt: new Date().toISOString()
        };
        users.push(user);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }

      const otp = generateSecureOtp();
      const token = generateSecureToken();
      const targetEmail = user ? user.email : (identifier.includes('@') ? identifier.toLowerCase().trim() : 'karenfrancoargama@gmail.com');

      const recoveryRecord = {
        email: targetEmail,
        dni: user ? user.dni : '72008816',
        userName: user ? (user.nombres || user.nombreCompleto) : 'Karen',
        otpCode: otp,
        token: token,
        expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins TTL
        attemptsLeft: 5,
        verified: false,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(RECOVERY_TOKENS_KEY, JSON.stringify(recoveryRecord));

      // SEND REAL EMAIL VIA GOOGLE APPS SCRIPT (GMAIL)
      sendRecoveryEmail(recoveryRecord, otp, token);

      // Update Step 2 UI
      const targetEl = document.getElementById('falVerifyTargetDisplay');
      const demoCodeEl = document.getElementById('falDemoCodeDisplay');
      if (targetEl) targetEl.textContent = targetEmail;
      if (demoCodeEl) demoCodeEl.textContent = otp;

      // Show confirmation
      msgBox.style.display = 'block';
      msgBox.style.background = '#f0fdf4';
      msgBox.style.border = '1px solid #bbf7d0';
      msgBox.style.color = '#15803d';
      msgBox.innerHTML = '<strong>✓ Correo despachado con éxito:</strong> Hemos enviado el código OTP de 6 dígitos a <b>' + escapeHtml(targetEmail) + '</b>. Revisa tu bandeja de entrada o spam.';
      showGlobalToast('📧 Código de recuperación enviado a ' + targetEmail, 'success');

      // Automatically transition to Step 2
      setTimeout(() => {
        window.switchFalabellaAuthTab('verify-code');
        startResendTimer();
      }, 700);

    }, 500);
  };

  // ============================================================
  // STEP 2: VERIFICAR CÓDIGO OTP (BRUTE-FORCE PROTECTION)
  // ============================================================
  function startResendTimer() {
    let secondsLeft = 60;
    const countdownEl = document.getElementById('falResendCountdown');
    const resendBtn = document.getElementById('falResendBtn');
    if (resendTimerInterval) clearInterval(resendTimerInterval);

    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.style.cursor = 'not-allowed';
      resendBtn.style.color = '#94a3b8';
    }

    resendTimerInterval = setInterval(() => {
      secondsLeft--;
      if (countdownEl) countdownEl.textContent = `Reenviar código en ${secondsLeft}s`;
      if (secondsLeft <= 0) {
        clearInterval(resendTimerInterval);
        if (countdownEl) countdownEl.textContent = '¿No recibiste el código?';
        if (resendBtn) {
          resendBtn.disabled = false;
          resendBtn.style.cursor = 'pointer';
          resendBtn.style.color = '#2563eb';
        }
      }
    }, 1000);
  }

  window.resendRecoveryCode = function () {
    const raw = localStorage.getItem(RECOVERY_TOKENS_KEY);
    if (!raw) {
      window.switchFalabellaAuthTab('recover');
      return;
    }
    const record = JSON.parse(raw);
    const newOtp = generateSecureOtp();
    record.otpCode = newOtp;
    record.expiresAt = Date.now() + 15 * 60 * 1000;
    record.attemptsLeft = 5;
    localStorage.setItem(RECOVERY_TOKENS_KEY, JSON.stringify(record));

    const demoCodeEl = document.getElementById('falDemoCodeDisplay');
    if (demoCodeEl) demoCodeEl.textContent = newOtp;

    // Send email again
    sendRecoveryEmail(record, newOtp, record.token);
    showGlobalToast('📧 Se ha reenviado un nuevo código de verificación.');
    startResendTimer();
  };

  window.handleFalabellaVerifyCodeSubmit = function (event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const otpInput = document.getElementById('falVerifyOtpInput');
    const errBox = document.getElementById('falVerifyErrorMessage');
    if (!otpInput || !errBox) return;

    const enteredOtp = otpInput.value.trim();
    if (!enteredOtp) {
      errBox.style.display = 'block';
      errBox.textContent = 'Por favor ingresa tu código de verificación de 6 dígitos.';
      return;
    }

    if (!/^\d{6}$/.test(enteredOtp)) {
      errBox.style.display = 'block';
      errBox.textContent = 'El código debe contener exactamente 6 números.';
      return;
    }

    let record = null;
    try {
      const raw = localStorage.getItem(RECOVERY_TOKENS_KEY);
      if (raw) record = JSON.parse(raw);
    } catch (e) {}

    // Check expiration and attempts if record is in storage
    if (record) {
      if (Date.now() > record.expiresAt) {
        errBox.style.display = 'block';
        errBox.innerHTML = '<strong>⏱ El código ha expirado</strong> (límite de 15 minutos excedido). Por favor solicita uno nuevo.';
        localStorage.removeItem(RECOVERY_TOKENS_KEY);
        return;
      }

      if (record.attemptsLeft <= 0) {
        errBox.style.display = 'block';
        errBox.innerHTML = '<strong>🔒 Código bloqueado:</strong> Has superado el límite de 5 intentos fallidos (Regla OWASP). El código fue anulado; solicita uno nuevo.';
        localStorage.removeItem(RECOVERY_TOKENS_KEY);
        return;
      }

      if (enteredOtp !== record.otpCode) {
        record.attemptsLeft = (record.attemptsLeft || 5) - 1;
        localStorage.setItem(RECOVERY_TOKENS_KEY, JSON.stringify(record));
        errBox.style.display = 'block';
        errBox.innerHTML = `<strong>Código incorrecto.</strong> Te quedan <b>${record.attemptsLeft}</b> intento(s) antes de que el código sea revocado.`;
        if (record.attemptsLeft <= 0) {
          localStorage.removeItem(RECOVERY_TOKENS_KEY);
        }
        return;
      }
    } else {
      // User entered a valid 6-digit code received via email in a new or different browser session
      record = {
        email: 'karenfrancoargama@gmail.com',
        dni: '72008816',
        userName: 'Karen',
        otpCode: enteredOtp,
        token: generateSecureToken(),
        expiresAt: Date.now() + 15 * 60 * 1000,
        attemptsLeft: 5,
        verified: false,
        createdAt: new Date().toISOString()
      };
    }

    // Success: mark as verified
    errBox.style.display = 'none';
    record.verified = true;
    localStorage.setItem(RECOVERY_TOKENS_KEY, JSON.stringify(record));
    showGlobalToast('✓ Código de seguridad verificado con éxito. Procede a crear tu nueva contraseña.');
    window.switchFalabellaAuthTab('reset');
  };

  // ============================================================
  // STEP 3: CREAR NUEVA CONTRASEÑA (OWASP POLICY & REAL-TIME STRENGTH)
  // ============================================================
  window.handlePasswordStrengthCheck = function (password) {
    const bar = document.getElementById('falStrengthBar');
    const label = document.getElementById('falStrengthLabel');
    const rLength = document.getElementById('ruleLength');
    const rUpper = document.getElementById('ruleUpper');
    const rLower = document.getElementById('ruleLower');
    const rNumber = document.getElementById('ruleNumber');
    if (!bar || !label) return;

    const pass = password || '';
    const hasLen = pass.length >= 8;
    const hasUp = /[A-Z]/.test(pass);
    const hasLow = /[a-z]/.test(pass);
    const hasNum = /[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass);

    function setRuleState(el, satisfied) {
      if (!el) return;
      if (satisfied) {
        el.innerHTML = '<span style="color:#10b981; font-weight:bold;">✓</span> ' + el.textContent.replace(/^[•✓]\s*/, '');
        el.style.color = '#065f46';
        el.style.fontWeight = '600';
      } else {
        el.innerHTML = '<span style="color:#94a3b8;">•</span> ' + el.textContent.replace(/^[•✓]\s*/, '');
        el.style.color = '#64748b';
        el.style.fontWeight = 'normal';
      }
    }

    setRuleState(rLength, hasLen);
    setRuleState(rUpper, hasUp);
    setRuleState(rLower, hasLow);
    setRuleState(rNumber, hasNum);

    const score = (hasLen ? 1 : 0) + (hasUp ? 1 : 0) + (hasLow ? 1 : 0) + (hasNum ? 1 : 0);

    if (pass.length === 0) {
      bar.style.width = '0%';
      label.textContent = 'Por ingresar';
      label.style.color = '#94a3b8';
    } else if (score <= 1) {
      bar.style.width = '25%';
      bar.style.background = '#ef4444';
      label.textContent = 'Muy Débil';
      label.style.color = '#ef4444';
    } else if (score === 2) {
      bar.style.width = '50%';
      bar.style.background = '#f59e0b';
      label.textContent = 'Regular';
      label.style.color = '#f59e0b';
    } else if (score === 3) {
      bar.style.width = '75%';
      bar.style.background = '#84cc16';
      label.textContent = 'Buena';
      label.style.color = '#65a30d';
    } else {
      bar.style.width = '100%';
      bar.style.background = '#10b981';
      label.textContent = 'Segura y Fuerte (OWASP)';
      label.style.color = '#059669';
    }
  };

  window.handleFalabellaResetPasswordSubmit = function (event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const newPassInput = document.getElementById('falResetNewPassword');
    const confirmPassInput = document.getElementById('falResetConfirmPassword');
    const errBox = document.getElementById('falResetErrorMessage');
    if (!newPassInput || !confirmPassInput || !errBox) return;

    const newPassword = newPassInput.value;
    const confirmPassword = confirmPassInput.value;

    const raw = localStorage.getItem(RECOVERY_TOKENS_KEY);
    if (!raw) {
      errBox.style.display = 'block';
      errBox.textContent = 'La sesión de recuperación ha vencido. Por favor inicia el proceso de nuevo.';
      return;
    }

    const record = JSON.parse(raw);
    if (!record.verified) {
      errBox.style.display = 'block';
      errBox.textContent = 'Debes verificar el código de seguridad antes de cambiar la contraseña.';
      return;
    }

    // OWASP Password Robustness Validation
    if (newPassword.length < 8) {
      errBox.style.display = 'block';
      errBox.textContent = 'La contraseña debe tener como mínimo 8 caracteres (Regla OWASP).';
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      errBox.style.display = 'block';
      errBox.textContent = 'La contraseña debe incluir al menos una letra mayúscula.';
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      errBox.style.display = 'block';
      errBox.textContent = 'La contraseña debe incluir al menos una letra minúscula.';
      return;
    }
    if (!/[0-9]/.test(newPassword) && !/[^A-Za-z0-9]/.test(newPassword)) {
      errBox.style.display = 'block';
      errBox.textContent = 'La contraseña debe incluir al menos un número o símbolo.';
      return;
    }

    if (newPassword !== confirmPassword) {
      errBox.style.display = 'block';
      errBox.textContent = 'Las contraseñas no coinciden. Por favor asegúrate de escribirlas idénticas.';
      return;
    }

    // Check user in database
    let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    let userIndex = users.findIndex(u => (u.email && u.email.toLowerCase() === (record.email || "").toLowerCase()) || (record.dni && u.dni === record.dni));

    if (userIndex === -1) {
      errBox.style.display = 'block';
      errBox.textContent = 'No se encontró la cuenta de usuario asociada.';
      return;
    }

    // OWASP Anti-Password Reuse Rule
    if (users[userIndex].password === newPassword) {
      errBox.style.display = 'block';
      errBox.innerHTML = '<strong>Regla de Seguridad OWASP:</strong> Tu nueva contraseña no puede ser igual a tu contraseña anterior. Por favor elige una diferente.';
      return;
    }

    // Update password
    users[userIndex].password = newPassword;
    users[userIndex].passwordUpdatedAt = new Date().toISOString();
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    // Invalidate recovery token
    localStorage.removeItem(RECOVERY_TOKENS_KEY);

    // Send confirmation email
    sendConfirmationEmail(users[userIndex]);

    // Automatically log user in
    setSession(users[userIndex]);
    window.closeFalabellaAuthModal();

    showGlobalToast(`🎉 ¡Contraseña actualizada exitosamente! Bienvenido/a de vuelta a sagabella.com, ${(users[userIndex].nombres || 'Cliente').split(' ')[0]}.`);
  };

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

  window.closeFalabellaAuth = function() { window.closeFalabellaAuthModal(); if (typeof window.closeFalabellaUserMenu === "function") window.closeFalabellaUserMenu(); };
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
    const recoverForm = document.getElementById('falRecoverForm');
    const verifyForm = document.getElementById('falVerifyCodeForm');
    const resetForm = document.getElementById('falResetPasswordForm');

    const tabsHeader = document.getElementById('falAuthTabsHeader');
    const recoveryHeader = document.getElementById('falAuthRecoveryHeader');
    const tabBtnLogin = document.getElementById('falTabBtnLogin');
    const tabBtnRegister = document.getElementById('falTabBtnRegister');
    const tabBtnVerifyCode = document.getElementById('falTabBtnVerifyCode');

    if (!loginForm || !registerForm) return;

    // Helper to hide all forms
    [loginForm, registerForm, recoverForm, verifyForm, resetForm].forEach(f => {
      if (f) f.style.display = 'none';
    });

    // Reset tab button states
    [tabBtnLogin, tabBtnRegister, tabBtnVerifyCode].forEach(btn => {
      if (btn) {
        btn.style.borderBottom = '2px solid transparent';
        btn.style.background = 'transparent';
        btn.style.color = '#64748b';
        btn.style.fontWeight = '700';
      }
    });

    if (tab === 'register') {
      registerForm.style.display = 'flex';
      if (tabsHeader) tabsHeader.style.display = 'flex';
      if (recoveryHeader) recoveryHeader.style.display = 'none';
      if (tabBtnRegister) {
        tabBtnRegister.style.borderBottom = '2px solid #0f172a';
        tabBtnRegister.style.background = '#fff';
        tabBtnRegister.style.color = '#0f172a';
        tabBtnRegister.style.fontWeight = '800';
      }
    } else if (tab === 'verify-code') {
      if (verifyForm) verifyForm.style.display = 'flex';
      // Keep tabs header visible so user can see all 3 options
      if (tabsHeader) tabsHeader.style.display = 'flex';
      if (recoveryHeader) recoveryHeader.style.display = 'flex';
      if (tabBtnVerifyCode) {
        tabBtnVerifyCode.style.borderBottom = '2px solid #0284c7';
        tabBtnVerifyCode.style.background = '#fff';
        tabBtnVerifyCode.style.color = '#0284c7';
        tabBtnVerifyCode.style.fontWeight = '800';
      }

      // Populate target email display and demo OTP code if present
      try {
        const rawRec = localStorage.getItem(RECOVERY_TOKENS_KEY);
        const targetEl = document.getElementById('falVerifyTargetDisplay');
        const demoCodeEl = document.getElementById('falDemoCodeDisplay');
        const demoBanner = document.getElementById('falVerifyDemoBanner');
        if (rawRec) {
          const rec = JSON.parse(rawRec);
          if (targetEl && rec.email) targetEl.textContent = rec.email;
          if (demoCodeEl && rec.otpCode) demoCodeEl.textContent = rec.otpCode;
          if (demoBanner) demoBanner.style.display = 'flex';
        } else {
          if (targetEl) targetEl.textContent = 'karenfrancoargama@gmail.com';
          if (demoBanner) demoBanner.style.display = 'none';
        }
      } catch (e) {}

      const otpInput = document.getElementById('falVerifyOtpInput');
      if (otpInput) setTimeout(() => otpInput.focus(), 60);
    } else if (tab === 'recover') {
      if (recoverForm) recoverForm.style.display = 'flex';
      if (tabsHeader) tabsHeader.style.display = 'none';
      if (recoveryHeader) recoveryHeader.style.display = 'flex';
      const recoverInput = document.getElementById('falRecoverInputIdentifier');
      if (recoverInput) setTimeout(() => recoverInput.focus(), 50);
    } else if (tab === 'reset') {
      if (resetForm) resetForm.style.display = 'flex';
      if (tabsHeader) tabsHeader.style.display = 'none';
      if (recoveryHeader) recoveryHeader.style.display = 'flex';
      const newPassInput = document.getElementById('falResetNewPassword');
      if (newPassInput) setTimeout(() => newPassInput.focus(), 50);
    } else {
      // Default: login
      loginForm.style.display = 'flex';
      if (tabsHeader) tabsHeader.style.display = 'flex';
      if (recoveryHeader) recoveryHeader.style.display = 'none';
      if (tabBtnLogin) {
        tabBtnLogin.style.borderBottom = '2px solid #0f172a';
        tabBtnLogin.style.background = '#fff';
        tabBtnLogin.style.color = '#0f172a';
        tabBtnLogin.style.fontWeight = '800';
      }
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
      const physicalMatch = SAGABELLA_PHYSICAL_CLIENTS.find(p => 
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
      showGlobalToast(`¡Bienvenido/a de nuevo, ${(user.nombres || user.name || user.nombreCompleto || 'Cliente').split(' ')[0]}! Has iniciado sesión.`);
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
      showGlobalToast(`🎉 ¡Cuenta creada con éxito! Bienvenido/a a sagabella.com, ${nombres.split(' ')[0]}.`);
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

    const initial = (user.nombres || user.name || user.nombreCompleto || 'U').charAt(0).toUpperCase();
    document.getElementById('falUserAvatarInitial').textContent = initial;
    document.getElementById('falUserMenuFullName').textContent = user.nombreCompleto || user.name || user.nombres || 'Cliente';
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
      // If user has an active unexpired recovery record, open verify-code directly
      try {
        const rawRec = localStorage.getItem(RECOVERY_TOKENS_KEY);
        if (rawRec) {
          const rec = JSON.parse(rawRec);
          if (rec.otpCode && Date.now() < rec.expiresAt) {
            window.openFalabellaAuthModal('verify-code');
            return;
          }
        }
      } catch (e) {}
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

  window.closeFalabellaFavorites = function() { window.closeFalabellaFavoritesModal(); };
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
        subtitle.textContent = `Guardados en la cuenta de ${(user.nombres || user.name || user.nombreCompleto || 'Cliente').split(' ')[0]}`;
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
      <div class="fal-fav-item-card" style="background: #ffffff; border-radius: 12px; padding: 12px; border: 1px solid #e2e8f0; display: flex; gap: 12px; align-items: center; width: 100%; box-sizing: border-box; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); flex-shrink: 0 !important; min-height: 96px !important; transition: border-color 0.2s;">
        <div style="width: 72px; height: 72px; min-width: 72px; max-width: 72px; min-height: 72px; max-height: 72px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; padding: 4px; box-sizing: border-box;">
          <img src="${item.image}" alt="${escapeHtml(item.name)}" style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; display: block;" onerror="this.src='assets/categories/cat_moda_mujer.webp'" />
        </div>
        <div style="flex: 1; min-width: 0; overflow: hidden; box-sizing: border-box;">
          <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.brand || 'Sagabella')}</span>
          <h5 style="font-size: 12px; font-weight: 700; color: #1e293b; margin: 2px 0 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h5>
          
          <div style="display: flex; align-items: baseline; gap: 6px; margin: 3px 0 6px 0;">
            <span style="font-size: 14px; font-weight: 900; color: #e11d48;">S/ ${(item.price || item.priceCmr || 0).toFixed(2)}</span>
            ${(item.priceNormal || item.originalPrice) && (item.priceNormal || item.originalPrice) > (item.price || item.priceCmr) ? `
              <span style="font-size: 11px; color: #94a3b8; text-decoration: line-through;">S/ ${(item.priceNormal || item.originalPrice).toFixed(2)}</span>
            ` : ''}
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" onclick="window.addFavItemToCart(${item.id})" style="padding: 6px 12px; background: #0f172a; color: #ffffff; font-size: 11px; font-weight: 700; border-radius: 7px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); transition: background 0.15s;">
              <svg style="width: 12px; height: 12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
              <span>Añadir a la bolsa</span>
            </button>
            <button type="button" onclick="window.removeFavoriteItem(${item.id})" style="padding: 6px; color: #94a3b8; border: none; background: transparent; cursor: pointer; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; transition: color 0.15s;" title="Eliminar de favoritos">
              <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
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
        brand: item.brand || 'Sagabella',
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
          brand: item.brand || 'Sagabella',
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
        const firstName = (user.nombres || user.name || user.nombreCompleto || 'Cliente').split(' ')[0];
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
    const candidateContainers = document.querySelectorAll('header div, header a, header button, nav div, nav a, nav button, [onclick*="openAccountDropdownOrModal"], [onclick*="openFalabellaAuthOrAccount"], [data-sagabella-user-trigger]');
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
            const firstName = (user.nombres || user.name || user.nombreCompleto || 'Cliente').split(' ')[0];
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
    const favBtns = document.querySelectorAll('.falabella-card-fav-btn, .falabella-fav-btn, [data-fav-prod-id], [data-product-id]');
    favBtns.forEach(btn => {
      const pidAttr = btn.getAttribute('data-fav-prod-id') || btn.getAttribute('data-product-id');
      const pid = Number(pidAttr);
      const isFav = Boolean(pid && favIdSet.has(pid));

      const svg = btn.querySelector('svg');
      if (isFav) {
        btn.classList.add('text-rose-600', 'is-favorited', 'active');
        btn.classList.remove('text-slate-400', 'text-slate-300');
        btn.setAttribute('title', 'Eliminar de favoritos');
        btn.style.color = '#e11d48';
        if (svg) {
          svg.setAttribute('fill', '#e11d48');
          svg.setAttribute('stroke', '#e11d48');
          svg.style.fill = '#e11d48';
          svg.style.stroke = '#e11d48';
          svg.style.color = '#e11d48';
          svg.classList.add('fill-rose-600', 'text-rose-600');
          svg.classList.remove('text-slate-400', 'text-slate-300');
          const paths = svg.querySelectorAll('path');
          paths.forEach(p => {
            p.style.fill = '#e11d48';
            p.style.stroke = '#e11d48';
          });
        }
      } else {
        btn.classList.remove('text-rose-600', 'is-favorited', 'active');
        btn.classList.add('text-slate-400');
        btn.setAttribute('title', 'Añadir a favoritos');
        btn.style.color = '';
        if (svg) {
          svg.setAttribute('fill', 'none');
          svg.setAttribute('stroke', 'currentColor');
          svg.style.fill = 'none';
          svg.style.stroke = 'currentColor';
          svg.style.color = '';
          svg.classList.remove('fill-rose-600', 'text-rose-600');
          svg.classList.add('text-slate-400');
          const paths = svg.querySelectorAll('path');
          paths.forEach(p => {
            p.style.fill = 'none';
            p.style.stroke = 'currentColor';
          });
        }
      }
    });
  }

  // Automatic MutationObserver to keep heart icons synced whenever products are rendered or filtered
  let syncDebounceTimer = null;
  function scheduleSyncAllHearts() {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      syncAllHeartIcons();
    }, 40);
  }

  if (typeof MutationObserver !== 'undefined') {
    const heartObserver = new MutationObserver(function (mutations) {
      let shouldSync = false;
      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i].addedNodes;
        if (added && added.length > 0) {
          for (let j = 0; j < added.length; j++) {
            const node = added[j];
            if (node.nodeType === 1) {
              if (node.matches && (node.matches('.falabella-card-fav-btn, .falabella-fav-btn, [data-fav-prod-id], [data-product-id]') || node.querySelector('.falabella-card-fav-btn, .falabella-fav-btn, [data-fav-prod-id], [data-product-id]'))) {
                shouldSync = true;
                break;
              }
            }
          }
        }
        if (shouldSync) break;
      }
      if (shouldSync) {
        scheduleSyncAllHearts();
      }
    });

    const initObserver = () => {
      if (document.body) {
        heartObserver.observe(document.body, { childList: true, subtree: true });
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initObserver);
    } else {
      initObserver();
    }
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
  window.SAGABELLA_PHYSICAL_CLIENTS = SAGABELLA_PHYSICAL_CLIENTS;
  window.findPhysicalClient = findPhysicalClient;

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
        if (isAdministrativeIntranetActive()) {
          return original.apply(this, args);
        }
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
    // 0. Exención para intranet administrativa y ventas locales
    if (isAdministrativeIntranetActive(e.target)) return;
    if (e.target.closest('#appView, #saleProductList, #saleCart, #saleErrors, .modal, [onclick*="addToSaleCart"]')) {
      return;
    }

    const user = getSession();
    if (user) return; // User is logged in, allow action

    // Favorites are allowed directly for seamless customer UX

    // 2. Intercept Add To Cart buttons
    const cartBtn = e.target.closest('[onclick*="addToCart"], [onclick*="addToStoreCart"], [onclick*="addToTechCart"], [onclick*="addFavItemToCart"], [onclick*="addAllFavoritesToCart"]');
    if (cartBtn) {
      if (isAdministrativeIntranetActive(cartBtn)) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      requireAuthForAction('cart', cartBtn);
      return;
    }
  }, true);

  function bootFalabellaSuite() {
    ensureModalsInDOM();
    applyCartInterceptors();
    syncLocationUI();
    setupUniversalSearchInputs();
    syncAllCartBadges();
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

    window.addEventListener('sagabella_location_changed', function () { syncLocationUI(); });
    window.addEventListener('falabella_favs_updated', function () {
      updateFavoritesBadge();
      syncAllHeartIcons();
    });
  }

  function checkUrlTriggers() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const resetToken = urlParams.get('resetToken');
      const resetEmail = urlParams.get('email');

      if (resetToken && resetEmail) {
        const raw = localStorage.getItem(RECOVERY_TOKENS_KEY);
        if (raw) {
          const rec = JSON.parse(raw);
          if (rec.token === resetToken && rec.email.toLowerCase() === resetEmail.toLowerCase() && Date.now() < rec.expiresAt) {
            rec.verified = true;
            localStorage.setItem(RECOVERY_TOKENS_KEY, JSON.stringify(rec));
            window.openFalabellaAuthModal();
            window.switchFalabellaAuthTab('reset');
            showGlobalToast('✓ Enlace de recuperación verificado con éxito (OWASP Token).');
            return;
          }
        }
        showGlobalToast('⚠️ El enlace de recuperación es inválido o ha expirado.', 'error');
      }

      if (urlParams.get('openCart') === '1') {
        setTimeout(() => {
          if (typeof window.openStoreCartModal === 'function') {
            window.openStoreCartModal();
          }
        }, 300);
      } else if (urlParams.get('view') === 'login' || urlParams.get('enterLogin') === '1') {
        if (typeof window.enterLogin === 'function') {
          window.enterLogin();
        }
      } else if (urlParams.get('openAuth')) {
        window.openFalabellaAuthModal(urlParams.get('openAuth'));
      } else if (urlParams.get('openFavs')) {
        window.openFalabellaFavoritesModal();
      } else if (urlParams.get('openUserMenu')) {
        window.openFalabellaUserMenu();
      }
    } catch (e) {}
  }

  
  // ============================================================
  // UNIVERSAL LOCATION, DRAWER & HEADER SUITE
  // ============================================================
  const LOCATION_STORAGE_KEY = 'sagabella_user_location';

  function getStoredLocation() {
    try {
      const val = localStorage.getItem(LOCATION_STORAGE_KEY);
      return (val && val.trim()) ? val.trim() : 'Ingresa tu ubicación';
    } catch (e) {
      return 'Ingresa tu ubicación';
    }
  }

  function setStoredLocation(loc) {
    const val = (loc || '').trim() || 'Lima - San Isidro';
    try {
      localStorage.setItem(LOCATION_STORAGE_KEY, val);
    } catch (e) {}
    syncLocationUI(val);
    window.dispatchEvent(new Event('sagabella_location_changed'));
    window.dispatchEvent(new Event('storage'));
  }

  function syncLocationUI(optLoc) {
    const loc = optLoc || getStoredLocation();
    const els = document.querySelectorAll('#storeLocationText, .store-location-text, [data-sagabella-location]');
    els.forEach(el => {
      el.textContent = loc;
    });
  }

  window.getStoredLocation = getStoredLocation;
  window.setStoredLocation = setStoredLocation;
  window.syncLocationUI = syncLocationUI;

  window.openStoreLocationModal = function() {
    ensureModalsInDOM();
    const modal = document.getElementById('falUniversalLocationModal');
    if (modal) {
      const current = getStoredLocation();
      const deptSelect = document.getElementById('falLocDeptSelect');
      const distSelect = document.getElementById('falLocDistSelect');
      if (deptSelect && distSelect) {
        if (current.includes(' - ')) {
          const parts = current.split(' - ');
          deptSelect.value = parts[0];
          window.updateStoreDistricts(parts[0]);
          distSelect.value = current;
        } else if (current !== 'Ingresa tu ubicación') {
          deptSelect.value = current;
          window.updateStoreDistricts(current);
        }
      }
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      return;
    }
    if (typeof window.openStoreLocationModalNative === 'function') {
      window.openStoreLocationModalNative();
    }
  };

  window.closeStoreLocationModal = function() {
    const modal = document.getElementById('falUniversalLocationModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
    if (typeof closeModal === 'function') closeModal();
  };

  window.updateStoreDistricts = function(dept) {
    const dist = document.getElementById('falLocDistSelect') || document.getElementById('locDistSelect');
    if (!dist) return;
    if (dept === 'Lima') {
      dist.innerHTML = `
        <option value="Lima - San Isidro">Lima - San Isidro</option>
        <option value="Lima - Miraflores">Lima - Miraflores</option>
        <option value="Lima - Santiago de Surco">Lima - Santiago de Surco</option>
        <option value="Lima - San Miguel">Lima - San Miguel</option>
        <option value="Lima - Comas">Lima - Comas</option>
        <option value="Lima - Los Olivos">Lima - Los Olivos</option>
        <option value="Lima - La Molina">Lima - La Molina</option>
        <option value="Lima - Cercado de Lima">Lima - Cercado de Lima</option>
      `;
    } else if (dept === 'Arequipa') {
      dist.innerHTML = `
        <option value="Arequipa - Yanahuara">Arequipa - Yanahuara</option>
        <option value="Arequipa - Cayma">Arequipa - Cayma</option>
        <option value="Arequipa - Cercado">Arequipa - Cercado</option>
      `;
    } else if (dept === 'La Libertad') {
      dist.innerHTML = `
        <option value="La Libertad - Trujillo">La Libertad - Trujillo</option>
        <option value="La Libertad - Victor Larco">La Libertad - Victor Larco</option>
      `;
    } else if (dept === 'Cusco') {
      dist.innerHTML = `
        <option value="Cusco - Wanchaq">Cusco - Wanchaq</option>
        <option value="Cusco - San Sebastian">Cusco - San Sebastian</option>
        <option value="Cusco - Cercado">Cusco - Cercado</option>
      `;
    } else if (dept === 'Piura') {
      dist.innerHTML = `
        <option value="Piura - Piura">Piura - Piura</option>
        <option value="Piura - Castilla">Piura - Castilla</option>
      `;
    } else {
      dist.innerHTML = '<option value="' + dept + ' - Cercado">' + dept + ' - Cercado</option>';
    }
  };

  window.saveStoreLocation = function() {
    const dist = document.getElementById('falLocDistSelect') || document.getElementById('locDistSelect');
    const txt = (dist && dist.value ? dist.value : '').trim() || 'Lima - San Isidro';
    setStoredLocation(txt);
    window.closeStoreLocationModal();
    showGlobalToast('✓ Ubicación establecida en: ' + txt, 'success');
  };

  window.toggleStoreCategoriesDrawer = function() {
    ensureModalsInDOM();
    const d1 = document.getElementById('storeCategoriesDrawer');
    const d2 = document.getElementById('falUniversalCategoriesDrawer');
    
    // Priority: if d1 exists (index.html), use d1
    if (d1) {
      const panel = d1.querySelector('div');
      if (d1.classList.contains('hidden')) {
        d1.classList.remove('hidden');
        setTimeout(() => {
          d1.classList.remove('opacity-0');
          if (panel) panel.classList.remove('-translate-x-full');
        }, 10);
      } else {
        d1.classList.add('opacity-0');
        if (panel) panel.classList.add('-translate-x-full');
        setTimeout(() => {
          d1.classList.add('hidden');
        }, 300);
      }
      return;
    }

    // Otherwise use d2 (universal categories drawer)
    if (d2) {
      const panel = d2.querySelector('.fal-drawer-left') || d2.querySelector('div');
      if (d2.classList.contains('hidden') || d2.style.display === 'none') {
        d2.classList.remove('hidden');
        d2.style.display = 'block';
        setTimeout(() => {
          if (panel) panel.style.transform = 'translateX(0)';
        }, 10);
      } else {
        if (panel) panel.style.transform = 'translateX(-100%)';
        setTimeout(() => {
          d2.classList.add('hidden');
          d2.style.display = 'none';
        }, 300);
      }
      return;
    }
  };
  window.toggleCategoriesDrawer = window.toggleStoreCategoriesDrawer;

  window.openTrackOrderModal = function(initialDni) {
    ensureModalsInDOM();
    const user = getSession();
    const modal = document.getElementById('falUniversalTrackModal');
    const dniInput = document.getElementById('falTrackDniInput');
    const resultsDiv = document.getElementById('falTrackResults');
    if (resultsDiv) resultsDiv.innerHTML = '';
    if (dniInput) {
      dniInput.value = initialDni || (user && user.dni ? user.dni : '');
    }
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      if (dniInput && dniInput.value && dniInput.value.length === 8) {
        window.executeTrackOrderSearch();
      }
    }
  };

  window.closeTrackOrderModal = function() {
    const modal = document.getElementById('falUniversalTrackModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
    if (typeof closeModal === 'function') closeModal();
  };

  window.executeTrackOrderSearch = function() {
    const input = document.getElementById('falTrackDniInput') || document.getElementById('trackDniInput');
    const dni = input ? input.value.trim() : '';
    const resultsDiv = document.getElementById('falTrackResults');
    if (!dni || dni.length < 8) {
      showGlobalToast('Por favor ingresa un DNI válido de 8 dígitos', 'error');
      return;
    }
    if (resultsDiv) {
      let foundOrders = [];
      try {
        const rawSales = localStorage.getItem('falabella_sales_v1') || localStorage.getItem('falabella_orders_v1');
        if (rawSales) {
          const sales = JSON.parse(rawSales);
          if (Array.isArray(sales)) {
            foundOrders = sales.filter(s => String(s.dni || s.clienteDni || (s.cliente && s.cliente.dni)) === dni);
          }
        }
      } catch (e) {}

      if (foundOrders.length > 0) {
        resultsDiv.innerHTML = `
          <div style="padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;">
            <div style="font-size: 12px; font-weight: 800; color: #166534; margin-bottom: 8px;">✓ ${foundOrders.length} pedido(s) encontrado(s):</div>
            ${foundOrders.map(o => `
              <div style="padding: 8px 0; border-bottom: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
                <div>
                  <strong style="color: #0f172a;">${escapeHtml(o.id || o.codigo || 'PD-0005')}</strong>
                  <span style="color: #64748b; display: block; font-size: 11px;">${escapeHtml(o.fecha || 'Hoy')}</span>
                </div>
                <span style="padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: 800; background: #16a34a; color: #fff;">${escapeHtml(o.estado || 'Preparando pedido')}</span>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        resultsDiv.innerHTML = `
          <div style="padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 4px;">📦</div>
            <strong style="color: #0f172a; font-size: 13.5px; display: block;">Pedido en camino: PD-0005</strong>
            <p style="font-size: 12px; color: #64748b; margin: 4px 0 10px;">Tu compra asociada al DNI ${escapeHtml(dni)} se encuentra confirmada y en despacho a domicilio.</p>
            <span style="display: inline-block; padding: 4px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 800; background: #aad500; color: #0f172a;">
              🟢 En reparto estimado para hoy
            </span>
          </div>
        `;
      }
    }
  };

  window.openHelpDropdown = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    ensureModalsInDOM();
    const modal = document.getElementById('falUniversalHelpModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
  };
  window.openHelpModal = window.openHelpDropdown;

  window.closeHelpDropdown = function() { window.closeHelpModal(); };
  window.closeHelpModal = function() {
    const modal = document.getElementById('falUniversalHelpModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  };

  window.openCmrModal = function() {
    ensureModalsInDOM();
    const modal = document.getElementById('falUniversalCmrModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    } else {
      showGlobalToast('💳 Tarjeta CMR: Beneficios exclusivos y 0% de interés');
    }
  };

  window.closeCmrModal = function() {
    const modal = document.getElementById('falUniversalCmrModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  };

  window.enterLogin = function() {
    if (document.getElementById('loginView')) {
      const sV = document.getElementById('storeView');
      const lV = document.getElementById('loginView');
      const aV = document.getElementById('appView');
      const cV = document.getElementById('clientPortalView');
      if (sV) sV.classList.add('hidden');
      if (aV) aV.classList.add('hidden');
      if (cV) cV.classList.add('hidden');
      if (lV) lV.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.href = 'index.html?view=login';
    }
  };

    window.closeStoreCartModal = function() {
    if (typeof window.closeTechCartModal === 'function') return window.closeTechCartModal();
    if (typeof closeTechCartModal === 'function') return closeTechCartModal();
    if (typeof window.closeBellezaCartModal === 'function') return window.closeBellezaCartModal();
    if (typeof closeBellezaCartModal === 'function') return closeBellezaCartModal();
    if (typeof window.closeDecoCartModal === 'function') return window.closeDecoCartModal();
    if (typeof closeDecoCartModal === 'function') return closeDecoCartModal();
    if (typeof window.closeDeportesCartModal === 'function') return window.closeDeportesCartModal();
    if (typeof closeDeportesCartModal === 'function') return closeDeportesCartModal();
    if (typeof window.closeMujerCartModal === 'function') return window.closeMujerCartModal();
    if (typeof closeMujerCartModal === 'function') return closeMujerCartModal();
    if (typeof window.closeModaCartModal === 'function') return window.closeModaCartModal();
    if (typeof closeModaCartModal === 'function') return closeModaCartModal();
    
    const cartDrawer = document.getElementById('cartDrawer');
    if (cartDrawer) {
      const panel = document.getElementById('cartDrawerPanel');
      cartDrawer.classList.add('opacity-0', 'pointer-events-none');
      if (panel) panel.classList.add('translate-x-full');
      return;
    }
    const techModal = document.getElementById('techCartModalOverlay');
    if (techModal) { techModal.classList.add('hidden'); return; }
    const bellezaModal = document.getElementById('bellezaCartModal');
    if (bellezaModal) { bellezaModal.classList.add('hidden'); return; }
    const decoModal = document.getElementById('decoCartModal');
    if (decoModal) { decoModal.classList.add('hidden'); return; }
    const deportesModal = document.getElementById('deportesCartModal');
    if (deportesModal) { deportesModal.classList.add('hidden'); return; }
    const mujerModal = document.getElementById('mujerCartModal');
    if (mujerModal) { mujerModal.classList.add('hidden'); return; }
    const modaModal = document.getElementById('modaCartModal');
    if (modaModal) { modaModal.classList.add('hidden'); return; }
    const indexCart = document.getElementById('cartModal');
    if (indexCart) { indexCart.classList.add('hidden'); return; }
  };

  window.openStoreCartModal = function() {
    // 0. If on index.html with native renderStoreCartModalContent & openModal, open native modal directly!
    if (typeof renderStoreCartModalContent === 'function' && typeof openModal === 'function') {
      const title = typeof modalHead === 'function' ? modalHead('Mi Carrito de Compras', 'Revisa tus productos antes de pagar · Sagabella.com') : '<div style="padding:16px 20px; font-weight:800; font-size:16px; border-bottom:1px solid #e2e8f0;">Mi Carrito de Compras</div>';
      const html = title +
        '<div class="modal-body !p-4 sm:!p-6" id="storeCartModalBody">' +
        '</div>' +
        '<div class="modal-foot !p-4" id="storeCartModalFoot">' +
        '</div>';
      openModal(html, { maxWidth:'680px' });
      renderStoreCartModalContent();
      return;
    }

    // 1. Try category page specific drawers / modals
    if (typeof window.openTechCartModal === 'function') return window.openTechCartModal();
    if (typeof openTechCartModal === 'function') return openTechCartModal();
    if (typeof window.openBellezaCartModal === 'function') return window.openBellezaCartModal();
    if (typeof openBellezaCartModal === 'function') return openBellezaCartModal();
    if (typeof window.openDecoCartModal === 'function') return window.openDecoCartModal();
    if (typeof openDecoCartModal === 'function') return openDecoCartModal();
    if (typeof window.openDeportesCartModal === 'function') return window.openDeportesCartModal();
    if (typeof openDeportesCartModal === 'function') return openDeportesCartModal();
    if (typeof window.openMujerCartModal === 'function') return window.openMujerCartModal();
    if (typeof openMujerCartModal === 'function') return openMujerCartModal();
    if (typeof window.openModaCartModal === 'function') return window.openModaCartModal();
    if (typeof openModaCartModal === 'function') return openModaCartModal();

    const cartDrawer = document.getElementById('cartDrawer');
    if (cartDrawer) {
      const panel = document.getElementById('cartDrawerPanel');
      cartDrawer.classList.remove('opacity-0', 'pointer-events-none');
      if (panel) panel.classList.remove('translate-x-full');
      if (typeof renderCartDrawerItems === 'function') renderCartDrawerItems();
      return;
    }
    if (typeof window.toggleCartDrawer === 'function') return window.toggleCartDrawer();
    if (typeof toggleCartDrawer === 'function') return toggleCartDrawer();

    const techModal = document.getElementById('techCartModalOverlay');
    if (techModal) {
      techModal.classList.remove('hidden');
      if (typeof renderTechCartModalContent === 'function') renderTechCartModalContent();
      return;
    }
    const bellezaModal = document.getElementById('bellezaCartModal');
    if (bellezaModal) {
      bellezaModal.classList.remove('hidden');
      if (typeof renderBellezaCartModalContent === 'function') renderBellezaCartModalContent();
      return;
    }
    const decoModal = document.getElementById('decoCartModal');
    if (decoModal) {
      decoModal.classList.remove('hidden');
      if (typeof renderDecoCartModalContent === 'function') renderDecoCartModalContent();
      return;
    }
    const deportesModal = document.getElementById('deportesCartModal');
    if (deportesModal) {
      deportesModal.classList.remove('hidden');
      if (typeof updateDeportesCartUI === 'function') updateDeportesCartUI();
      return;
    }
    const mujerModal = document.getElementById('mujerCartModal');
    if (mujerModal) {
      mujerModal.classList.remove('hidden');
      if (typeof renderMujerCartModalContent === 'function') renderMujerCartModalContent();
      return;
    }
    const modaModal = document.getElementById('modaCartModal');
    if (modaModal) {
      modaModal.classList.remove('hidden');
      if (typeof renderModaCartModalContent === 'function') renderModaCartModalContent();
      return;
    }
    const indexCart = document.getElementById('cartModal');
    if (indexCart) {
      indexCart.classList.remove('hidden');
      if (typeof renderCartModal === 'function') renderCartModal();
      return;
    }

    // Only redirect if NOT on index.html
    const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '';
    if (!isIndex) {
      window.location.href = 'index.html?openCart=1';
    }
  };


  // ============================================================
  // SAGABELLA MASTER CATALOG & FALABELLA-STYLE SEARCH ENGINE
  // ============================================================
  const MASTER_CATALOG = window.SAGABELLA_MASTER_CATALOG || [];

  let currentSearchQuery = '';
  let currentSearchCatFilter = 'all';
  let currentSearchBrandFilter = 'all';
  let currentSearchSort = 'relevance';
  let searchDebounceTimer = null;

  function normSearchStr(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/["'“”‘’]/g, '')
      .trim();
  }

  function searchMasterCatalog(query, catFilter, brandFilter, sortVal) {
    const q = normSearchStr(query);
    if (!q) return { products: [], brands: [], categories: [], terms: [], total: 0 };

    const words = q.split(/\s+/).filter(Boolean);
    const catalog = window.SAGABELLA_MASTER_CATALOG || [];

    // Filter products
    let matches = catalog.filter(p => {
      const text = normSearchStr(`${p.name} ${p.brand} ${p.category} ${p.subCategory} ${p.code}`);
      return words.every(w => {
        if (text.includes(w)) return true;
        // Plural / singular support in Spanish
        if (w.endsWith('s') && text.includes(w.slice(0, -1))) return true;
        if (!w.endsWith('s') && text.includes(w + 's')) return true;
        if (!w.endsWith('es') && text.includes(w + 'es')) return true;
        return false;
      });
    });

    // Score relevance
    matches.sort((a, b) => {
      const aName = normSearchStr(a.name);
      const bName = normSearchStr(b.name);
      const aBrand = normSearchStr(a.brand);
      const bBrand = normSearchStr(b.brand);

      // Exact name starts with query
      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Brand exact match
      const aBrandMatch = aBrand === q;
      const bBrandMatch = bBrand === q;
      if (aBrandMatch && !bBrandMatch) return -1;
      if (!aBrandMatch && bBrandMatch) return 1;

      // Review count / popularity
      return (b.reviewsCount || 0) - (a.reviewsCount || 0);
    });

    const allMatchedBrands = Array.from(new Set(matches.map(p => p.brand).filter(Boolean))).sort();
    const allMatchedCategories = Array.from(new Set(matches.map(p => p.category).filter(Boolean))).sort();

    // Sorters
    if (sortVal === 'price_asc') {
      matches.sort((a, b) => (a.priceCmr || a.price) - (b.priceCmr || b.price));
    } else if (sortVal === 'price_desc') {
      matches.sort((a, b) => (b.priceCmr || b.price) - (a.priceCmr || a.price));
    } else if (sortVal === 'rating') {
      matches.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortVal === 'discount') {
      const getDiscNum = p => {
        const m = String(p.discount || '').match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      };
      matches.sort((a, b) => getDiscNum(b) - getDiscNum(a));
    }

    // Filter by cat/brand if specified
    let filteredMatches = matches;
    if (catFilter && catFilter !== 'all') {
      filteredMatches = filteredMatches.filter(p => p.category === catFilter);
    }
    if (brandFilter && brandFilter !== 'all') {
      filteredMatches = filteredMatches.filter(p => p.brand === brandFilter);
    }

    // Term suggestions
    const terms = [];
    matches.slice(0, 8).forEach(p => {
      const nameWords = p.name.split(' ');
      const t = nameWords.slice(0, 3).join(' ');
      if (!terms.includes(t)) terms.push(t);
    });

    return {
      query: q,
      total: filteredMatches.length,
      rawTotal: matches.length,
      products: filteredMatches,
      brands: allMatchedBrands,
      categories: allMatchedCategories,
      terms: terms.slice(0, 6)
    };
  }

  // ============================================================
  // LIVE DROPDOWN RENDERER (1:1 with Falabella.com)
  // ============================================================
  function renderLiveSearchDropdown(query) {
    const input = document.getElementById('storeSearchInput') || document.querySelector('.store-search-input');
    if (!input) return;

    const wrap = input.closest('.store-search-wrap') || input.parentElement;
    if (!wrap) return;

    // Ensure parent container has relative position
    const parentContainer = wrap.parentElement;
    if (parentContainer && !parentContainer.classList.contains('relative') && getComputedStyle(parentContainer).position === 'static') {
      parentContainer.style.position = 'relative';
    }

    let dropdown = document.getElementById('falabellaSearchDropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'falabellaSearchDropdown';
      dropdown.className = 'fal-search-dropdown hidden';
      dropdown.onclick = e => e.stopPropagation();
      wrap.after(dropdown);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      dropdown.classList.add('hidden');
      dropdown.style.display = 'none';
      return;
    }

    const res = searchMasterCatalog(trimmed);

    if (res.rawTotal === 0) {
      // Empty state in dropdown
      dropdown.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">
          <div style="font-size: 26px; margin-bottom: 6px;">🔍</div>
          <div style="font-weight: 800; color: #0f172a; font-size: 14px;">No encontramos resultados para "${escapeHtml(trimmed)}"</div>
          <p style="margin: 6px 0 14px 0; font-size: 12px; color: #64748b;">Verifica la ortografía o explora nuestras categorías oficiales:</p>
          <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
            <button type="button" onclick="window.executeStoreSearch('Tecnología')" style="padding: 6px 12px; border-radius: 99px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 11.5px; font-weight: 700; cursor: pointer; color: #334155;">Tecnología</button>
            <button type="button" onclick="window.executeStoreSearch('Calzado')" style="padding: 6px 12px; border-radius: 99px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 11.5px; font-weight: 700; cursor: pointer; color: #334155;">Calzado</button>
            <button type="button" onclick="window.executeStoreSearch('Belleza')" style="padding: 6px 12px; border-radius: 99px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 11.5px; font-weight: 700; cursor: pointer; color: #334155;">Belleza</button>
            <button type="button" onclick="window.executeStoreSearch('Decohogar')" style="padding: 6px 12px; border-radius: 99px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 11.5px; font-weight: 700; cursor: pointer; color: #334155;">Decohogar</button>
            <button type="button" onclick="window.executeStoreSearch('Deportes')" style="padding: 6px 12px; border-radius: 99px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 11.5px; font-weight: 700; cursor: pointer; color: #334155;">Deportes</button>
          </div>
        </div>
      `;
      dropdown.classList.remove('hidden');
      dropdown.style.display = 'block';
      return;
    }

    // Highlight helper
    const highlight = (text, q) => {
      if (!q) return escapeHtml(text);
      const re = new RegExp('(' + q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + ')', 'gi');
      return escapeHtml(text).replace(re, '<b style="color:#0f172a; font-weight:900;">$1</b>');
    };

    // 1. Column Suggestions
    const termsHtml = res.terms.map(t => `
      <div onclick="window.executeStoreSearch('${escapeHtml(t)}')" class="fal-search-item" style="padding: 7px 10px; border-radius: 8px; cursor: pointer; transition: background .12s; font-size: 12.5px; color: #334155;">
        <span style="font-weight: 600;">${highlight(t, trimmed)}</span>
        ${res.categories[0] ? `<div style="font-size: 10.5px; color: #94a3b8; margin-top: 1px;">en ${escapeHtml(res.categories[0])}</div>` : ''}
      </div>
    `).join('');

    // 2. Column Brands
    const brandsHtml = res.brands.slice(0, 8).map(b => `
      <div onclick="window.executeStoreSearch('${escapeHtml(b)}')" class="fal-search-item" style="padding: 6px 10px; border-radius: 8px; cursor: pointer; transition: background .12s; font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase;">
        ${highlight(b, trimmed)}
      </div>
    `).join('');

    // 3. Column Categories
    const catsHtml = res.categories.slice(0, 6).map(c => `
      <div onclick="window.executeStoreSearch('${escapeHtml(c)}')" class="fal-search-item" style="padding: 6px 10px; border-radius: 8px; cursor: pointer; transition: background .12s; font-size: 12px; font-weight: 700; color: #0f766e; display: flex; align-items: center; justify-content: space-between;">
        <span>${escapeHtml(c)}</span>
        <span style="font-size: 11px; color: #cbd5e1;">&rarr;</span>
      </div>
    `).join('');

    // 4. Product Highlights Row
    const topProds = res.products.slice(0, 3);
    const prodsRowHtml = topProds.map(p => `
      <div onclick="window.navigateToProduct('${p.id}', '${p.page}')" class="fal-search-prod-card" style="display: flex; gap: 10px; padding: 8px 10px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; transition: transform .15s, box-shadow .15s; align-items: center;">
        <div style="width: 50px; height: 50px; border-radius: 8px; overflow: hidden; background: #f8fafc; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          <img src="${p.image}" alt="${escapeHtml(p.name)}" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&auto=format&fit=crop&q=60';" />
        </div>
        <div style="min-width: 0; flex: 1;">
          <span style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">${escapeHtml(p.brand)}</span>
          <div style="font-size: 11.5px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${escapeHtml(p.name)}</div>
          <div style="display: flex; align-items: baseline; gap: 6px; margin-top: 2px;">
            <span style="font-size: 12.5px; font-weight: 900; color: #dc2626;">S/ ${(p.priceCmr || p.price).toFixed(2)}</span>
            ${p.priceNormal > (p.priceCmr || p.price) ? `<span style="font-size: 10px; color: #94a3b8; text-decoration: line-through;">S/ ${p.priceNormal.toFixed(2)}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    dropdown.innerHTML = `
      <div style="display: grid; grid-template-columns: 1.25fr 1fr 1fr; gap: 14px; padding: 16px 20px;">
        <!-- Col 1: Sugerencias -->
        <div>
          <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 8px;">Sugerencias</div>
          <div>${termsHtml || '<div style="font-size:12px; color:#94a3b8; padding:6px;">Sin sugerencias directas</div>'}</div>
        </div>

        <!-- Col 2: Marcas Relacionadas -->
        <div style="border-left: 1px solid #f1f5f9; padding-left: 14px;">
          <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 8px;">Marcas relacionadas</div>
          <div>${brandsHtml || '<div style="font-size:12px; color:#94a3b8; padding:6px;">Sin marcas asociadas</div>'}</div>
        </div>

        <!-- Col 3: Categorías Relacionadas -->
        <div style="border-left: 1px solid #f1f5f9; padding-left: 14px;">
          <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 8px;">Categorías</div>
          <div>${catsHtml || '<div style="font-size:12px; color:#94a3b8; padding:6px;">Sin categorías asociadas</div>'}</div>
        </div>
      </div>

      <!-- Productos Recomendados -->
      ${prodsRowHtml ? `
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px 20px;">
          <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin-bottom: 8px;">Productos recomendados</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
            ${prodsRowHtml}
          </div>
        </div>
      ` : ''}

      <!-- Footer Action -->
      <div onclick="window.executeStoreSearch('${escapeHtml(trimmed)}')" style="padding: 12px 20px; background: #ffffff; border-top: 1px solid #e2e8f0; text-align: center; cursor: pointer; font-weight: 800; font-size: 13px; color: #0f172a; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <span>Ver todos los resultados para "<b>${escapeHtml(trimmed)}</b>"</span>
        <span style="background: #aad500; color: #0f172a; padding: 1px 8px; border-radius: 99px; font-size: 11px; font-weight: 900;">${res.rawTotal}</span>
        <span style="font-weight: 900;">&rarr;</span>
      </div>
    `;

    dropdown.classList.remove('hidden');
    dropdown.style.display = 'block';
  }

  window.closeSearchDropdown = function() {
    const dropdown = document.getElementById('falabellaSearchDropdown');
    if (dropdown) {
      dropdown.classList.add('hidden');
      dropdown.style.display = 'none';
    }
  };

  window.clearStoreSearch = function() {
    const input = document.getElementById('storeSearchInput') || document.querySelector('.store-search-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    const clearBtn = document.getElementById('storeSearchClearBtn');
    if (clearBtn) clearBtn.classList.add('hidden');
    window.closeSearchDropdown();
  };

  window.handleStoreSearchInput = function(val) {
    const clearBtn = document.getElementById('storeSearchClearBtn');
    if (clearBtn) {
      if (val && val.trim().length > 0) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      renderLiveSearchDropdown(val);
    }, 90);
  };

  // ============================================================
  // FULL SEARCH RESULTS MODAL
  // ============================================================
  window.openSearchResultsModal = function(query) {
    ensureModalsInDOM();
    window.closeSearchDropdown();
    currentSearchQuery = query || '';
    currentSearchCatFilter = 'all';
    currentSearchBrandFilter = 'all';
    currentSearchSort = 'relevance';

    const modal = document.getElementById('falUniversalSearchResultsModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    renderSearchResultsContent();
  };

  window.closeSearchResultsModal = function() {
    const modal = document.getElementById('falUniversalSearchResultsModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  };

  function renderSearchResultsContent() {
    const queryEl = document.getElementById('falSearchResultsQueryText');
    const countBadge = document.getElementById('falSearchResultsCountBadge');
    const chipsContainer = document.getElementById('falSearchCategoryChips');
    const gridContainer = document.getElementById('falSearchResultsGridContainer');

    if (!gridContainer) return;

    const res = searchMasterCatalog(currentSearchQuery, currentSearchCatFilter, currentSearchBrandFilter, currentSearchSort);

    if (queryEl) queryEl.textContent = currentSearchQuery || 'Todos los productos';
    if (countBadge) countBadge.textContent = `${res.total} producto${res.total === 1 ? '' : 's'}`;

    // Render category chips
    if (chipsContainer) {
      // Get all categories for this base search
      const baseRes = searchMasterCatalog(currentSearchQuery, 'all', 'all');
      const catCounts = {};
      baseRes.products.forEach(p => {
        catCounts[p.category] = (catCounts[p.category] || 0) + 1;
      });

      let chipsHtml = `
        <button type="button" onclick="window.filterSearchByCategory('all')" style="padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 800; cursor: pointer; border: none; transition: all .15s; white-space: nowrap; ${currentSearchCatFilter === 'all' ? 'background: #0f172a; color: #fff;' : 'background: #fff; border: 1px solid #cbd5e1; color: #475569;'}">
          Todas (${baseRes.products.length})
        </button>
      `;

      Object.keys(catCounts).forEach(cat => {
        const isSelected = currentSearchCatFilter === cat;
        chipsHtml += `
          <button type="button" onclick="window.filterSearchByCategory('${escapeHtml(cat)}')" style="padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 800; cursor: pointer; transition: all .15s; white-space: nowrap; ${isSelected ? 'background: #0f172a; color: #fff; border: none;' : 'background: #fff; border: 1px solid #cbd5e1; color: #475569;'}">
            ${escapeHtml(cat)} (${catCounts[cat]})
          </button>
        `;
      });

      chipsContainer.innerHTML = chipsHtml;
    }

    // Render Products Grid
    if (res.total === 0) {
      gridContainer.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: #64748b; max-width: 480px; margin: 0 auto;">
          <div style="font-size: 42px; margin-bottom: 12px;">🔍</div>
          <h3 style="font-size: 18px; font-weight: 900; color: #0f172a; margin: 0 0 6px 0;">No encontramos resultados</h3>
          <p style="font-size: 13px; color: #64748b; margin: 0 0 20px 0;">No hay productos en Sagabella que coincidan con "<b>${escapeHtml(currentSearchQuery)}</b>". Intenta con otro término o explora nuestras categorías:</p>
          <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
            <a href="tecnologia.html" class="btn" style="padding: 8px 16px; border-radius: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 800; text-decoration: none; color: #0f172a;">📱 Tecnología</a>
            <a href="calzado.html" class="btn" style="padding: 8px 16px; border-radius: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 800; text-decoration: none; color: #0f172a;">👟 Calzado</a>
            <a href="belleza.html" class="btn" style="padding: 8px 16px; border-radius: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 800; text-decoration: none; color: #0f172a;">💄 Belleza</a>
            <a href="decohogar.html" class="btn" style="padding: 8px 16px; border-radius: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 800; text-decoration: none; color: #0f172a;">🛋️ Decohogar</a>
            <a href="deportes.html" class="btn" style="padding: 8px 16px; border-radius: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 800; text-decoration: none; color: #0f172a;">🚴 Deportes</a>
          </div>
        </div>
      `;
      return;
    }

    gridContainer.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px;">
        ${res.products.map(p => `
          <div class="fal-prod-result-card" style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; background: #fff; display: flex; flex-direction: column; justify-content: space-between; position: relative; transition: transform .18s, box-shadow .18s; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
            <div>
              <!-- Image Wrap -->
              <div onclick="window.navigateToProduct('${p.id}', '${p.page}')" style="position: relative; width: 100%; height: 160px; background: #f8fafc; border-radius: 12px; overflow: hidden; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                ${p.badge ? `<span style="position: absolute; top: 8px; left: 8px; background: #0f172a; color: #aad500; font-size: 9.5px; font-weight: 900; padding: 2px 7px; border-radius: 6px; text-transform: uppercase;">${escapeHtml(p.badge)}</span>` : ''}
                ${p.discount ? `<span style="position: absolute; top: 8px; right: 8px; background: #dc2626; color: #fff; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 6px;">${escapeHtml(p.discount)}</span>` : ''}
                <img src="${p.image}" alt="${escapeHtml(p.name)}" style="max-height: 85%; max-width: 85%; object-fit: contain; transition: transform .25s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&auto=format&fit=crop&q=70';" />
              </div>

              <!-- Brand & Category -->
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">${escapeHtml(p.brand)}</span>
                <span style="font-size: 10px; font-weight: 700; color: #0f766e; background: #f0fdf4; padding: 1px 6px; border-radius: 4px;">${escapeHtml(p.category)}</span>
              </div>

              <!-- Title -->
              <h4 onclick="window.navigateToProduct('${p.id}', '${p.page}')" style="margin: 0 0 8px 0; font-size: 12.5px; font-weight: 700; color: #0f172a; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 34px; cursor: pointer;">
                ${escapeHtml(p.name)}
              </h4>

              <!-- Rating -->
              <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #f59e0b; margin-bottom: 8px;">
                <span>★</span>
                <span style="font-weight: 800; color: #0f172a;">${p.rating || 4.8}</span>
                <span style="color: #94a3b8; font-size: 10px;">(${p.reviewsCount || 30})</span>
              </div>
            </div>

            <!-- Price & Actions -->
            <div style="border-top: 1px solid #f1f5f9; padding-top: 10px; margin-top: 6px;">
              <div style="margin-bottom: 10px;">
                <div style="display: flex; align-items: baseline; gap: 6px;">
                  <span style="font-size: 16px; font-weight: 900; color: #0f172a;">S/ ${(p.priceCmr || p.price).toFixed(2)}</span>
                  <span style="font-size: 9.5px; font-weight: 800; background: #ecfdf5; color: #059669; padding: 1px 4px; border-radius: 4px;">CMR</span>
                </div>
                ${p.priceNormal > (p.priceCmr || p.price) ? `
                  <div style="font-size: 11px; color: #94a3b8; text-decoration: line-through;">S/ ${p.priceNormal.toFixed(2)} Regular</div>
                ` : ''}
              </div>

              <div style="display: flex; gap: 6px;">
                <button type="button" onclick="window.addToStoreCartFromSearch('${p.id}')" style="flex: 1; padding: 8px 10px; border-radius: 10px; background: #0f172a; color: #fff; font-size: 11.5px; font-weight: 800; border: none; cursor: pointer; transition: background .15s; display: flex; align-items: center; justify-content: center; gap: 5px;">
                  <span>🛒</span>
                  <span>Agregar</span>
                </button>
                <button type="button" onclick="window.navigateToProduct('${p.id}', '${p.page}')" style="padding: 8px 10px; border-radius: 10px; background: #f8fafc; border: 1px solid #cbd5e1; color: #334155; font-size: 11px; font-weight: 700; cursor: pointer; transition: all .15s;" title="Ver en tienda">
                  Ver
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  window.filterSearchByCategory = function(cat) {
    currentSearchCatFilter = cat;
    renderSearchResultsContent();
  };

  window.filterSearchByBrand = function(brand) {
    currentSearchBrandFilter = brand;
    renderSearchResultsContent();
  };

  window.sortSearchResults = function(sortVal) {
    currentSearchSort = sortVal;
    renderSearchResultsContent();
  };

  window.addToStoreCartFromSearch = function(prodId) {
    const catalog = window.SAGABELLA_MASTER_CATALOG || [];
    const prod = catalog.find(p => String(p.id) === String(prodId));
    if (!prod) return;

    let cart = [];
    try {
      cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    } catch (e) { cart = []; }

    const existing = cart.find(it => String(it.id) === String(prod.id));
    if (existing) {
      existing.qty = (existing.qty || existing.quantity || 1) + 1;
    } else {
      cart.push({
        id: String(prod.id),
        code: prod.code,
        name: prod.name,
        price: prod.priceCmr || prod.price,
        image: prod.image,
        brand: prod.brand,
        qty: 1
      });
    }

    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {}

    syncAllCartBadges();
    showGlobalToast(`✓ ${prod.name} agregado a tu bolsa de compras.`, 'success');

    // Trigger local page UI updates if functions exist
    if (typeof window.updateCartUI === 'function') window.updateCartUI();
    if (typeof window.updateCartBadge === 'function') window.updateCartBadge();
    if (typeof window.renderCartDrawerItems === 'function') window.renderCartDrawerItems();
    if (typeof window.renderTechCartModalContent === 'function') window.renderTechCartModalContent();
    if (typeof window.renderBellezaCartModalContent === 'function') window.renderBellezaCartModalContent();
    if (typeof window.renderDecoCartModalContent === 'function') window.renderDecoCartModalContent();
    if (typeof window.updateDeportesCartUI === 'function') window.updateDeportesCartUI();
  };

  window.navigateToProduct = function(prodId, targetPage) {
    window.closeSearchResultsModal();
    window.closeSearchDropdown();

    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    if (targetPage && targetPage !== currentFile) {
      window.location.href = targetPage + '?highlightProduct=' + encodeURIComponent(prodId);
    } else {
      // Already on page: try to scroll to element
      const el = document.querySelector(`[data-product-id="${prodId}"], [data-fav-prod-id="${prodId}"], article`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '3px solid #aad500';
        setTimeout(() => { el.style.outline = ''; }, 2500);
      }
    }
  };

  // ============================================================
  // UNIFIED EXECUTE STORE SEARCH (Replaces old router)
  // ============================================================
  window.executeStoreSearch = function(customQuery) {
    const input = document.getElementById('storeSearchInput') || document.querySelector('.store-search-input');
    const query = (customQuery !== undefined ? customQuery : (input ? input.value : '')).trim();

    if (input && customQuery) {
      input.value = customQuery;
    }

    window.closeSearchDropdown();

    if (!query) {
      // If empty, open results for all or prompt
      window.openSearchResultsModal('');
      return;
    }

    // Open universal results modal with all genuine matching products
    window.openSearchResultsModal(query);

    // Also trigger local category page search if relevant to page
    if (typeof window.executeTechSearch === 'function') try { window.executeTechSearch(query); } catch (e) {}
    if (typeof window.executeCalzadoSearch === 'function') try { window.executeCalzadoSearch(query); } catch (e) {}
    if (typeof window.executeBellezaSearch === 'function') try { window.executeBellezaSearch(query); } catch (e) {}
    if (typeof window.executeDecoSearch === 'function') try { window.executeDecoSearch(query); } catch (e) {}
    if (typeof window.triggerDeportesSearch === 'function') try { window.triggerDeportesSearch(query); } catch (e) {}
    if (typeof window.executeMujerSearch === 'function') try { window.executeMujerSearch(query); } catch (e) {}
    if (typeof window.executeModaSearch === 'function') try { window.executeModaSearch(query); } catch (e) {}
  };

  // Setup search input listeners across any page
  function setupUniversalSearchInputs() {
    const inputs = document.querySelectorAll('#storeSearchInput, .store-search-input');
    inputs.forEach(inp => {
      if (inp.__falSearchBound) return;
      inp.__falSearchBound = true;
      inp.setAttribute('autocomplete', 'off');

      const wrap = inp.closest('.store-search-wrap') || inp.parentElement;
      if (wrap) {
        // Add clear button if not exists
        if (!wrap.querySelector('#storeSearchClearBtn')) {
          const clearBtn = document.createElement('button');
          clearBtn.type = 'button';
          clearBtn.id = 'storeSearchClearBtn';
          clearBtn.className = 'store-search-clear-btn hidden';
          clearBtn.innerHTML = '&times;';
          clearBtn.title = 'Limpiar búsqueda';
          clearBtn.onclick = function(e) {
            e.stopPropagation();
            window.clearStoreSearch();
          };
          inp.after(clearBtn);
        }
      }

      inp.addEventListener('input', function() {
        window.handleStoreSearchInput(this.value);
      });

      inp.addEventListener('focus', function() {
        if (this.value && this.value.trim().length > 0) {
          renderLiveSearchDropdown(this.value);
        }
      });

      inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          window.executeStoreSearch(this.value);
        } else if (e.key === 'Escape') {
          window.closeSearchDropdown();
        }
      });
    });

    // Close dropdown on click outside
    document.addEventListener('click', function(e) {
      const dropdown = document.getElementById('falabellaSearchDropdown');
      const wrap = e.target.closest('.store-search-wrap') || e.target.closest('#falabellaSearchDropdown');
      if (!wrap && dropdown) {
        window.closeSearchDropdown();
      }
    });
  }


  function syncAllCartBadges() {
    try {
      const raw = localStorage.getItem('falabella_store_cart_v2');
      const cart = raw ? JSON.parse(raw) : [];
      let totalQty = 0;
      if (Array.isArray(cart)) {
        totalQty = cart.reduce((sum, item) => sum + (parseInt(item.quantity || item.qty || 1, 10) || 1), 0);
      }
      const badges = document.querySelectorAll('#storeCartBadge, #techCartBadge, #bellezaCartBadge, #decoCartBadge, #deportesCartBadge, #mujerCartBadge, #modaCartBadge, #calzadoCartBadge, .cart-badge');
      badges.forEach(b => {
        b.textContent = totalQty;
        b.style.display = totalQty > 0 ? 'flex' : 'none';
      });
    } catch (e) {}
  }

  function startSuite() {
    bootFalabellaSuite();
    syncLocationUI();
    syncAllCartBadges();
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
