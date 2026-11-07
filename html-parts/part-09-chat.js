/* =====================================================================================================
   CHATBOT DE PREGUNTAS FRECUENTES (EP-09 · HU-36 · RN-27 · EX-14)
   Módulo AISLADO: no comparte estado ni lógica con el login/autenticación. Solo informa (nunca
   ejecuta operaciones comerciales) y está limitado a la información preconfigurada.
   ===================================================================================================== */
var Chatbot = (function(){

  /* ---- Base de conocimiento preconfigurada (RN-27: respuestas limitadas a este contenido) ---- */
  const KB = [
    { topic:'Productos', keys:['producto','productos','catalogo','articulo','articulos','que venden','que venden ustedes','venden','marca','marcas','categoria','categorias','precio','precios','cuanto cuesta','cuanto sale','oferta'],
      answer:'En Sagabella encontrarás productos de tecnología, hogar, moda, deportes y accesorios. El catálogo completo está disponible en sagabella.com.pe y en tienda: cada ficha muestra precio, descripción y disponibilidad. ¿Buscas alguna categoría en particular?' },
    { topic:'Pedidos', keys:['pedido','pedidos','estado de mi pedido','seguimiento','donde esta mi pedido','mi orden','envio','envios','despacho','entrega','cuando llega','recojo'],
      answer:'Puedes consultar el estado de tu pedido con el número de pedido (por ejemplo PD-0001) en «Atención al cliente → Consultar pedido» del sistema. Los estados son: Preparando → Enviado → Entregado, y se actualizan a medida que avanza el proceso.' },
    { topic:'Pagos', keys:['pago','pagos','metodo de pago','metodos de pago','tarjeta','efectivo','yape','plin','vuelto','cuotas','medio de pago','cancelar el pago','abonar'],
      answer:'Aceptamos tres métodos de pago: Efectivo, Tarjeta y Yape/Plin. El pago se valida antes de confirmar la venta: si es rechazado, la venta no se confirma y puedes elegir otro método. En efectivo se calcula el vuelto automáticamente.' },
    { topic:'Cambios', keys:['cambio','cambios','cambiar','talla','talle','reemplazo','intercambio','cambiar talla','cambiar producto'],
      answer:'Para un cambio necesitas tu comprobante de compra: debe estar dentro del plazo establecido, con el producto en buen estado y sujeto a la disponibilidad del producto de reemplazo. La solicitud se registra en «Cambios y devoluciones» y la evalúa Atención al Cliente.' },
    { topic:'Devoluciones', keys:['devolucion','devoluciones','devolver','reembolso','reembolsos','reintegro','devolver mi dinero','devolver producto'],
      answer:'Las devoluciones se rigen por la política: producto vendido por Sagabella, dentro del plazo y en condiciones adecuadas. El reembolso se realiza por el mismo medio de pago de la compra. Los productos vendidos por otros vendedores (OTRO) siguen la política del vendedor correspondiente.' },
    { topic:'Comprobante', keys:['comprobante','boleta','factura','recibo','ticket','constancia'],
      answer:'Tu comprobante se genera automáticamente al confirmar la venta e incluye número de venta, productos, cantidades, total, método de pago y fecha. Puedes consultarlo desde el módulo «Ventas» con el número de tu compra.' },
    { topic:'Promociones', keys:['promocion','promociones','descuento','descuentos','ofertas','rebaja','cupon'],
      answer:'Las promociones vigentes se aplican automáticamente al calcular el total de tu compra y se detallan en el comprobante. Las promociones vencidas o cuyas condiciones no se cumplen no se aplican.' },
    { topic:'Atención', keys:['horario','atienden','contacto','contactar','telefono','correo','ayuda','reclamo','queja','libro de reclamaciones','humano','asesor','persona','agente'],
      answer:'Atención al Cliente está disponible de lunes a sábado, de 9:00 a 21:00, en tienda, por este chat o escribiendo a contacto@sagabella.com. Si tu consulta requiere una gestión, el equipo te atenderá personalmente.' }
  ];

  const QUICK_REPLIES = ['Productos','Pedidos','Pagos','Cambios','Devoluciones'];

  const ACTION_RE = /\b(cancel\w*|anul\w*|modific\w*|elimin\w*|borr\w*|realiz\w*|proces\w*|registr\w*|haz|hacer|ejecut\w*|devolver|reembols\w*|cambiar|crea\w*|gener\w*)\b/;
  const COMMERCE_RE = /\b(pedido|pedidos|venta|ventas|pago|pagos|devolucion|devoluciones|cambio|cambios|compra|reembolso|comprobante)\b/;
  const RESTRICTED_RE = /\b(dni|contraseña|contrasena|credenciales|stock|inventario|reporte|reportes|ventas totales|cuanto vendieron|datos personales|datos de clientes|informacion interna|usuarios del sistema)\b/;
  const GREET_RE = /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/;
  const THANKS_RE = /\b(gracias|muchas gracias|te agradezco|thank)\b/;

  const ACTION_REPLY = 'Lo siento, no puedo ejecutar operaciones sobre ventas, pagos, pedidos, cambios o devoluciones: solo brindo información. Para realizar esa gestión debes comunicarte con Atención al Cliente o usar el módulo correspondiente del sistema con la autorización adecuada.';
  const RESTRICTED_REPLY = 'Lo siento, no puedo compartir información interna ni datos personales o restringidos del sistema. Esa información depende del rol de acceso de cada usuario. Si necesitas ayuda con tu compra, comunícate con Atención al Cliente.';
  const FALLBACK = 'Lo siento, no dispongo de una respuesta para esa consulta. Puedo ayudarte con preguntas frecuentes sobre productos, pedidos, pagos, cambios y devoluciones (también puedes usar los botones rápidos). Para otros casos, comunícate con Atención al Cliente: lunes a sábado, de 9:00 a 21:00.';
  const GREETING = '¡Hola! Soy el chatbot de Sagabella. Puedo responder consultas frecuentes sobre productos, pedidos, pagos, cambios y devoluciones. ¿En qué te ayudo?';
  const THANKS = '¡Con gusto! Si tienes otra consulta sobre productos, pedidos, pagos, cambios o devoluciones, escríbeme. Para gestiones específicas, Atención al Cliente te atenderá personalmente.';

  function normalizeText(t){
    return String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!.,;:()]/g,' ').replace(/\s+/g,' ').trim();
  }

  /* ---- Motor de respuestas (solo consulta la información configurada) ---- */
  function answerFor(raw){
    const q = normalizeText(raw);
    if(!q) return FALLBACK;
    if(GREET_RE.test(q)) return GREETING;
    if(THANKS_RE.test(q) && q.split(' ').length <= 4) return THANKS;
    if(ACTION_RE.test(q) && COMMERCE_RE.test(q)) return ACTION_REPLY;       // no ejecuta operaciones
    if(RESTRICTED_RE.test(q)) return RESTRICTED_REPLY;                      // respeta restricciones de acceso
    let best = null, bestScore = 0;
    KB.forEach(function(t){
      let score = 0;
      t.keys.forEach(function(k){
        const nk = normalizeText(k);
        if(q === nk) score += 3;
        else if(q.indexOf(nk) !== -1) score += nk.length >= 5 ? 2 : 1;
      });
      if(score > bestScore){ bestScore = score; best = t; }
    });
    return (best && bestScore >= 2) ? best.answer : FALLBACK;               // EX-14: sin respuesta → derivar
  }

  /* ---- Widget de chat (instancia independiente por contenedor) ---- */
  function createWidget(container, opts){
    opts = opts || {};
    const state = { messages:[], el:null, msgsEl:null, inputEl:null, busy:false };
    const id = 'chat_' + Math.random().toString(36).slice(2,9);

    function welcome(){
      if(!state.messages.length) pushBot('¡Hola! Soy el chatbot de Sagabella. Respondo preguntas frecuentes sobre <b>productos</b>, <b>pedidos</b>, <b>pagos</b>, <b>cambios</b> y <b>devoluciones</b>. Recuerda: solo brindo información, no ejecuto operaciones.');
    }
    function pushBot(text){
      state.messages.push({ who:'bot', text:text });
      renderMsgs();
    }
    function pushUser(text){
      state.messages.push({ who:'user', text:text });
      renderMsgs();
    }
    function renderMsgs(){
      if(!state.msgsEl) return;
      state.msgsEl.innerHTML = state.messages.map(function(m){
        return m.who === 'bot'
          ? '<div class="chat-bubble-bot self-start">' + m.text + '</div>'
          : '<div class="chat-bubble-user self-end">' + escapeHtml(m.text) + '</div>';
      }).join('') +
      (state.busy ? '<div class="chat-bubble-bot self-start flex items-center gap-1.5"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>' : '');
      state.msgsEl.scrollTop = state.msgsEl.scrollHeight;
    }
    function send(text){
      if(state.busy) return;
      const q = String(text||'').trim();
      if(!q) return;
      pushUser(q);
      state.busy = true;
      renderMsgs();
      setTimeout(function(){
        state.busy = false;
        state.messages.push({ who:'bot', text:answerFor(q) });
        renderMsgs();
      }, 650 + Math.random()*450);
    }
    function build(){
      container.innerHTML =
        '<div class="flex flex-col h-full min-h-0">' +
          '<div class="bg-brand-800 px-4 py-3.5 flex items-center gap-3 flex-shrink-0">' +
            '<div class="w-9 h-9 rounded-full bg-brand-600 grid place-items-center text-white flex-shrink-0">' + icon('bot','w-5 h-5') + '</div>' +
            '<div class="min-w-0 flex-1"><div class="text-white text-[13.5px] font-bold leading-tight">Chatbot Sagabella</div>' +
              '<div class="text-brand-200 text-[10.5px] flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>En línea · solo consultas informativas</div></div>' +
            (opts.closable ? '<button class="text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/10 transition" data-close title="Cerrar chat">' + icon('x','w-4 h-4') + '</button>' : '') +
          '</div>' +
          '<div class="flex-1 min-h-0 overflow-y-auto scroll-styled bg-slate-50 p-4 flex flex-col gap-2.5" data-msgs></div>' +
          '<div class="px-3 pt-2.5 pb-1.5 flex gap-1.5 overflow-x-auto scroll-styled flex-shrink-0 bg-white border-t border-slate-100">' +
            QUICK_REPLIES.map(function(t){ return '<button class="chat-quick flex-shrink-0" data-quick="' + t + '">' + t + '</button>'; }).join('') +
          '</div>' +
          '<div class="p-3 pt-2 flex gap-2 items-center border-t border-slate-100 bg-white flex-shrink-0">' +
            '<input class="input flex-1 !py-2 !text-[13px]" data-input placeholder="Escribe tu pregunta…" maxlength="200" />' +
            '<button class="btn btn-primary btn-icon !p-2.5" data-send title="Enviar">' + icon('send','w-4 h-4') + '</button>' +
          '</div>' +
        '</div>';
      state.el = container.firstElementChild;
      state.msgsEl = state.el.querySelector('[data-msgs]');
      state.inputEl = state.el.querySelector('[data-input]');
      state.el.querySelector('[data-send]').addEventListener('click', function(){ send(state.inputEl.value); state.inputEl.value=''; state.inputEl.focus(); });
      state.inputEl.addEventListener('keydown', function(e){
        if(e.key === 'Enter'){ e.preventDefault(); send(state.inputEl.value); state.inputEl.value=''; }
      });
      state.el.querySelectorAll('[data-quick]').forEach(function(btn){
        btn.addEventListener('click', function(){ send(btn.getAttribute('data-quick')); });
      });
      const closeBtn = state.el.querySelector('[data-close]');
      if(closeBtn) closeBtn.addEventListener('click', function(e){ e.stopPropagation(); if(opts.onClose) opts.onClose(); });
      welcome();
    }
    build();
    return { send:send, container:container };
  }

  /* ---- Instancia flotante (botón FAB + panel) ---- */
  let floating = null;
  function toggleFloating(){
    const fab = document.getElementById('chatFab');
    const panel = document.getElementById('chatPanel');
    if(!fab || !panel) return;
    if(panel.classList.contains('hidden')){
      if(!floating){
        panel.classList.remove('hidden');
        floating = createWidget(panel, { closable:true, onClose:function(){ closeFloating(); } });
      }else{
        panel.classList.remove('hidden');
      }
      panel.classList.add('flex');
      const inp = panel.querySelector('[data-input]');
      if(inp) setTimeout(function(){ inp.focus(); }, 60);
    }else{
      closeFloating();
    }
  }
  function closeFloating(){
    const panel = document.getElementById('chatPanel');
    if(panel){ panel.classList.add('hidden'); panel.classList.remove('flex'); }
  }

  /* ---- Inicialización (no interfiere con el login: solo bindea su propio botón) ---- */
  function init(){
    const fab = document.getElementById('chatFab');
    if(fab){
      fab.addEventListener('click', function(e){ e.stopPropagation(); toggleFloating(); });
      const iconHolder = document.getElementById('chatFabIcon');
      if(iconHolder) iconHolder.innerHTML = icon('msg','w-6 h-6');
    }
    /* Evitar que un clic dentro del panel flotante lo cierre */
    const panel = document.getElementById('chatPanel');
    if(panel) panel.addEventListener('click', function(e){ e.stopPropagation(); });
  }
  function mountEmbedded(containerId){
    const el = document.getElementById(containerId);
    if(!el) return;
    createWidget(el, { closable:false });
  }

  return { init:init, toggleFloating:toggleFloating, mountEmbedded:mountEmbedded, answerFor:answerFor };
})();

/* =====================================================================================================
   INICIALIZACIÓN DE LA APLICACIÓN
   ===================================================================================================== */
document.addEventListener('DOMContentLoaded', function(){
  /* Iconos estáticos de la plantilla */
  document.getElementById('btnMenu').innerHTML = icon('menu','w-4 h-4');
  document.getElementById('sbCloseBtn').innerHTML = icon('x','w-4 h-4');
  document.getElementById('sbLogoutBtn').innerHTML = icon('logout','w-4 h-4');
  document.getElementById('btnResetIcon').innerHTML = icon('refresh','w-3.5 h-3.5');
  document.getElementById('btnNewSaleIcon').innerHTML = icon('plus','w-3.5 h-3.5');

  /* 1) Cargar / inicializar la "base de datos" local (localStorage · falabella_demo_v1) */
  DB = loadState();
  if(!DB){ DB = seedState(); save(); }

  /* 2) Chatbot: se inicializa SIN interferir con la pantalla de login (solo bindea su propio FAB) */
  Chatbot.init();

  /* 3) Restaurar sesión previa (sessionStorage) */
  session = restoreSession();
  if(session){ enterApp(); }
});
</script>
</body>
</html>
