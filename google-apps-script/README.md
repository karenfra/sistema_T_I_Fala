# 📧 Guía de Conexión: Google Apps Script para Envío de Correos Reales (Falabella)

Esta guía explica paso a paso cómo conectar **Google Apps Script** con el Sistema de Ventas Falabella para enviar comprobantes de venta reales de forma **100% gratuita** directamente a la bandeja de entrada de tus clientes utilizando tu cuenta de **Gmail**.

---

## 🚀 Pasos de Configuración (Solo se hace una vez - 2 minutos)

### Paso 1: Abrir Google Apps Script
1. Abre tu navegador e ingresa a: **[https://script.google.com](https://script.google.com)** con tu cuenta de Google.
2. Haz clic en el botón superior izquierdo: **`+ Nuevo proyecto`** (New project).

---

### Paso 2: Pegar el Código
1. En el editor que se abre, borra la función vacía `function myFunction() {}`.
2. Abre el archivo [`Codigo.gs`](./Codigo.gs), copia todo su contenido y pégalo en el editor de Google Apps Script.
3. Arriba a la izquierda, cámbiale el nombre al proyecto (por ejemplo: `Falabella Correo Comprobantes`) y haz clic en el icono de guardar (**💾**).

---

### Paso 3: Publicar como Aplicación Web (Web App)
1. En la esquina superior derecha, haz clic en el botón azul **`Implementar`** (Deploy) y selecciona **`Nueva implementación`** (New deployment).
2. En la ventana emergente, haz clic en el icono de engranaje (**⚙️**) a la izquierda de "Seleccionar tipo" y elige **`Aplicación web`** (Web app).
3. Configura exactamente los siguientes campos:
   - **Descripción**: `Servicio de correos Falabella`
   - **Ejecutar como (Execute as)**: `Yo (tu_correo@gmail.com)`
   - **Quién tiene acceso (Who has access)**: **`Cualquier persona`** *(Anyone)*  
     *(⚠️ Es indispensable seleccionar "Cualquier persona" para que tu página web de GitHub Pages pueda comunicarse con el script sin bloqueos).*
4. Haz clic en el botón azul **`Implementar`** (Deploy).

---

### Paso 4: Autorizar Permisos de Google
1. Google te solicitará autorizar el acceso: haz clic en **`Revisar permisos`** (Review permissions).
2. Selecciona tu cuenta de Google.
3. Si Google muestra una pantalla diciendo *"Google no ha verificado esta app"*, no te preocupes (es tu propio script):
   - Haz clic en el enlace pequeño **`Avanzado`** (Advanced).
   - Haz clic en **`Ir a Falabella Correo Comprobantes (no seguro)`**.
   - Presiona **`Permitir`** (Allow).

---

### Paso 5: Copiar la URL y Pegarla en el Sistema
1. Copia la **URL de la aplicación web** generada.  
   *(Tendrá un formato similar a: `https://script.google.com/macros/s/AKfycbx.../exec` — debe terminar en `/exec`)*.
2. Abre tu Sistema de Ventas Falabella:
   - En la barra superior, haz clic en el botón **`⚙️ Correo Gmail`** (o en la sección de Ventas al hacer clic en **`Enviar por correo`**).
   - Pega tu URL en el campo y haz clic en **`Guardar URL`**.
   - Opcional: Presiona **`Enviar correo de prueba`** para enviarte un correo de test instantáneo a tu propio Gmail y verificar que todo funciona.

---

## 🎯 ¡Listo!
A partir de ahora, cada vez que presiones **`Enviar por correo`** en cualquier comprobante de venta, el sistema enviará un correo HTML estilizado con el logotipo de Falabella, la lista de productos comprados, el total y el número de comprobante directamente a la bandeja de entrada del cliente.
