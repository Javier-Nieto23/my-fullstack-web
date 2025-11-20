import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'

class CloudflareR2Service {
  constructor() {
    this.client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
      }
    })
    
    this.bucketName = process.env.R2_BUCKET_NAME || 'pdf-storage'
    this.customDomain = process.env.R2_CUSTOM_DOMAIN // Opcional: dominio personalizado
  }

  /**
   * Subir archivo PDF a Cloudflare R2
   * @param {Buffer} fileBuffer - Buffer del archivo
   * @param {string} fileName - Nombre original del archivo
   * @param {string} mimeType - Tipo MIME del archivo
   * @returns {Promise<{key: string, url: string}>}
   */
  async uploadFile(fileBuffer, fileName, mimeType = 'application/pdf') {
    console.log(`🌩️ [R2] Iniciando subida: ${fileName} (${(fileBuffer.length / 1024).toFixed(2)} KB)`);
    
    try {
      // Verificar configuración
      if (!this.isConfigured()) {
        throw new Error('Cloudflare R2 no está configurado correctamente');
      }

      // Generar key único para el archivo
      const fileExtension = fileName.split('.').pop()
      const uniqueId = crypto.randomUUID()
      const timestamp = Date.now()
      const key = `pdfs/${timestamp}-${uniqueId}.${fileExtension}`

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        Metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString()
        }
      })

      await this.client.send(command)
      
      console.log(`✅ [R2] Archivo subido exitosamente: ${key}`);

      // URL pública (si tienes dominio personalizado configurado)
      const publicUrl = this.customDomain 
        ? `https://${this.customDomain}/${key}`
        : await this.getSignedViewUrl(key)

      console.log(`🔗 [R2] URL generada: ${publicUrl ? 'OK' : 'ERROR'}`);

      return {
        key,
        url: publicUrl,
        success: true
      }
    } catch (error) {
      console.error('❌ [R2] Error uploading to R2:', error)
      throw new Error(`Error al subir archivo: ${error.message}`)
    }
  }

  /**
   * Obtener URL firmada para visualizar archivo
   * @param {string} key - Key del archivo en R2
   * @param {number} expiresIn - Tiempo de expiración en segundos (default: 1 hora)
   * @returns {Promise<string>}
   */
  async getSignedViewUrl(key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      })

      const signedUrl = await getSignedUrl(this.client, command, { 
        expiresIn,
        // Headers para visualización en browser
        ResponseContentDisposition: 'inline'
      })

      return signedUrl
    } catch (error) {
      console.error('Error generating signed URL:', error)
      throw new Error(`Error al generar URL: ${error.message}`)
    }
  }

  /**
   * Obtener URL firmada para descargar archivo
   * @param {string} key - Key del archivo en R2
   * @param {string} fileName - Nombre para descarga
   * @param {number} expiresIn - Tiempo de expiración en segundos (default: 1 hora)
   * @returns {Promise<string>}
   */
  async getSignedDownloadUrl(key, fileName, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${fileName}"`
      })

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn })
      return signedUrl
    } catch (error) {
      console.error('Error generating download URL:', error)
      throw new Error(`Error al generar URL de descarga: ${error.message}`)
    }
  }

  /**
   * Eliminar archivo de R2
   * @param {string} key - Key del archivo en R2
   * @returns {Promise<boolean>}
   */
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      })

      await this.client.send(command)
      return true
    } catch (error) {
      console.error('Error deleting from R2:', error)
      throw new Error(`Error al eliminar archivo: ${error.message}`)
    }
  }

  /**
   * Verificar si el servicio está configurado correctamente
   * @returns {boolean}
   */
  isConfigured() {
    return !!(
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_BUCKET_NAME
    )
  }
}

// Singleton instance
export const r2Service = new CloudflareR2Service()
export default r2Service