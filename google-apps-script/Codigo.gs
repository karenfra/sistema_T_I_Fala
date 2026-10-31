/**
 * ============================================================================
 * SISTEMA DE VENTAS FALABELLA - SERVICIO DE ENVÍO DE COMPROBANTES POR CORREO
 * Google Apps Script (Web App)
 * ============================================================================
 * 
 * Este script se publica como una Aplicación Web en Google Apps Script para
 * enviar correos electrónicos reales 100% gratuitos a través de Gmail.
 * 
 * PASOS DE INSTALACIÓN:
 * 1. Ingresa a https://script.google.com con tu cuenta de Google.
 * 2. Haz clic en "Nuevo proyecto" (New project).
 * 3. Borra el código por defecto y pega todo el contenido de este archivo.
 * 4. Nombra el proyecto como: "Falabella Correo Comprobantes".
 * 5. Haz clic en el botón azul "Implementar" (Deploy) > "Nueva implementación" (New deployment).
 * 6. En el icono de engranaje (⚙️), selecciona el tipo "Aplicación web" (Web app).
 * 7. Configura los siguientes campos:
 *    - Descripción: Servicio de correos Falabella
 *    - Ejecutar como (Execute as): "Yo" (tu cuenta de Google)
 *    - Quién tiene acceso (Who has access): "Cualquier persona" (Anyone)  <--- ¡MUY IMPORTANTE!
 * 8. Haz clic en "Implementar" (Deploy).
 * 9. Autoriza los permisos de Google:
 *    - Haz clic en "Revisar permisos" (Review Permissions).
 *    - Elige tu cuenta de Google.
 *    - Si Google muestra una advertencia de verificación, haz clic en "Avanzado" (Advanced)
 *      y luego en "Ir a Falabella Correo Comprobantes (no seguro)".
 *    - Haz clic en "Permitir" (Allow).
 * 10. Copia la "URL de la aplicación web" (la que termina en /exec).
 * 11. Pega esa URL en el Sistema de Ventas Falabella (en el botón "⚙️ Correo Gmail" o al enviar comprobante).
 * ============================================================================
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Servicio de correo de Sistema de Ventas Falabella operativo.",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var rawData = e && e.postData && e.postData.contents ? e.postData.contents : null;
    if (!rawData) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "No se recibieron datos en la solicitud POST."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(rawData);
    var toEmail = data.to;
    var subject = data.subject || ("Comprobante de Pago " + (data.receiptCode || data.saleCode || "") + " - Falabella");
    var htmlContent = data.htmlBody || buildDefaultReceiptHtml(data);

    if (!toEmail) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "El campo destinatario 'to' es obligatorio."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Envío del correo usando la API de Gmail
    GmailApp.sendEmail(toEmail, subject, "Se adjunta su comprobante de pago de Falabella.", {
      htmlBody: htmlContent,
      name: "Falabella - Comprobante Electrónico"
    });

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Correo enviado exitosamente a " + toEmail,
      sentAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Genera una plantilla HTML profesional y responsive estilo comprobante Falabella
 */
function buildDefaultReceiptHtml(data) {
  var itemsHtml = "";
  if (data.items && data.items.length) {
    for (var i = 0; i < data.items.length; i++) {
      var it = data.items[i];
      itemsHtml += '<tr>' +
        '<td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">' +
          '<strong>' + (it.name || '-') + '</strong>' +
          (it.code ? '<div style="font-size: 11px; color: #64748b;">Cód: ' + it.code + '</div>' : '') +
        '</td>' +
        '<td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px; color: #1e293b;">' + (it.qty || 1) + '</td>' +
        '<td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; color: #1e293b;">S/ ' + Number(it.unitPrice || 0).toFixed(2) + '</td>' +
        '<td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-weight: bold; color: #1e293b;">S/ ' + Number(it.subtotal || 0).toFixed(2) + '</td>' +
      '</tr>';
    }
  }

  return '<!DOCTYPE html>' +
  '<html>' +
  '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
  '<body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px; margin: 0;">' +
    '<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">' +
      // Encabezado institucional Falabella
      '<tr>' +
        '<td style="background-color: #008542; padding: 24px 32px; text-align: center;">' +
          '<h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">falabella</h1>' +
          '<p style="color: #dcfce7; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px;">Comprobante de Pago Electrónico</p>' +
        '</td>' +
      '</tr>' +
      // Cuerpo del comprobante
      '<tr>' +
        '<td style="padding: 24px 32px;">' +
          '<div style="text-align: center; margin-bottom: 20px;">' +
            '<span style="background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 14px; font-weight: bold; padding: 6px 14px; border-radius: 20px; font-family: monospace;">' +
              (data.receiptCode || 'COMPROBANTE ELECTRÓNICO') +
            '</span>' +
          '</div>' +
          '<p style="color: #334155; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">Estimado(a) <strong>' + (data.customerName || 'Cliente') + '</strong>,<br>Gracias por tu compra en Falabella. A continuación te presentamos el resumen oficial de tu comprobante:</p>' +
          // Tabla de metadatos
          '<table width="100%" cellpadding="6" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px; margin-bottom: 20px;">' +
            '<tr><td style="color: #64748b;">Nº de Venta:</td><td><strong>' + (data.saleCode || '-') + '</strong></td>' +
            '<td style="color: #64748b;">Fecha:</td><td><strong>' + (data.date || '-') + '</strong></td></tr>' +
            '<tr><td style="color: #64748b;">DNI Cliente:</td><td><strong>' + (data.customerDni || '-') + '</strong></td>' +
            '<td style="color: #64748b;">Método de Pago:</td><td><strong>' + (data.paymentMethod || 'Tarjeta/Efectivo') + '</strong></td></tr>' +
            (data.seller ? '<tr><td style="color: #64748b;">Atendido por:</td><td colspan="3"><strong>' + data.seller + '</strong></td></tr>' : '') +
          '</table>' +
          // Tabla de artículos
          '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border-collapse: collapse;">' +
            '<thead>' +
              '<tr style="background-color: #f1f5f9; text-transform: uppercase; font-size: 11px; color: #475569;">' +
                '<th style="padding: 8px; text-align: left;">Producto</th>' +
                '<th style="padding: 8px; text-align: center;">Cant.</th>' +
                '<th style="padding: 8px; text-align: right;">P. Unit.</th>' +
                '<th style="padding: 8px; text-align: right;">Total</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              itemsHtml +
            '</tbody>' +
          '</table>' +
          // Totales
          '<table width="100%" cellpadding="4" cellspacing="0" style="font-size: 13px; margin-bottom: 24px;">' +
            (data.subtotal ? '<tr><td style="text-align: right; color: #64748b;">Subtotal:</td><td style="text-align: right; width: 120px;">S/ ' + Number(data.subtotal).toFixed(2) + '</td></tr>' : '') +
            (data.discount ? '<tr><td style="text-align: right; color: #dc2626;">Descuento:</td><td style="text-align: right; width: 120px; color: #dc2626;">-S/ ' + Number(data.discount).toFixed(2) + '</td></tr>' : '') +
            '<tr><td style="text-align: right; font-size: 16px; font-weight: bold; color: #008542; padding-top: 8px; border-top: 2px solid #e2e8f0;">TOTAL PAGADO:</td>' +
            '<td style="text-align: right; font-size: 18px; font-weight: 900; color: #008542; padding-top: 8px; border-top: 2px solid #e2e8f0;">S/ ' + Number(data.total || 0).toFixed(2) + '</td></tr>' +
          '</table>' +
          // Pie del correo
          '<div style="text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 16px;">' +
            '<p style="margin: 0; font-size: 12px; color: #64748b;">Conserva este comprobante para cualquier consulta, cambio o seguimiento de pedido.</p>' +
            '<p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">Sistema de Ventas Falabella · Documento digital emitido conforme a ley</p>' +
          '</div>' +
        '</td>' +
      '</tr>' +
    '</table>' +
  '</body>' +
  '</html>';
}
