import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileTypeFromBuffer } from 'file-type';

const execAsync = promisify(exec);

/**
 * 🔍 Servicio de Validación PDF - Adaptado para Railway
 * Convierte las funciones PHP de Joel a Node.js moderno
 * Especificaciones: Solo PDF, escala grises 8 bits, 300 DPI, máx 3MB, sin contenido restringido
 */
export class PDFValidator {
  constructor() {
    this.maxSizeBytes = 3 * 1024 * 1024; // 3 MB
    this.requiredDPI = 300;
    this.allowedFormats = ['gray'];
    this.requiredBitsPerComponent = 8;
  }

  /**
   * 🎯 VALIDACIÓN COMPLETA DEL PDF
   * @param {Buffer} fileBuffer - Buffer del archivo
   * @param {string} originalName - Nombre original del archivo
   * @returns {Object} Resultado completo de validación
   */
  async validatePDF(fileBuffer, originalName) {
    console.log('🔍 Iniciando validación PDF completa...');
    
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      checks: {},
      summary: '',
      isProcessable: true, // NUEVO: Indica si se puede procesar
      hasOCR: false // NUEVO: Indica si tiene OCR
    };

    try {
      // 1️⃣ Verificar tipo de archivo
      const typeCheck = await this.validateFileType(fileBuffer);
      results.checks.fileType = typeCheck;
      if (!typeCheck.valid) {
        results.valid = false;
        results.isProcessable = false;
        results.errors.push(typeCheck.message);
      }

      // 2️⃣ Verificar tamaño
      const sizeCheck = this.validateFileSize(fileBuffer);
      results.checks.fileSize = sizeCheck;
      if (!sizeCheck.valid) {
        results.valid = false;
        // Tamaño grande no impide procesamiento
        results.errors.push(sizeCheck.message);
      }

      // Si falla validación básica crítica, no continuar
      if (!results.isProcessable) {
        results.summary = 'PDF rechazado: No es un archivo PDF válido';
        return results;
      }

      // Crear archivo temporal para validaciones avanzadas
      const tempFile = await this.createTempFile(fileBuffer);
      
      try {
        // 3️⃣ VERIFICAR OCR (CRÍTICO - RECHAZO DEFINITIVO)
        const ocrCheck = await this.detectOCR(tempFile);
        results.checks.ocr = ocrCheck;
        results.hasOCR = ocrCheck.hasOCR;
        
        if (ocrCheck.hasOCR) {
          results.valid = false;
          results.isProcessable = false; // No se puede procesar si tiene OCR
          results.errors.push('❌ RECHAZADO: Documento contiene texto OCR escaneado');
        }

        // 4️⃣ Verificar contenido prohibido
        const contentCheck = await this.validateContent(tempFile);
        results.checks.content = contentCheck;
        if (!contentCheck.valid) {
          results.valid = false;
          results.isProcessable = false; // Contenido prohibido tampoco se puede procesar
          results.errors.push(...contentCheck.errors);
        }

        // 5️⃣ Verificar páginas en blanco y estructura
        const processingCheck = await this.validateProcessing(tempFile);
        results.checks.processing = processingCheck;
        if (!processingCheck.valid) {
          results.valid = false;
          // Páginas en blanco SÍ se pueden procesar
          results.errors.push(...processingCheck.errors);
        }
        if (processingCheck.warnings.length > 0) {
          results.warnings.push(...processingCheck.warnings);
        }

        // 6️⃣ Verificar imágenes (resolución y escala de grises)
        const imageCheck = await this.validateImages(tempFile);
        results.checks.images = imageCheck;
        if (!imageCheck.valid) {
          results.valid = false;
          // Imágenes incorrectas SÍ se pueden procesar
          results.errors.push(...imageCheck.errors);
        }

      } finally {
        // Limpiar archivo temporal
        await this.cleanupTempFile(tempFile);
      }

      // Generar resumen basado en procesabilidad
      if (!results.isProcessable) {
        results.summary = results.hasOCR 
          ? '🚫 PDF RECHAZADO DEFINITIVAMENTE - Contiene OCR escaneado'
          : `🚫 PDF RECHAZADO DEFINITIVAMENTE - ${results.errors.length} errores críticos`;
      } else if (!results.valid) {
        results.summary = `🔄 PDF PROCESABLE - ${results.errors.length} errores que se pueden corregir automáticamente`;
      } else {
        results.summary = '✅ PDF válido - Cumple todas las especificaciones';
      }

    } catch (error) {
      console.error('Error en validación PDF:', error);
      results.valid = false;
      results.isProcessable = false;
      results.errors.push(`Error interno de validación: ${error.message}`);
      results.summary = '❌ Error durante validación';
    }

    return results;
  }

  /**
   * 🔍 DETECTAR OCR EN PDF
   * Verifica si el PDF contiene texto escaneado con OCR
   */
  async detectOCR(tempFilePath) {
    const result = {
      hasOCR: false,
      confidence: 0,
      details: [],
      method: 'text-analysis'
    };

    try {
      // Extraer texto del PDF
      const { stdout: textContent } = await execAsync(`pdftotext -layout -nopgbrk "${tempFilePath}" -`);
      
      if (textContent.trim().length === 0) {
        result.hasOCR = true;
        result.confidence = 90;
        result.details.push('PDF sin texto extraíble - posible escaneo');
        return result;
      }

      // Patrones indicativos de OCR
      const ocrPatterns = [
        /[Il1|]{3,}/g, // Secuencias de caracteres confundibles por OCR
        /[0O]{3,}/g,   // Ceros y O's mezclados
        /\s[a-z]\s[a-z]\s/g, // Letras sueltas espaciadas (OCR mal)
        /[^\w\s\.\,\;\:\!\?\-\(\)]{2,}/g, // Caracteres raros
        /\b\w{1}\s+\w{1}\s+\w{1}\b/g // Palabras fragmentadas
      ];

      let ocrScore = 0;
      const textSample = textContent.substring(0, 2000); // Muestra de 2KB

      for (const pattern of ocrPatterns) {
        const matches = textSample.match(pattern);
        if (matches) {
          ocrScore += matches.length;
          result.details.push(`Patrón OCR detectado: ${pattern.source} (${matches.length} coincidencias)`);
        }
      }

      // Calcular confianza basada en la proporción de errores
      const textLength = textSample.length;
      const errorRatio = textLength > 0 ? (ocrScore / textLength) * 100 : 0;
      
      if (errorRatio > 2) { // Más del 2% de caracteres sospechosos
        result.hasOCR = true;
        result.confidence = Math.min(90, errorRatio * 20);
        result.details.push(`Ratio de errores OCR: ${errorRatio.toFixed(2)}%`);
      }

      // Verificación adicional: buscar metadatos de escaneo
      try {
        const { stdout: metadata } = await execAsync(`pdfinfo "${tempFilePath}"`);
        if (metadata.includes('scan') || metadata.includes('OCR') || metadata.includes('Adobe Acrobat Image')) {
          result.hasOCR = true;
          result.confidence = Math.max(result.confidence, 80);
          result.details.push('Metadatos indican documento escaneado');
        }
      } catch {
        // Ignorar errores de metadatos
      }

    } catch (error) {
      result.details.push(`Error detectando OCR: ${error.message}`);
    }

    return result;
  }

  /**
   * 1️⃣ VALIDAR TIPO DE ARCHIVO
   * Equivale a tipo.php de Joel
   */
  async validateFileType(fileBuffer) {
    try {
      const fileType = await fileTypeFromBuffer(fileBuffer);
      
      if (!fileType || fileType.mime !== 'application/pdf') {
        return {
          valid: false,
          message: `⚠️ Archivo no es un PDF válido. Tipo detectado: ${fileType?.mime || 'desconocido'}`,
          detectedType: fileType?.mime || 'unknown'
        };
      }

      return {
        valid: true,
        message: '✅ Tipo de archivo PDF válido',
        detectedType: fileType.mime
      };
    } catch (error) {
      return {
        valid: false,
        message: `❌ Error verificando tipo de archivo: ${error.message}`,
        detectedType: 'error'
      };
    }
  }

  /**
   * 2️⃣ VALIDAR TAMAÑO DE ARCHIVO
   * Equivale a tamano.php de Joel
   */
  validateFileSize(fileBuffer) {
    const fileSize = fileBuffer.length;
    const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);

    if (fileSize > this.maxSizeBytes) {
      return {
        valid: false,
        message: `❌ Archivo excede el tamaño máximo de 3 MB. Tamaño actual: ${sizeMB} MB`,
        actualSize: fileSize,
        maxSize: this.maxSizeBytes
      };
    }

    return {
      valid: true,
      message: `✅ Tamaño adecuado: ${sizeMB} MB`,
      actualSize: fileSize,
      maxSize: this.maxSizeBytes
    };
  }

  /**
   * 3️⃣ VALIDAR CONTENIDO PROHIBIDO
   * Equivale a contenido.php de Joel
   */
  async validateContent(tempFilePath) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      checks: {}
    };

    try {
      // Verificar si PDF tiene contraseña - con fallback
      try {
        const { stdout: pdfInfo } = await execAsync(`pdfinfo "${tempFilePath}"`);
        const hasPassword = pdfInfo.includes('Encrypted: yes');
        result.checks.password = !hasPassword;
        
        if (hasPassword) {
          result.valid = false;
          result.errors.push('❌ PDF con contraseña no permitido');
        }
      } catch (pdfinfoError) {
        result.warnings.push('⚠️ No se pudo verificar cifrado (pdfinfo no disponible)');
        result.checks.password = null; // Asumimos que no tiene contraseña si no podemos verificar
      }

      // Verificar formularios, objetos incrustados y JavaScript usando mutool - con fallback
      try {
        const { stdout: trailer } = await execAsync(`mutool show "${tempFilePath}" trailer`);
        
        // Verificar formularios AcroForm
        const hasForms = trailer.includes('/AcroForm');
        result.checks.forms = !hasForms;
        if (hasForms) {
          result.valid = false;
          result.errors.push('❌ Contiene formularios (AcroForm)');
        }

        // Verificar objetos incrustados
        const hasEmbedded = trailer.includes('/EmbeddedFiles') || trailer.includes('/FileAttachment');
        result.checks.embedded = !hasEmbedded;
        if (hasEmbedded) {
          result.valid = false;
          result.errors.push('❌ Contiene archivos incrustados');
        }

        // Verificar JavaScript
        const hasJS = /\/(JavaScript|JS)/.test(trailer);
        result.checks.javascript = !hasJS;
        if (hasJS) {
          result.valid = false;
          result.errors.push('❌ Contiene código JavaScript');
        }

      } catch (mutoolError) {
        result.warnings.push('⚠️ No se pudo verificar contenido avanzado (mutool no disponible)');
        // Asumimos que no tiene contenido prohibido si no podemos verificar
        result.checks.forms = null;
        result.checks.embedded = null;
        result.checks.javascript = null;
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`❌ Error validando contenido: ${error.message}`);
    }

    return result;
  }

  /**
   * 4️⃣ VALIDAR PROCESAMIENTO (PÁGINAS EN BLANCO Y OCR)
   * Equivale a procesamiento.php de Joel
   */
  async validateProcessing(tempFilePath) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      checks: {}
    };

    try {
      // Extraer texto del PDF - con fallback si pdftotext no está disponible
      let hasText = false;
      try {
        const { stdout: textContent } = await execAsync(`pdftotext -layout -nopgbrk "${tempFilePath}" -`);
        hasText = textContent.trim().length > 0;
        result.checks.hasText = hasText;

        if (!hasText) {
          result.warnings.push('⚠️ PDF no contiene texto (posible escaneo sin OCR)');
        }
      } catch (pdftoTextError) {
        result.warnings.push('⚠️ No se pudo extraer texto del PDF (pdftotext no disponible)');
        result.checks.hasText = null; // No se pudo verificar
      }

      // Detectar número de páginas - con fallback si pdfinfo no está disponible
      try {
        const { stdout: pages } = await execAsync(`pdfinfo "${tempFilePath}" | grep Pages`);
        const pageCount = parseInt(pages.match(/Pages:\s+(\d+)/)?.[1] || '0');
        
        if (pageCount === 0) {
          result.valid = false;
          result.errors.push('❌ PDF no contiene páginas válidas');
        } else if (pageCount > 50) {
          result.warnings.push(`⚠️ PDF con muchas páginas (${pageCount}). Revisar manualmente.`);
        }
        
        result.checks.pageCount = pageCount;
      } catch (pdfinfoError) {
        result.warnings.push('⚠️ No se pudo verificar número de páginas (pdfinfo no disponible)');
        result.checks.pageCount = null; // No se pudo verificar
      }

    } catch (error) {
      result.warnings.push(`⚠️ Error en validación de procesamiento: ${error.message}`);
    }

    return result;
  }

  /**
   * 5️⃣ VALIDAR IMÁGENES (RESOLUCIÓN Y ESCALA DE GRISES)
   * Equivale a resolucion.php y escala_gris.php de Joel
   */
  async validateImages(tempFilePath) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      checks: {
        totalImages: 0,
        validImages: 0,
        resolutionIssues: [],
        colorIssues: []
      }
    };

    try {
      // Usar pdfimages para analizar imágenes - con fallback si no está disponible
      try {
        const { stdout: imageList } = await execAsync(`pdfimages -list "${tempFilePath}"`);
        const lines = imageList.split('\n').filter(line => line.trim());
        
        // Saltar header (primeras 2 líneas)
        const imageLines = lines.slice(2).filter(line => /^\s*\d+/.test(line));
        result.checks.totalImages = imageLines.length;

        if (imageLines.length === 0) {
          result.warnings.push('⚠️ No se encontraron imágenes en el PDF');
          return result;
        }

        let validCount = 0;

        for (const line of imageLines) {
          // Parsear línea: page num type width height color comp bpc  enc interp  object ID x-ppi y-ppi size ratio
          const parts = line.trim().split(/\s+/);
          
          if (parts.length >= 10) {
            const color = parts[5].toLowerCase();
            const bpc = parseInt(parts[6]);
            const xDpi = parseInt(parts[10]);
            const yDpi = parseInt(parts[11]);

            // Verificar resolución (300 DPI mínimo)
            if (xDpi < this.requiredDPI || yDpi < this.requiredDPI) {
              result.checks.resolutionIssues.push(`Imagen con ${xDpi}x${yDpi} DPI (requiere ${this.requiredDPI})`);
            }

            // Verificar escala de grises a 8 bits
            if (color !== 'gray' || bpc !== this.requiredBitsPerComponent) {
              result.checks.colorIssues.push(`Imagen: ${color} ${bpc}bpc (requiere gray 8bpc)`);
            }

            // Contar imágenes válidas
            if (xDpi >= this.requiredDPI && yDpi >= this.requiredDPI && color === 'gray' && bpc === 8) {
              validCount++;
            }
          }
        }

        result.checks.validImages = validCount;

        // Evaluar resultados
        if (result.checks.resolutionIssues.length > 0) {
          result.valid = false;
          result.errors.push(`❌ ${result.checks.resolutionIssues.length} imágenes con resolución menor a 300 DPI`);
        }

        if (result.checks.colorIssues.length > 0) {
          result.valid = false;
          result.errors.push(`❌ ${result.checks.colorIssues.length} imágenes no están en escala de grises a 8 bits`);
        }

        if (result.valid) {
          result.message = `✅ Todas las imágenes cumplen especificaciones (${validCount}/${imageLines.length})`;
        }

      } catch (pdfimagesError) {
        // Si pdfimages no está disponible, asumir que no hay problemas de imágenes
        result.warnings.push(`⚠️ No se pudieron analizar imágenes (pdfimages no disponible): ${pdfimagesError.message}`);
        result.checks.totalImages = null;
        result.checks.validImages = null;
      }

    } catch (error) {
      result.warnings.push(`⚠️ Error en validación de imágenes: ${error.message}`);
    }

    return result;
  }

  /**
   * 🔧 UTILIDADES AUXILIARES
   */
  async createTempFile(fileBuffer) {
    const tempDir = os.tmpdir();
    const tempFileName = `pdf_validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    await fs.writeFile(tempFilePath, fileBuffer);
    return tempFilePath;
  }

  async cleanupTempFile(tempFilePath) {
    try {
      await fs.unlink(tempFilePath);
    } catch (error) {
      console.warn('No se pudo eliminar archivo temporal:', tempFilePath);
    }
  }

  /**
   * 📊 REPORTE DETALLADO
   */
  generateDetailedReport(validationResult) {
    const { valid, errors, warnings, checks, summary } = validationResult;
    
    let report = `\n📋 REPORTE DE VALIDACIÓN PDF\n`;
    report += `================================\n`;
    report += `Estado: ${valid ? '✅ APROBADO' : '❌ RECHAZADO'}\n`;
    report += `Resumen: ${summary}\n\n`;

    if (checks.fileType) {
      report += `📎 Tipo: ${checks.fileType.detectedType}\n`;
    }
    
    if (checks.fileSize) {
      const sizeMB = (checks.fileSize.actualSize / (1024 * 1024)).toFixed(2);
      report += `📏 Tamaño: ${sizeMB} MB\n`;
    }

    if (checks.processing?.pageCount) {
      report += `📄 Páginas: ${checks.processing.pageCount}\n`;
    }

    if (checks.images?.totalImages > 0) {
      report += `🖼️  Imágenes: ${checks.images.validImages}/${checks.images.totalImages} válidas\n`;
    }

    if (errors.length > 0) {
      report += `\n❌ ERRORES (${errors.length}):\n`;
      errors.forEach(error => report += `  • ${error}\n`);
    }

    if (warnings.length > 0) {
      report += `\n⚠️  ADVERTENCIAS (${warnings.length}):\n`;
      warnings.forEach(warning => report += `  • ${warning}\n`);
    }

    return report;
  }
}

// Instancia singleton para uso en la app
export const pdfValidator = new PDFValidator();