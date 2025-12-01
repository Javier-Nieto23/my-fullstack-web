import { Resend } from 'resend'

class EmailService {
  constructor() {
    // Debug: verificar variables de entorno
    console.log('🔍 [EmailService] Inicializando servicio de email')
    console.log('🔍 [EmailService] RESEND_API_KEY:', process.env.RESEND_API_KEY ? `Configurada (${process.env.RESEND_API_KEY.substring(0, 8)}...)` : 'NO CONFIGURADA')
    console.log('🔍 [EmailService] RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || 'NO CONFIGURADA')
    
    this.resend = new Resend(process.env.RESEND_API_KEY)
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    console.log('🔍 [EmailService] FROM efectivo (usado en envío):', this.fromEmail)
  }

  /**
   * Verificar si el servicio está configurado correctamente
   * @returns {boolean}
   */
  isConfigured() {
    // Solo requerimos la API KEY, el email tiene fallback
    return !!process.env.RESEND_API_KEY
  }

  /**
   * Enviar PDF por correo electrónico
   * @param {Object} params - Parámetros del correo
   * @param {string} params.to - Email del destinatario
   * @param {string} params.documentName - Nombre del documento
   * @param {Buffer} params.pdfBuffer - Buffer del PDF
   * @param {string} params.userName - Nombre del usuario (opcional)
   * @returns {Promise<Object>}
   */
  async sendPdf({ to, documentName, pdfBuffer, userName = 'Usuario' }) {
    try {
      if (!this.isConfigured()) {
        throw new Error('Servicio de email no configurado. Verifica RESEND_API_KEY y RESEND_FROM_EMAIL')
      }

      console.log(`📧 [Email] Enviando PDF a: ${to}`)
      console.log(`📄 [Email] Documento: ${documentName}`)
      console.log(`📊 [Email] Tamaño: ${(pdfBuffer.length / 1024).toFixed(2)} KB`)

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject: `Tu documento: ${documentName}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Tu documento está listo!</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">📄 Documento Listo</h1>
              </div>
              
              <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${userName}</strong>,</p>
                
                <p style="font-size: 16px; margin-bottom: 20px;">
                  Tu documento <strong style="color: #667eea;">${documentName}</strong> ha sido procesado exitosamente y está adjunto a este correo.
                </p>

                <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px;">
                    <strong>📎 Archivo adjunto:</strong> ${documentName}<br>
                    <strong>📊 Tamaño:</strong> ${(pdfBuffer.length / 1024).toFixed(2)} KB<br>
                    <strong>📅 Fecha:</strong> ${new Date().toLocaleString(undefined, { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })} (hora local del servidor)
                  </p>
                </div>

                <p style="font-size: 14px; color: #666; margin-top: 30px;">
                  Este correo fue generado automáticamente por el Portal de Carga de Información de CAAST.
                </p>
              </div>

              <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                <p>© ${new Date().getFullYear()} ©CAAST — Todos los derechos reservados</p>
              </div>
            </body>
          </html>
        `,
        attachments: [
          {
            filename: documentName,
            content: pdfBuffer
          }
        ]
      })

      if (error) {
        console.error('❌ [Email] Error de Resend:', error)
        throw new Error(`Error al enviar correo: ${error.message}`)
      }

      console.log('✅ [Email] Correo enviado exitosamente')
      console.log('📧 [Email] ID:', data.id)

      return {
        success: true,
        messageId: data.id,
        recipient: to
      }

    } catch (error) {
      console.error('❌ [Email] Error enviando correo:', error)
      throw error
    }
  }

  /**
   * Enviar correo de notificación (sin adjunto)
   * @param {Object} params - Parámetros del correo
   * @param {string} params.to - Email del destinatario
   * @param {string} params.subject - Asunto del correo
   * @param {string} params.message - Mensaje del correo
   * @returns {Promise<Object>}
   */
  async sendNotification({ to, subject, message }) {
    try {
      if (!this.isConfigured()) {
        throw new Error('Servicio de email no configurado')
      }

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #667eea;">${subject}</h2>
                <p>${message}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">
                  © ${new Date().getFullYear()} SEER Tráfico S.C.
                </p>
              </div>
            </body>
          </html>
        `
      })

      if (error) {
        throw new Error(`Error al enviar correo: ${error.message}`)
      }

      return {
        success: true,
        messageId: data.id
      }

    } catch (error) {
      console.error('Error enviando notificación:', error)
      throw error
    }
  }
}

// Singleton instance
export const emailService = new EmailService()
export default emailService
