import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * 🎯 VALIDADOR PDF PROFESIONAL
 * 
 * Herramientas integradas:
 * ✅ Ghostscript - Conversión y análisis profesional
 * ✅ Poppler-utils (pdfinfo, pdfimages) - Análisis detallado
 * ✅ Mupdf-tools (mutool) - Verificación y extracción
 * 
 * Validaciones automáticas:
 * ✅ Detección de páginas en blanco (posible OCR)
 * ✅ Detección de código/JavaScript embebido
 * ✅ Validación DPI y formato de color
 * ✅ Verificación de estructura PDF
 */
class PDFValidator {
  constructor() {
    this.requiredDPI = 300;
    this.requiredColorMode = 'grayscale';
    this.requiredBitDepth = 8;
    this.maxSizeBytes = 3 * 1024 * 1024; // 3MB
    this.tempDir = '/tmp/pdf-validation';
  }

  /**
   * 🎯 VALIDACIÓN PRINCIPAL
   * Punto de entrada para todas las validaciones
   */
  async validatePDF(inputBuffer, filename = 'document.pdf') {
    console.log(`🔍 Iniciando validación completa: ${filename}`);

    const results = {
      filename,
      fileSize: inputBuffer.length,
      valid: false,
      isProcessable: false,
      hasOCR: false,
      hasJavaScript: false,
      hasBlankPages: false,
      errors: [],
      warnings: [],
      checks: {
        basicStructure: false,
        imageAnalysis: false,
        contentAnalysis: false,
        securityAnalysis: false
      },
      images: [],
      metadata: {},
      summary: ''
    };

    try {
      // Crear directorio temporal
      await this.ensureDirectoryExists(this.tempDir);
      
      const timestamp = Date.now();
      const tempFile = path.join(this.tempDir, `validate_${timestamp}.pdf`);

      // Escribir buffer a archivo temporal
      await fs.writeFile(tempFile, inputBuffer);

      // 🔍 VALIDACIÓN 1: Estructura básica del PDF
      await this.validateBasicStructure(tempFile, results);

      // 🔍 VALIDACIÓN 2: Análisis de imágenes y DPI
      await this.validateImages(tempFile, results);

      // 🔍 VALIDACIÓN 3: Detección de contenido problemático
      await this.validateContent(tempFile, results);

      // 🔍 VALIDACIÓN 4: Análisis de seguridad
      await this.validateSecurity(tempFile, results);

      // 🎯 EVALUACIÓN FINAL
      this.evaluateOverallValidation(results);

      // Limpiar archivo temporal
      await this.cleanupFiles([tempFile]);

      console.log(`✅ Validación completada: ${results.valid ? 'VÁLIDO' : 'NO VÁLIDO'}`);
      return results;

    } catch (error) {
      console.error('❌ Error en validación:', error);
      results.errors.push(`Error de validación: ${error.message}`);
      return results;
    }
  }

  /**
   * 🔍 VALIDACIÓN 1: Estructura básica del PDF
   */
  async validateBasicStructure(filePath, results) {
    console.log('🔍 Validando estructura básica...');

    try {
      // Usar pdfinfo para obtener metadatos básicos
      const { stdout } = await execAsync(`pdfinfo "${filePath}"`);
      
      const metadata = this.parsePdfInfo(stdout);
      results.metadata = metadata;

      // Verificaciones básicas
      if (!metadata.pages || metadata.pages === 0) {
        results.errors.push('PDF sin páginas válidas');
        return;
      }

      if (metadata.pages > 50) {
        results.warnings.push(`PDF tiene ${metadata.pages} páginas, podría ser muy grande`);
      }

      if (metadata.encrypted === 'yes') {
        results.errors.push('PDF está protegido con contraseña');
        return;
      }

      results.checks.basicStructure = true;
      console.log(`✅ Estructura básica válida: ${metadata.pages} páginas`);

    } catch (error) {
      console.error('❌ Error validando estructura:', error);
      results.errors.push('No es un PDF válido o está corrupto');
    }
  }

  /**
   * 🔍 VALIDACIÓN 2: Análisis de imágenes y DPI
   */
  async validateImages(filePath, results) {
    console.log('🔍 Analizando imágenes y DPI...');

    try {
      // Usar pdfimages para analizar todas las imágenes
      const { stdout } = await execAsync(`pdfimages -list "${filePath}"`);
      
      if (!stdout || stdout.trim().length === 0) {
        results.warnings.push('PDF no contiene imágenes detectables');
        results.checks.imageAnalysis = true;
        return;
      }

      const images = this.parsePdfImages(stdout);
      results.images = images;

      let hasLowDPI = false;
      let hasColorImages = false;
      let hasInvalidDepth = false;

      images.forEach((img, index) => {
        console.log(`📷 Imagen ${index + 1}: ${img.width}x${img.height} - DPI: x=${img.x_ppi}, y=${img.y_ppi} - Color: ${img.color}`);

        // Verificar DPI
        if (img.x_ppi < this.requiredDPI || img.y_ppi < this.requiredDPI) {
          hasLowDPI = true;
          results.warnings.push(`Imagen ${index + 1}: DPI bajo (${img.x_ppi}x${img.y_ppi})`);
        }

        // Verificar color
        if (img.color !== 'gray' && img.color !== 'mono') {
          hasColorImages = true;
          results.warnings.push(`Imagen ${index + 1}: No es escala de grises (${img.color})`);
        }

        // Verificar profundidad de bits
        if (img.color === 'gray' && img.bits !== '8') {
          hasInvalidDepth = true;
          results.warnings.push(`Imagen ${index + 1}: Profundidad incorrecta (${img.bits} bits)`);
        }
      });

      // Evaluación general
      if (hasLowDPI || hasColorImages || hasInvalidDepth) {
        results.warnings.push('PDF requiere procesamiento para cumplir especificaciones');
      } else {
        console.log('✅ Todas las imágenes cumplen especificaciones');
      }

      results.checks.imageAnalysis = true;

    } catch (error) {
      console.error('❌ Error analizando imágenes:', error);
      results.warnings.push('No se pudo analizar imágenes del PDF');
      results.checks.imageAnalysis = true; // No bloqueante
    }
  }

  /**
   * 🔍 VALIDACIÓN 3: Detección de contenido problemático
   */
  async validateContent(filePath, results) {
    console.log('🔍 Analizando contenido del PDF...');

    try {
      // 🔍 A) Detectar páginas en blanco (posible OCR)
      await this.detectBlankPages(filePath, results);

      // 🔍 B) Extraer y analizar texto
      await this.analyzeTextContent(filePath, results);

      // 🔍 C) Detectar elementos interactivos
      await this.detectInteractiveElements(filePath, results);

      results.checks.contentAnalysis = true;

    } catch (error) {
      console.error('❌ Error analizando contenido:', error);
      results.warnings.push('No se pudo analizar contenido del PDF');
      results.checks.contentAnalysis = true;
    }
  }

  /**
   * 🔍 VALIDACIÓN 4: Análisis de seguridad
   */
  async validateSecurity(filePath, results) {
    console.log('🔍 Analizando aspectos de seguridad...');

    try {
      // Usar mutool para análisis profundo
      const { stdout } = await execAsync(`mutool info "${filePath}"`);
      
      // Buscar JavaScript embebido
      if (stdout.toLowerCase().includes('javascript')) {
        results.hasJavaScript = true;
        results.errors.push('PDF contiene JavaScript embebido');
      }

      // Buscar formularios
      if (stdout.toLowerCase().includes('acroform') || stdout.toLowerCase().includes('form')) {
        results.warnings.push('PDF contiene formularios');
      }

      // Buscar enlaces externos
      if (stdout.toLowerCase().includes('uri') || stdout.toLowerCase().includes('link')) {
        results.warnings.push('PDF contiene enlaces externos');
      }

      results.checks.securityAnalysis = true;

    } catch (error) {
      console.error('❌ Error en análisis de seguridad:', error);
      results.warnings.push('No se pudo completar análisis de seguridad');
      results.checks.securityAnalysis = true;
    }
  }

  /**
   * 🔍 Detectar páginas en blanco (posible contenido OCR)
   */
  async detectBlankPages(filePath, results) {
    console.log('📝 Intentando extraer texto del PDF...');
    
    let textContent = '';
    let extractionMethod = 'none';
    let hasImages = false;

    // 🔄 Método 1: Intentar con pdftotext (más confiable)
    try {
      const { stdout } = await execAsync(`pdftotext "${filePath}" -`);
      textContent = stdout.trim();
      extractionMethod = 'pdftotext';
      console.log(`✅ Texto extraído con pdftotext (${textContent.length} caracteres)`);
    } catch (error) {
      console.log('⚠️ pdftotext no disponible, intentando con mutool...');
      
      // 🔄 Método 2: Intentar con mutool (método alternativo)
      try {
        const { stdout } = await execAsync(`mutool draw -F txt -o - "${filePath}"`);
        textContent = stdout.trim();
        extractionMethod = 'mutool-txt';
        console.log(`✅ Texto extraído con mutool-txt (${textContent.length} caracteres)`);
      } catch (mutoolError) {
        console.log('⚠️ mutool txt no disponible, usando análisis básico...');
        
        // 🔄 Método 3: Solo análisis básico sin extracción de texto
        try {
          const { stdout } = await execAsync(`pdfinfo "${filePath}"`);
          if (stdout.includes('Pages:')) {
            extractionMethod = 'basic-info';
            console.log('✅ Información básica del PDF disponible');
          }
        } catch (basicError) {
          console.log('❌ No se puede analizar el PDF con ningún método');
          results.warnings.push('No se pudo extraer información de texto del PDF');
          return;
        }
      }
    }

    // 🔍 Verificar si el PDF tiene imágenes
    try {
      const { stdout: imagesOutput } = await execAsync(`pdfimages -list "${filePath}"`);
      hasImages = imagesOutput && imagesOutput.trim().length > 0 && imagesOutput.includes('page');
      console.log(`📷 Verificación de imágenes: ${hasImages ? 'Tiene imágenes' : 'Sin imágenes detectadas'}`);
    } catch (error) {
      console.log('⚠️ No se pudo verificar imágenes en el PDF');
    }

    // 🚨 VALIDACIÓN CRÍTICA: PDF COMPLETAMENTE EN BLANCO
    const isCompletelyBlank = this.validateBlankPDF(textContent, hasImages, results.metadata.pages);
    
    if (isCompletelyBlank) {
      results.hasBlankPages = true;
      results.errors.push('No se permite PDF en blanco');
      console.log('❌ PDF RECHAZADO: Está completamente en blanco');
      return;
    }

    // 📊 Análizar contenido de texto si se obtuvo
    if (textContent.length > 0) {
      const pageCount = results.metadata.pages || 1;
      const avgTextPerPage = textContent.length / pageCount;

      console.log(`📊 Análisis de texto: ${textContent.length} caracteres total, ~${Math.round(avgTextPerPage)} por página`);

      // Si hay muy poco texto, podría ser OCR o páginas escaneadas
      if (avgTextPerPage < 50) {
        results.hasOCR = true;
        results.warnings.push('PDF parece contener páginas escaneadas o con poco texto (posible OCR)');
      }

      console.log(`✅ PDF contiene contenido válido (${textContent.length} caracteres)`);
    } else if (extractionMethod === 'basic-info') {
      // Si solo tenemos info básica, asumimos que el PDF tiene contenido
      console.log('ℹ️ Usando análisis básico - asumiendo PDF con contenido');
      results.warnings.push('Análisis de texto limitado - usando validación básica');
    }
  }

  /**
   * 🚨 VALIDACIÓN ESTRICTA DE PDF EN BLANCO
   * Esta función determina si un PDF está completamente vacío y debe ser rechazado
   */
  validateBlankPDF(textContent, hasImages, pageCount) {
    console.log('🔍 Validando si el PDF está en blanco...');
    
    // Limpiar y normalizar el texto extraído
    const cleanText = textContent
      .replace(/\s+/g, ' ')        // Normalizar espacios
      .replace(/\n+/g, '\n')       // Normalizar saltos de línea
      .replace(/[^\w\s]/g, '')     // Remover caracteres especiales
      .trim();

    console.log(`📝 Texto limpio: "${cleanText.substring(0, 100)}..." (${cleanText.length} caracteres)`);
    console.log(`📷 Tiene imágenes: ${hasImages}`);
    console.log(`📖 Páginas: ${pageCount}`);

    // ❌ CRITERIOS PARA RECHAZAR PDF EN BLANCO:
    
    // 1. No tiene texto significativo Y no tiene imágenes
    if (cleanText.length === 0 && !hasImages) {
      console.log('❌ Criterio 1: Sin texto y sin imágenes');
      return true;
    }
    
    // 2. Solo tiene caracteres de formato/espacios (menos de 10 caracteres reales)
    if (cleanText.length > 0 && cleanText.length < 10 && !hasImages) {
      console.log('❌ Criterio 2: Texto insignificante y sin imágenes');
      return true;
    }

    // 3. Solo contiene caracteres repetitivos (espacios, puntos, guiones)
    const meaningfulChars = cleanText.replace(/[\s\.\-_\|]+/g, '');
    if (meaningfulChars.length < 5 && !hasImages) {
      console.log('❌ Criterio 3: Solo caracteres repetitivos sin contenido real');
      return true;
    }

    // 4. PDF con muchas páginas pero contenido mínimo (menos de 3 caracteres por página)
    if (pageCount && pageCount > 1) {
      const contentPerPage = cleanText.length / pageCount;
      if (contentPerPage < 3 && !hasImages) {
        console.log(`❌ Criterio 4: Contenido insuficiente por página (${contentPerPage.toFixed(1)} chars/page)`);
        return true;
      }
    }

    // ✅ PDF tiene contenido suficiente
    console.log('✅ PDF contiene contenido suficiente, no está en blanco');
    return false;
  }

  /**
   * 🔍 Analizar contenido de texto
   */
  async analyzeTextContent(filePath, results) {
    console.log('🔍 Analizando contenido de texto...');
    
    let text = '';

    // 🔄 Intentar múltiples métodos para extraer texto
    try {
      // Método 1: pdftotext (más confiable para análisis)
      const { stdout } = await execAsync(`pdftotext "${filePath}" -`);
      text = stdout.toLowerCase();
      console.log(`✅ Texto extraído para análisis (${text.length} caracteres)`);
    } catch (error) {
      console.log('⚠️ No se pudo extraer texto para análisis detallado');
      // Si no podemos extraer texto, asumimos que está limpio
      return;
    }

    // 📊 Análisis de contenido problemático
    
    // Buscar patrones de código
    const codePatterns = [
      'function(',
      'var ',
      'const ',
      'let ',
      'if (',
      'for (',
      'while (',
      'class ',
      '<?php',
      '<script',
      'console.log',
      'document.',
      'window.'
    ];

    const foundCodePatterns = codePatterns.filter(pattern => text.includes(pattern));
    
    if (foundCodePatterns.length > 2) {
      results.warnings.push(`PDF parece contener código: ${foundCodePatterns.slice(0, 3).join(', ')}`);
    }

    console.log('✅ Análisis de contenido de texto completado');
  }

  /**
   * 🔍 Detectar elementos interactivos
   */
  async detectInteractiveElements(filePath, results) {
    try {
      // Usar pdfinfo para detectar formularios
      const { stdout } = await execAsync(`pdfinfo "${filePath}"`);
      
      if (stdout.toLowerCase().includes('form')) {
        results.warnings.push('PDF contiene formularios interactivos');
      }

    } catch (error) {
      console.log('⚠️ No se pudo analizar elementos interactivos:', error.message);
    }
  }

  /**
   * 🎯 Evaluación final de toda la validación
   */
  evaluateOverallValidation(results) {
    // Un PDF es procesable si:
    // 1. Tiene estructura básica válida
    // 2. No tiene JavaScript (bloqueante)
    // 3. No está protegido con contraseña (bloqueante)
    // 4. No está completamente en blanco (bloqueante)
    
    results.isProcessable = 
      results.checks.basicStructure && 
      !results.hasJavaScript &&
      !results.hasBlankPages &&
      !results.errors.some(error => error.includes('contraseña')) &&
      !results.errors.some(error => error.includes('PDF en blanco'));

    // Un PDF es válido si cumple TODAS las especificaciones
    results.valid = 
      results.isProcessable &&
      results.warnings.length === 0 &&
      results.errors.length === 0;

    // Generar resumen
    if (results.valid) {
      results.summary = '✅ PDF cumple todas las especificaciones';
    } else if (results.hasBlankPages) {
      results.summary = '❌ PDF rechazado: está completamente en blanco';
    } else if (results.isProcessable) {
      results.summary = '🔄 PDF es procesable pero requiere conversión automática';
    } else {
      results.summary = '❌ PDF no es procesable automáticamente';
    }
  }

  /**
   * 📊 Generar reporte detallado de validación
   */
  generateDetailedReport(results) {
    const lines = [
      `📄 REPORTE DE VALIDACIÓN: ${results.filename}`,
      `📦 Tamaño: ${(results.fileSize / 1024).toFixed(2)} KB`,
      `📖 Páginas: ${results.metadata.pages || 'Desconocido'}`,
      '',
      `🎯 ESTADO FINAL: ${results.summary}`,
      `✅ Válido: ${results.valid ? 'SÍ' : 'NO'}`,
      `🔄 Procesable: ${results.isProcessable ? 'SÍ' : 'NO'}`,
      `📄 PDF en Blanco: ${results.hasBlankPages ? 'SÍ' : 'NO'}`,
      `🔍 Contiene OCR: ${results.hasOCR ? 'SÍ' : 'NO'}`,
      `⚠️ JavaScript: ${results.hasJavaScript ? 'SÍ' : 'NO'}`,
      ''
    ];

    if (results.errors.length > 0) {
      lines.push('❌ ERRORES:');
      results.errors.forEach(error => lines.push(`   • ${error}`));
      lines.push('');
    }

    if (results.warnings.length > 0) {
      lines.push('⚠️ ADVERTENCIAS:');
      results.warnings.forEach(warning => lines.push(`   • ${warning}`));
      lines.push('');
    }

    if (results.images.length > 0) {
      lines.push('📷 ANÁLISIS DE IMÁGENES:');
      results.images.forEach((img, i) => {
        lines.push(`   ${i + 1}. ${img.width}x${img.height} - DPI: ${img.x_ppi}x${img.y_ppi} - ${img.color} ${img.bits}bits`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 🔧 UTILIDADES DE PARSEO
   */
  parsePdfInfo(pdfInfoOutput) {
    const metadata = {};
    const lines = pdfInfoOutput.split('\n');

    lines.forEach(line => {
      if (line.includes('Pages:')) {
        metadata.pages = parseInt(line.split(':')[1].trim());
      } else if (line.includes('Page size:')) {
        metadata.pageSize = line.split(':')[1].trim();
      } else if (line.includes('Encrypted:')) {
        metadata.encrypted = line.split(':')[1].trim().toLowerCase();
      } else if (line.includes('PDF version:')) {
        metadata.version = line.split(':')[1].trim();
      }
    });

    return metadata;
  }

  parsePdfImages(pdfImagesOutput) {
    const images = [];
    const lines = pdfImagesOutput.split('\n').slice(2); // Saltar headers

    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 10) {
        images.push({
          page: parseInt(parts[0]) || 0,
          width: parseInt(parts[3]) || 0,
          height: parseInt(parts[4]) || 0,
          color: parts[5] || 'unknown',
          bits: parts[6] || 'unknown',
          x_ppi: parseInt(parts[8]) || 0,
          y_ppi: parseInt(parts[9]) || 0
        });
      }
    });

    return images;
  }

  /**
   * 🔧 UTILIDADES DE SOPORTE
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async cleanupFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn(`⚠️ No se pudo eliminar archivo temporal: ${filePath}`);
      }
    }
  }
}

// Instancia singleton para uso en la aplicación
const pdfValidator = new PDFValidator();

export { pdfValidator, PDFValidator };
export default pdfValidator;
