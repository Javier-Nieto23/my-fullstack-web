import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * 🔄 PDF Processor - Conversión automática a especificaciones
 * Convierte PDFs automáticamente a: escala grises 8-bit, 300 DPI, optimizado
 * Basado en las funciones de Joel pero con conversión automática
 */
export class PDFProcessor {
  constructor() {
    this.targetDPI = 300;
    this.targetFormat = 'grayscale';
    this.targetBitsPerComponent = 8;
    this.maxSizeBytes = 3 * 1024 * 1024; // 3 MB
  }

  /**
   * 🎯 PROCESAMIENTO COMPLETO DEL PDF
   * @param {Buffer} fileBuffer - Buffer del archivo original
   * @param {string} originalName - Nombre original del archivo
   * @returns {Object} Buffer procesado y metadatos
   */
  async processPDF(fileBuffer, originalName) {
    console.log('🔄 Iniciando procesamiento PDF:', originalName);
    
    let tempInputFile = null;
    let tempOutputFile = null;
    
    try {
      // Crear archivos temporales
      tempInputFile = await this.createTempFile(fileBuffer, 'input.pdf');
      tempOutputFile = await this.createTempFile(Buffer.alloc(0), 'output.pdf');

      // Procesar el PDF
      const processResult = await this.optimizePDF(tempInputFile, tempOutputFile);
      
      // Leer el archivo procesado
      const processedBuffer = await fs.readFile(tempOutputFile);
      
      // Verificar el resultado
      const verification = await this.verifyProcessedPDF(processedBuffer);
      
      console.log('✅ PDF procesado exitosamente:', {
        originalSize: fileBuffer.length,
        processedSize: processedBuffer.length,
        compressionRatio: ((1 - processedBuffer.length / fileBuffer.length) * 100).toFixed(1) + '%',
        specifications: verification
      });

      return {
        buffer: processedBuffer,
        originalSize: fileBuffer.length,
        processedSize: processedBuffer.length,
        compressionRatio: ((1 - processedBuffer.length / fileBuffer.length) * 100).toFixed(1) + '%',
        optimizations: processResult.optimizations,
        verification: verification
      };

    } catch (error) {
      console.error('❌ Error procesando PDF:', error);
      throw new Error(`Error en procesamiento PDF: ${error.message}`);
    } finally {
      // Limpiar archivos temporales
      if (tempInputFile) await this.cleanupTempFile(tempInputFile);
      if (tempOutputFile) await this.cleanupTempFile(tempOutputFile);
    }
  }

  /**
   * 🔧 OPTIMIZACIÓN PRINCIPAL DEL PDF
   * Aplica todas las transformaciones necesarias
   */
  async optimizePDF(inputPath, outputPath) {
    const optimizations = [];

    try {
      // 1️⃣ CONVERSIÓN AGRESIVA A ESCALA DE GRISES + 300 DPI usando Ghostscript
      console.log('🔄 Convirtiendo a escala de grises 300 DPI...');
      
      const gsCommand = [
        'gs',
        '-sDEVICE=pdfwrite',
        // === FORZAR CONVERSIÓN COMPLETA A ESCALA DE GRISES ===
        '-sProcessColorModel=DeviceGray',
        '-sColorConversionStrategy=Gray',
        '-dProcessColorModel=/DeviceGray',
        '-dOverrideICC=true',
        '-dRenderIntent=1',
        // === FORZAR CONVERSIÓN DE TODAS LAS IMÁGENES ===
        '-dConvertCMYKImagesToRGB=false',
        '-dConvertImagesToIndexed=false',
        '-dPassThroughJPEGImages=false', // NO mantener JPEGs originales
        '-dPassThroughJPXImages=false',  // NO mantener JPX originales
        // === PARÁMETROS BÁSICOS ===
        '-dCompatibilityLevel=1.4',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-r300',
        // === CONFIGURACIÓN AGRESIVA: FORZAR 300 DPI EN TODAS LAS IMÁGENES ===
        '-dDownsampleColorImages=true',
        '-dDownsampleGrayImages=true',
        '-dDownsampleMonoImages=true',
        // Resoluciones exactas
        '-dColorImageResolution=300',
        '-dGrayImageResolution=300',
        '-dMonoImageResolution=300',
        // Tipos de downsampling
        '-dColorImageDownsampleType=/Bicubic',
        '-dGrayImageDownsampleType=/Bicubic',
        '-dMonoImageDownsampleType=/Bicubic',
        // === FORZAR RESAMPLING: Threshold en 1.0 = TODAS las imágenes ===
        '-dColorImageDownsampleThreshold=1.0',
        '-dGrayImageDownsampleThreshold=1.0',
        '-dMonoImageDownsampleThreshold=1.0',
        // === FILTROS FORZADOS PARA CONVERSIÓN COMPLETA ===
        '-dAutoFilterColorImages=false',
        '-dAutoFilterGrayImages=false',
        '-dEncodeColorImages=true',
        '-dEncodeGrayImages=true',
        '-dColorImageFilter=/DCTEncode',
        '-dGrayImageFilter=/DCTEncode',
        // === OPTIMIZACIONES ADICIONALES ===
        '-dDetectDuplicateImages=true',
        '-dCompressFonts=true',
        '-dSubsetFonts=true',
        '-dEmbedAllFonts=true',
        '-dAutoRotatePages=/None',
        '-dUseFlateCompression=true',
        // === NO USAR PDFSETTINGS para control total ===
        `-sOutputFile=${outputPath}`,
        inputPath
      ].join(' ');

      await execAsync(gsCommand);
      optimizations.push('🎯 Conversión forzada: DeviceGray + 300 DPI + PassThrough=false');
      optimizations.push('🔧 Resampling: Threshold=1.0 (todas las imágenes procesadas)');
      optimizations.push('⚙️ Filtros manuales: DCTEncode para control total');

      // 2️⃣ VERIFICAR QUE EL ARCHIVO SE GENERÓ CORRECTAMENTE
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('El archivo procesado está vacío');
      }

      // 3️⃣ Si aún no cumple, aplicar segunda pasada más agresiva
      const quickVerify = await this.quickImageCheck(outputPath);
      if (!quickVerify.success) {
        console.log('🔄 Primera pasada insuficiente, aplicando conversión extrema...');
        await this.extremeConversion(outputPath);
        optimizations.push('Conversión extrema aplicada');
        
        // 🔥 Si TODAVÍA no cumple, usar ConvertAPI (más confiable que PDF-REST)
        const secondVerify = await this.quickImageCheck(outputPath);
        if (!secondVerify.success) {
          console.log('🌐 Aplicando ConvertAPI como método preferido...');
          
          try {
            await this.convertApiConversion(outputPath);
            optimizations.push('ConvertAPI aplicado exitosamente');
          } catch (convertApiError) {
            console.warn('⚠️ ConvertAPI no disponible, usando métodos alternativos locales...');
            
            // Métodos alternativos locales (más confiables para fallback)
            const alternativeMethods = [
              () => this.pageByPageConversion(outputPath),
              () => this.simpleGrayscaleConversion(outputPath),
              () => this.mutoolConversion(outputPath), 
              () => this.popplerBasedConversion(outputPath),
              () => this.ultraBasicConversion(outputPath)
            ];
            
            let fallbackSuccess = false;
            for (let i = 0; i < alternativeMethods.length; i++) {
              const method = alternativeMethods[i];
              try {
                console.log(`🔧 Intentando método alternativo ${i + 1}/${alternativeMethods.length}...`);
                await method();
                optimizations.push(`Método alternativo ${i + 1} aplicado exitosamente`);
                fallbackSuccess = true;
                break;
              } catch (altError) {
                console.warn(`⚠️ Método alternativo ${i + 1} falló: ${altError.message}`);
              }
            }
            
            if (!fallbackSuccess) {
              optimizations.push('Múltiples conversiones fallaron - usando mejor resultado disponible');
            }
          }
        }
      }

      // 4️⃣ OPTIMIZACIÓN ADICIONAL SI EL TAMAÑO ES MAYOR A 3MB
      const finalStats = await fs.stat(outputPath);
      if (finalStats.size > this.maxSizeBytes) {
        console.log('🔄 Archivo mayor a 3MB, aplicando compresión adicional...');
        await this.additionalCompression(outputPath);
        optimizations.push('Compresión adicional aplicada');
      }

      console.log('✅ Optimización completada');
      return { success: true, optimizations };

    } catch (error) {
      console.error('❌ Error en optimización:', error);
      
      // Verificar si al menos se generó un archivo de salida
      try {
        const stats = await fs.stat(outputPath);
        if (stats.size > 0) {
          console.warn('⚠️ Error durante optimización pero archivo generado, continuando...');
          return { 
            success: true, 
            optimizations: [...optimizations, `⚠️ Optimización parcial: ${error.message}`] 
          };
        }
      } catch {}
      
      throw new Error(`Fallo en optimización Ghostscript: ${error.message}`);
    }
  }

  /**
   * ⚡ VERIFICACIÓN RÁPIDA DE IMÁGENES
   * Chequeo rápido para ver si necesita conversión adicional
   */
  async quickImageCheck(filePath) {
    try {
      const { stdout: imageList } = await execAsync(`pdfimages -list "${filePath}"`);
      const imageLines = imageList.split('\n').slice(2).filter(line => /^\s*\d+/.test(line));
      
      if (imageLines.length === 0) {
        return { success: true, reason: 'No hay imágenes' };
      }

      for (const line of imageLines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 10) {
          const color = parts[5].toLowerCase();
          const bpc = parseInt(parts[6]);
          const xDpi = parseInt(parts[10]);
          
          if (color !== 'gray' || bpc !== 8 || xDpi < 300) {
            return { success: false, reason: 'Imágenes no cumplen especificaciones' };
          }
        }
      }

      return { success: true, reason: 'Todas las imágenes cumplen' };
    } catch (error) {
      return { success: false, reason: 'No se pudo verificar' };
    }
  }

  /**
   * 🔥 CONVERSIÓN EXTREMA
   * Última opción para forzar especificaciones
   */
  async extremeConversion(filePath) {
    const tempFile = filePath + '.extreme';
    
    try {
      // Conversión extrema: rasterizar todo y reconstruir
      const extremeCommand = [
        'gs',
        '-sDEVICE=pdfwrite',
        // === CONVERSIÓN FORZADA MÁS AGRESIVA ===
        '-sProcessColorModel=DeviceGray',
        '-dProcessColorModel=/DeviceGray',
        '-sColorConversionStrategy=Gray',
        '-dOverrideICC=true',
        '-dRenderIntent=1',
        '-dCompatibilityLevel=1.4',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-r300',
        // === RASTERIZACIÓN COMPLETA: CONVERTIR TODO A BITMAP Y RECOMPRIMIR ===
        '-dColorImageResolution=300',
        '-dGrayImageResolution=300',
        '-dMonoImageResolution=300',
        '-dDownsampleColorImages=true',
        '-dDownsampleGrayImages=true', 
        '-dDownsampleMonoImages=true',
        '-dColorImageDownsampleType=/Bicubic',
        '-dGrayImageDownsampleType=/Bicubic',
        '-dColorImageDownsampleThreshold=1.0',
        '-dGrayImageDownsampleThreshold=1.0',
        // === FORZAR RECODIFICACIÓN COMPLETA ===
        '-dPassThroughJPEGImages=false', // NO preservar JPEGs
        '-dPassThroughJPXImages=false',  // NO preservar JPX
        '-dConvertCMYKImagesToRGB=false',
        '-dAutoFilterColorImages=false', // Control manual de filtros
        '-dAutoFilterGrayImages=false',
        '-dEncodeColorImages=true',      // Forzar recodificación
        '-dEncodeGrayImages=true',
        '-dColorImageFilter=/DCTEncode', // Usar JPEG para compresión
        '-dGrayImageFilter=/DCTEncode',
        // === CALIDAD ESPECÍFICA PARA FORZAR 8-BIT ===
        '-dJPEGQ=85',                   // Calidad JPEG decente
        '-dMonoImageFilter=/CCITTFaxEncode',
        `-sOutputFile=${tempFile}`,
        filePath
      ].join(' ');

      await execAsync(extremeCommand);
      
      // Reemplazar archivo original
      await fs.rename(tempFile, filePath);
      console.log('✅ Conversión extrema completada');
      
    } catch (error) {
      // Limpiar archivo temporal si existe
      try {
        await fs.unlink(tempFile);
      } catch {}
      throw error;
    }
  }

  /**
   * � CONVERSIÓN SIMPLE DE ESCALA DE GRISES
   * Método más básico para PDFs problemáticos con la rasterización
   */
  async simpleGrayscaleConversion(filePath) {
    const tempFile = filePath + '.simple';
    
    try {
      // Conversión básica sin rasterización
      const simpleCommand = [
        'gs',
        '-sDEVICE=pdfwrite',
        '-sColorConversionStrategy=Gray',
        '-dProcessColorModel=/DeviceGray',
        '-dCompatibilityLevel=1.4',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-r300',
        // Configuración muy básica
        '-dDownsampleColorImages=true',
        '-dDownsampleGrayImages=true',
        '-dColorImageResolution=300',
        '-dGrayImageResolution=300',
        '-dColorImageDownsampleType=/Average',
        '-dGrayImageDownsampleType=/Average',
        '-dColorImageDownsampleThreshold=1.1',
        '-dGrayImageDownsampleThreshold=1.1',
        `-sOutputFile=${tempFile}`,
        filePath
      ].join(' ');

      await execAsync(simpleCommand);
      
      // Reemplazar archivo original
      await fs.rename(tempFile, filePath);
      console.log('✅ Conversión simple completada');
      
    } catch (error) {
      // Limpiar archivo temporal si existe
      try {
        await fs.unlink(tempFile);
      } catch {}
      throw error;
    }
  }

  /**
   * 📐 CONVERSIÓN POR PARTES - DIVIDE Y VENCERÁS
   * Procesa el PDF página por página para evitar problemas complejos
   */
  async pageByPageConversion(filePath) {
    const tempDir = path.dirname(filePath);
    const baseName = path.basename(filePath, '.pdf');
    const finalFile = filePath + '.paged';
    
    try {
      console.log('📐 Aplicando conversión página por página...');
      
      // 1. Obtener número de páginas
      const { stdout: pdfInfo } = await execAsync(`pdfinfo "${filePath}"`);
      const pageMatch = pdfInfo.match(/Pages:\s*(\d+)/);
      const numPages = pageMatch ? parseInt(pageMatch[1]) : 1;
      
      const pageFiles = [];
      
      // 2. Procesar cada página individualmente
      for (let page = 1; page <= numPages; page++) {
        const pageFile = path.join(tempDir, `${baseName}_page_${page}.pdf`);
        
        // Extraer página con configuración básica
        await execAsync([
          'gs',
          '-sDEVICE=pdfwrite',
          '-dNOPAUSE',
          '-dQUIET',
          '-dBATCH',
          `-dFirstPage=${page}`,
          `-dLastPage=${page}`,
          '-sColorConversionStrategy=Gray',
          '-dProcessColorModel=/DeviceGray',
          '-r300',
          `-sOutputFile=${pageFile}`,
          filePath
        ].join(' '));
        
        pageFiles.push(pageFile);
      }
      
      // 3. Combinar páginas procesadas
      const combineCommand = [
        'gs',
        '-sDEVICE=pdfwrite',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-sColorConversionStrategy=Gray',
        '-dProcessColorModel=/DeviceGray',
        `-sOutputFile=${finalFile}`,
        ...pageFiles
      ].join(' ');
      
      await execAsync(combineCommand);
      
      // 4. Limpiar páginas temporales
      for (const pageFile of pageFiles) {
        try {
          await fs.unlink(pageFile);
        } catch {}
      }
      
      // 5. Reemplazar archivo original
      await fs.rename(finalFile, filePath);
      console.log('✅ Conversión página por página completada');
      
    } catch (error) {
      // Limpiar archivos temporales
      try {
        await fs.unlink(finalFile);
        const { stdout: cleanFiles } = await execAsync(`ls "${tempDir}"/${baseName}_page_*.pdf 2>/dev/null || echo ""`);
        if (cleanFiles.trim()) {
          await execAsync(`rm -f "${tempDir}"/${baseName}_page_*.pdf`);
        }
      } catch {}
      throw error;
    }
  }

  /**
   * 🔬 CONVERSIÓN CON MUTOOL (si está disponible)
   * MuPDF tools para conversión directa
   */
  async mutoolConversion(filePath) {
    const tempFile = filePath + '.mutool';
    
    try {
      console.log('🔬 Aplicando conversión con MuTool...');
      
      if (await this.commandExists('mutool')) {
        // MuTool puede hacer conversiones más precisas
        await execAsync(`mutool clean -gggg "${filePath}" "${tempFile}"`);
        
        // Reemplazar archivo
        await fs.rename(tempFile, filePath);
        console.log('✅ Conversión MuTool completada');
      } else {
        throw new Error('MuTool no disponible');
      }
      
    } catch (error) {
      try {
        await fs.unlink(tempFile);
      } catch {}
      throw error;
    }
  }

  /**
   * 🎯 CONVERSIÓN ALTERNATIVA CON QPDF
   * Usa qpdf o configuración muy conservadora
   */
  async popplerBasedConversion(filePath) {
    const tempFile = filePath + '.poppler';
    
    try {
      console.log('🎯 Aplicando conversión con herramientas alternativas...');
      
      // Intentar qpdf primero (más estable)
      if (await this.commandExists('qpdf')) {
        await execAsync(`qpdf --linearize --object-streams=generate "${filePath}" "${tempFile}"`);
        
        // Aplicar conversión de color con Ghostscript conservador
        const tempFile2 = tempFile + '.gray';
        await execAsync([
          'gs',
          '-sDEVICE=pdfwrite',
          '-dNOPAUSE',
          '-dQUIET',
          '-dBATCH',
          '-dPDFSETTINGS=/ebook',
          '-sColorConversionStrategy=Gray',
          `-sOutputFile=${tempFile2}`,
          tempFile
        ].join(' '));
        
        await fs.unlink(tempFile);
        await fs.rename(tempFile2, filePath);
      } else {
        // Fallback ultra conservador
        await execAsync([
          'gs',
          '-sDEVICE=pdfwrite',
          '-dNOPAUSE',
          '-dQUIET',
          '-dBATCH',
          '-dPDFSETTINGS=/ebook',
          '-sColorConversionStrategy=Gray',
          `-sOutputFile=${tempFile}`,
          filePath
        ].join(' '));
        
        await fs.rename(tempFile, filePath);
      }
      
      console.log('✅ Conversión alternativa completada');
      
    } catch (error) {
      try {
        await fs.unlink(tempFile);
        await fs.unlink(tempFile + '.gray');
      } catch {}
      throw error;
    }
  }

  /**
   * 🔰 CONVERSIÓN ULTRA BÁSICA - ÚLTIMO RECURSO
   * Configuración mínima que casi siempre funciona
   */
  async ultraBasicConversion(filePath) {
    const tempFile = filePath + '.ultra';
    
    try {
      console.log('🔰 Aplicando conversión ultra básica...');
      
      // Configuración ultra minimalista
      const ultraCommand = [
        'gs',
        '-sDEVICE=pdfwrite',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-sColorConversionStrategy=Gray',
        `-sOutputFile=${tempFile}`,
        filePath
      ].join(' ');

      await execAsync(ultraCommand);
      
      // Reemplazar archivo original
      await fs.rename(tempFile, filePath);
      console.log('✅ Conversión ultra básica completada');
      
    } catch (error) {
      try {
        await fs.unlink(tempFile);
      } catch {}
      throw error;
    }
  }

  /**
   * 🌐 CONVERSIÓN CON CONVERTAPI
   * Usa servicios en la nube ConvertAPI para conversión profesional
   */
  async convertApiConversion(filePath) {
    try {
      console.log('🌐 Aplicando conversión con ConvertAPI...');
      
      // Leer el archivo
      const fileBuffer = await fs.readFile(filePath);
      
      // Usar ConvertAPI para optimización
      const result = await this.callConvertAPI(fileBuffer);
      
      if (result.success && result.buffer) {
        // Escribir el resultado optimizado
        await fs.writeFile(filePath, result.buffer);
        console.log('✅ Conversión ConvertAPI completada');
        return result;
      } else {
        throw new Error('ConvertAPI no pudo procesar el archivo');
      }
      
    } catch (error) {
      console.warn('⚠️ ConvertAPI conversión falló:', error.message);
      throw error;
    }
  }

  /**
   * 🔌 LLAMADA A CONVERTAPI
   * Integración con servicios de ConvertAPI
   */
  async callConvertAPI(fileBuffer) {
    try {
      console.log('🌐 Verificando disponibilidad de ConvertAPI...');
      
      // Estrategia 1: PDF Optimize (conversión completa)
      const optimizeResult = await this.convertApiOptimize(fileBuffer);
      if (optimizeResult.success) {
        return optimizeResult;
      }

      // Estrategia 2: PDF to PDF/A (estándar archival con escala grises)
      const pdfAResult = await this.convertApiToPdfA(fileBuffer);
      if (pdfAResult.success) {
        return pdfAResult;
      }

      // Estrategia 3: Compress (compresión básica)
      const compressResult = await this.convertApiCompress(fileBuffer);
      return compressResult;

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ⚡ CONVERTAPI OPTIMIZE
   * Optimización completa con ConvertAPI
   */
  async convertApiOptimize(fileBuffer) {
    try {
      const FormData = (await import('form-data')).default;
      const fetch = (await import('node-fetch')).default;
      
      const form = new FormData();
      form.append('File', fileBuffer, {
        filename: 'document.pdf',
        contentType: 'application/pdf'
      });
      
      // Parámetros específicos para nuestros requerimientos
      form.append('ImageDpi', '300');          // 300 DPI
      form.append('ImageQuality', '85');        // Calidad alta
      form.append('ColorSpace', 'Gray');        // Escala grises
      form.append('OptimizeImages', 'true');    // Optimizar imágenes
      form.append('CompressImages', 'true');    // Comprimir imágenes
      
      const apiKey = process.env.CONVERTAPI_SECRET || 'demo';
      
      // ConvertAPI PDF Optimize endpoint
      const response = await fetch(`https://v2.convertapi.com/convert/pdf/to/pdf?Secret=${apiKey}`, {
        method: 'POST',
        body: form,
        timeout: 60000 // 60 segundos
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.Files && result.Files.length > 0) {
          // Descargar el archivo procesado
          const fileUrl = result.Files[0].Url;
          const fileResponse = await fetch(fileUrl);
          const resultBuffer = await fileResponse.buffer();
          
          console.log('✅ ConvertAPI Optimize exitoso');
          return { 
            success: true, 
            buffer: resultBuffer,
            method: 'ConvertAPI Optimize',
            originalSize: fileBuffer.length,
            newSize: resultBuffer.length
          };
        } else {
          throw new Error('ConvertAPI no devolvió archivos');
        }
      } else {
        const errorText = await response.text();
        throw new Error(`ConvertAPI Optimize HTTP ${response.status}: ${errorText}`);
      }

    } catch (error) {
      console.warn('⚠️ ConvertAPI Optimize falló:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 📋 CONVERTAPI TO PDF/A
   * Conversión a PDF/A con escala grises
   */
  async convertApiToPdfA(fileBuffer) {
    try {
      const FormData = (await import('form-data')).default;
      const fetch = (await import('node-fetch')).default;
      
      const form = new FormData();
      form.append('File', fileBuffer, {
        filename: 'document.pdf',
        contentType: 'application/pdf'
      });
      
      // Parámetros para PDF/A con escala grises
      form.append('PdfAVersion', '1b');         // PDF/A-1b
      form.append('ImageDpi', '300');           // 300 DPI
      form.append('ColorSpace', 'Gray');        // Forzar escala grises
      form.append('ImageQuality', '85');        // Calidad controlada
      
      const apiKey = process.env.CONVERTAPI_SECRET || 'demo';
      
      // ConvertAPI PDF to PDF/A endpoint
      const response = await fetch(`https://v2.convertapi.com/convert/pdf/to/pdfa?Secret=${apiKey}`, {
        method: 'POST',
        body: form,
        timeout: 60000
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.Files && result.Files.length > 0) {
          const fileUrl = result.Files[0].Url;
          const fileResponse = await fetch(fileUrl);
          const resultBuffer = await fileResponse.buffer();
          
          console.log('✅ ConvertAPI PDF/A exitoso');
          return { 
            success: true, 
            buffer: resultBuffer,
            method: 'ConvertAPI PDF/A',
            originalSize: fileBuffer.length,
            newSize: resultBuffer.length
          };
        } else {
          throw new Error('ConvertAPI PDF/A no devolvió archivos');
        }
      } else {
        const errorText = await response.text();
        throw new Error(`ConvertAPI PDF/A HTTP ${response.status}: ${errorText}`);
      }

    } catch (error) {
      console.warn('⚠️ ConvertAPI PDF/A falló:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🗜️ CONVERTAPI COMPRESS
   * Compresión básica con ConvertAPI
   */
  async convertApiCompress(fileBuffer) {
    try {
      const FormData = (await import('form-data')).default;
      const fetch = (await import('node-fetch')).default;
      
      const form = new FormData();
      form.append('File', fileBuffer, {
        filename: 'document.pdf',
        contentType: 'application/pdf'
      });
      
      // Parámetros de compresión
      form.append('ImageDpi', '300');           // Mantener 300 DPI
      form.append('ImageQuality', '75');        // Compresión moderada
      form.append('ColorSpace', 'Gray');        // Escala grises
      
      const apiKey = process.env.CONVERTAPI_SECRET || 'demo';
      
      // ConvertAPI Compress endpoint
      const response = await fetch(`https://v2.convertapi.com/convert/pdf/to/compress?Secret=${apiKey}`, {
        method: 'POST',
        body: form,
        timeout: 60000
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.Files && result.Files.length > 0) {
          const fileUrl = result.Files[0].Url;
          const fileResponse = await fetch(fileUrl);
          const resultBuffer = await fileResponse.buffer();
          
          console.log('✅ ConvertAPI Compress exitoso');
          return { 
            success: true, 
            buffer: resultBuffer,
            method: 'ConvertAPI Compress',
            originalSize: fileBuffer.length,
            newSize: resultBuffer.length
          };
        } else {
          throw new Error('ConvertAPI Compress no devolvió archivos');
        }
      } else {
        const errorText = await response.text();
        throw new Error(`ConvertAPI Compress HTTP ${response.status}: ${errorText}`);
      }

    } catch (error) {
      console.warn('⚠️ ConvertAPI Compress falló:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🔌 LLAMADA A PDF-REST API
   * Integración con servicios de PDF-REST con detección rápida de errores
   */
  async callPdfRestAPI(fileBuffer) {
    try {
      // Verificación rápida de conectividad (máximo 10 segundos total)
      console.log('🌐 Verificando disponibilidad de PDF-REST...');
      
      // Estrategia 1: Usar PDF-REST Compress (más rápido)
      const compressResult = await this.pdfRestCompress(fileBuffer);
      if (compressResult.success) {
        return compressResult;
      }

      // Si compress falló por SSL/conectividad, no intentar los demás
      if (compressResult.error && (
        compressResult.error.includes('self-signed certificate') ||
        compressResult.error.includes('ECONNREFUSED') ||
        compressResult.error.includes('timeout') ||
        compressResult.error.includes('ENOTFOUND')
      )) {
        console.warn('⚠️ PDF-REST no disponible (conectividad), saltando otros métodos PDF-REST');
        return { success: false, error: 'PDF-REST service unavailable' };
      }

      // Estrategia 2: Solo si compress falló por otras razones
      const grayscaleResult = await this.pdfRestGrayscale(fileBuffer);
      if (grayscaleResult.success) {
        return grayscaleResult;
      }

      // Estrategia 3: Último intento
      const optimizeResult = await this.pdfRestOptimize(fileBuffer);
      return optimizeResult;

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 🗜️ PDF-REST COMPRESS
   * Compresión inteligente con PDF-REST
   */
  async pdfRestCompress(fileBuffer) {
    try {
      const FormData = (await import('form-data')).default;
      const fetch = (await import('node-fetch')).default;
      const https = (await import('https')).default;
      
      // Configurar agente HTTPS más permisivo para PDF-REST
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false, // Permitir certificados auto-firmados
        timeout: 30000 // 30 segundos timeout
      });
      
      const form = new FormData();
      form.append('file', fileBuffer, {
        filename: 'document.pdf',
        contentType: 'application/pdf'
      });
      
      // PDF-REST Compress endpoint
      const response = await fetch('https://api.pdf-rest.com/compress', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PDF_REST_API_KEY || 'demo'}`,
          ...form.getHeaders()
        },
        body: form,
        agent: httpsAgent,
        timeout: 30000
      });

      if (response.ok) {
        const resultBuffer = await response.buffer();
        console.log('✅ PDF-REST Compress exitoso');
        return { 
          success: true, 
          buffer: resultBuffer,
          method: 'PDF-REST Compress',
          originalSize: fileBuffer.length,
          newSize: resultBuffer.length
        };
      } else {
        throw new Error(`PDF-REST Compress HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      console.warn('⚠️ PDF-REST Compress falló:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🎨 PDF-REST GRAYSCALE
   * Conversión a escala de grises con PDF-REST
   */
  async pdfRestGrayscale(fileBuffer) {
    try {
      const FormData = (await import('form-data')).default;
      const fetch = (await import('node-fetch')).default;
      const https = (await import('https')).default;
      
      // Configurar agente HTTPS más permisivo
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        timeout: 30000
      });
      
      const form = new FormData();
      form.append('file', fileBuffer, {
        filename: 'document.pdf',
        contentType: 'application/pdf'
      });
      
      // PDF-REST Grayscale endpoint
      const response = await fetch('https://api.pdf-rest.com/convert-to-grayscale', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PDF_REST_API_KEY || 'demo'}`,
          ...form.getHeaders()
        },
        body: form,
        agent: httpsAgent,
        timeout: 30000
      });

      if (response.ok) {
        const resultBuffer = await response.buffer();
        console.log('✅ PDF-REST Grayscale exitoso');
        return { 
          success: true, 
          buffer: resultBuffer,
          method: 'PDF-REST Grayscale',
          originalSize: fileBuffer.length,
          newSize: resultBuffer.length
        };
      } else {
        throw new Error(`PDF-REST Grayscale HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      console.warn('⚠️ PDF-REST Grayscale falló:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * ⚡ PDF-REST OPTIMIZE
   * Optimización general con PDF-REST
   */
  async pdfRestOptimize(fileBuffer) {
    try {
      const FormData = (await import('form-data')).default;
      const fetch = (await import('node-fetch')).default;
      const https = (await import('https')).default;
      
      // Configurar agente HTTPS más permisivo
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        timeout: 30000
      });
      
      const form = new FormData();
      form.append('file', fileBuffer, {
        filename: 'document.pdf',
        contentType: 'application/pdf'
      });
      
      // Configuración de optimización
      form.append('settings', JSON.stringify({
        imageQuality: 300, // 300 DPI
        colorSpace: 'grayscale', // Forzar escala de grises
        compression: 'high'
      }));
      
      // PDF-REST Optimize endpoint
      const response = await fetch('https://api.pdf-rest.com/optimize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PDF_REST_API_KEY || 'demo'}`,
          ...form.getHeaders()
        },
        body: form,
        agent: httpsAgent,
        timeout: 30000
      });

      if (response.ok) {
        const resultBuffer = await response.buffer();
        console.log('✅ PDF-REST Optimize exitoso');
        return { 
          success: true, 
          buffer: resultBuffer,
          method: 'PDF-REST Optimize',
          originalSize: fileBuffer.length,
          newSize: resultBuffer.length
        };
      } else {
        throw new Error(`PDF-REST Optimize HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      console.warn('⚠️ PDF-REST Optimize falló:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🔥🔥 RASTERIZACIÓN COMPLETA - DESHABILITADA TEMPORALMENTE
   * NOTA: Causa errores "syntaxerror in (binary token, type=137)" consistentes
   * Reemplazada por PDF-REST como método preferido después de conversión extrema
   * Convierte el PDF completo a imágenes y luego reconstruye
   * Garantiza conversión total a escala de grises 8-bit y 300 DPI
   */
  async fullRasterization(filePath) {
    const tempDir = path.dirname(filePath);
    const baseName = path.basename(filePath, '.pdf');
    const pngPattern = path.join(tempDir, `${baseName}_page_%03d.png`);
    const finalFile = filePath + '.raster';
    
    try {
      console.log('🔥 Iniciando rasterización completa del PDF...');
      
      // 1️⃣ CONVERTIR PDF A IMÁGENES PNG (300 DPI, ESCALA DE GRISES)
      const pdfToPngCommand = [
        'gs',
        '-sDEVICE=pnggray', // Usar pnggray para escala de grises directamente
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-r300', // 300 DPI
        '-dTextAlphaBits=4',
        '-dGraphicsAlphaBits=4',
        // NO usar ProcessColorModel con pnggray - causa conflicto
        `-sOutputFile=${pngPattern}`,
        filePath
      ].join(' ');

      await execAsync(pdfToPngCommand);
      console.log('✅ PDF convertido a imágenes PNG en escala de grises');

      // 2️⃣ ENCONTRAR TODAS LAS IMÁGENES GENERADAS
      const { stdout: lsOutput } = await execAsync(`ls "${tempDir}"/${baseName}_page_*.png`);
      const imageFiles = lsOutput.trim().split('\n').filter(f => f.trim());
      
      if (imageFiles.length === 0) {
        throw new Error('No se generaron imágenes PNG');
      }

      // 3️⃣ CONVERTIR IMÁGENES A ESCALA DE GRISES 8-BIT CON ImageMagick/Ghostscript
      for (const imageFile of imageFiles) {
        if (await this.commandExists('convert')) {
          // Usar ImageMagick si está disponible
          await execAsync(`convert "${imageFile}" -colorspace Gray -depth 8 -density 300 "${imageFile}"`);
        }
        // Si no hay ImageMagick, las imágenes ya están en escala de grises por pnggray
      }

      // 4️⃣ RECONSTRUIR PDF DESDE LAS IMÁGENES PROCESADAS
      const imgToPdfCommand = [
        'gs',
        '-sDEVICE=pdfwrite',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-r300',
        '-dPDFSETTINGS=/prepress',
        '-sProcessColorModel=DeviceGray',
        '-dProcessColorModel=/DeviceGray',
        '-dAutoRotatePages=/None',
        `-sOutputFile=${finalFile}`,
        ...imageFiles
      ].join(' ');

      await execAsync(imgToPdfCommand);

      // 5️⃣ LIMPIAR IMÁGENES TEMPORALES
      for (const imageFile of imageFiles) {
        try {
          await fs.unlink(imageFile);
        } catch {}
      }

      // 6️⃣ REEMPLAZAR ARCHIVO ORIGINAL
      await fs.rename(finalFile, filePath);
      console.log('✅ Rasterización completa exitosa - PDF reconstruido');
      
    } catch (error) {
      console.error('❌ Error en rasterización completa:', error);
      // Limpiar archivos temporales en caso de error
      try {
        const { stdout: cleanupFiles } = await execAsync(`ls "${tempDir}"/${baseName}_page_*.png 2>/dev/null || true`);
        const filesToClean = cleanupFiles.trim().split('\n').filter(f => f.trim());
        for (const file of filesToClean) {
          await fs.unlink(file);
        }
        await fs.unlink(finalFile).catch(() => {});
      } catch {}
      throw error;
    }
  }

  /**
   * 🔧 VERIFICAR SI UN COMANDO EXISTE
   */
  async commandExists(command) {
    try {
      await execAsync(`which ${command}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 🗜️ COMPRESIÓN ADICIONAL para archivos grandes
   */
  async additionalCompression(filePath) {
    const tempFile = filePath + '.temp';
    
    try {
      // Aplicar configuración más agresiva de compresión
      const compressCommand = [
        'gs',
        '-sDEVICE=pdfwrite',
        '-sColorConversionStrategy=Gray',
        '-dProcessColorModel=/DeviceGray',
        '-dCompatibilityLevel=1.4',
        '-dPDFSETTINGS=/ebook', // Más compresión
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-r300',
        '-dDownsampleColorImages=true',
        '-dDownsampleGrayImages=true', 
        '-dColorImageDownsampleType=/Bicubic',
        '-dGrayImageDownsampleType=/Bicubic',
        '-dColorImageResolution=150', // Reducir resolución de imágenes
        '-dGrayImageResolution=150',
        '-dMonoImageResolution=300',
        '-dOptimize=true',
        '-dCompressFonts=true',
        '-dSubsetFonts=true',
        `-sOutputFile=${tempFile}`,
        filePath
      ].join(' ');

      await execAsync(compressCommand);
      
      // Reemplazar el archivo original con el comprimido
      await fs.rename(tempFile, filePath);
      
    } catch (error) {
      // Si falla, limpiar archivo temporal
      try {
        await fs.unlink(tempFile);
      } catch {}
      throw error;
    }
  }

  /**
   * ✅ VERIFICACIÓN DEL PDF PROCESADO
   * Confirma que cumple las especificaciones
   */
  async verifyProcessedPDF(processedBuffer) {
    let tempFile = null;
    
    try {
      tempFile = await this.createTempFile(processedBuffer, 'verify.pdf');
      
      const verification = {
        grayscale: false,
        dpi300: false,
        size3MB: false,
        errors: []
      };

      // Verificar tamaño
      verification.size3MB = processedBuffer.length <= this.maxSizeBytes;
      if (!verification.size3MB) {
        verification.errors.push(`Tamaño: ${(processedBuffer.length / (1024*1024)).toFixed(2)} MB > 3 MB`);
      }

      // Verificar imágenes con pdfimages
      try {
        const { stdout: imageList } = await execAsync(`pdfimages -list "${tempFile}"`);
        const imageLines = imageList.split('\n').slice(2).filter(line => /^\s*\d+/.test(line));
        
        let allGrayscale = true;
        let allDPI300 = true;
        
        for (const line of imageLines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 10) {
            const color = parts[5].toLowerCase();
            const bpc = parseInt(parts[6]);
            const xDpi = parseInt(parts[10]);
            const yDpi = parseInt(parts[11]);

            if (color !== 'gray' || bpc !== 8) {
              allGrayscale = false;
            }
            if (xDpi < 300 || yDpi < 300) {
              allDPI300 = false;
            }
          }
        }

        verification.grayscale = imageLines.length === 0 || allGrayscale;
        verification.dpi300 = imageLines.length === 0 || allDPI300;

        if (!verification.grayscale) {
          verification.errors.push('Algunas imágenes no están en escala de grises 8-bit');
        }
        if (!verification.dpi300) {
          verification.errors.push('Algunas imágenes tienen menos de 300 DPI');
        }

      } catch (error) {
        verification.errors.push('No se pudo verificar imágenes');
      }

      return verification;

    } catch (error) {
      return {
        grayscale: false,
        dpi300: false, 
        size3MB: false,
        errors: [`Error en verificación: ${error.message}`]
      };
    } finally {
      if (tempFile) await this.cleanupTempFile(tempFile);
    }
  }

  /**
   * 🔧 UTILIDADES
   */
  async createTempFile(buffer, suffix) {
    const tempDir = os.tmpdir();
    const tempFileName = `pdf_process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${suffix}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    await fs.writeFile(tempFilePath, buffer);
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
   * 📊 VERIFICAR HERRAMIENTAS DISPONIBLES
   */
  async checkTools() {
    const tools = {
      ghostscript: false,
      pdfimages: false,
      available: false
    };

    try {
      await execAsync('gs --version');
      tools.ghostscript = true;
    } catch {}

    try {
      await execAsync('pdfimages -help');
      tools.pdfimages = true;
    } catch {}

    tools.available = tools.ghostscript && tools.pdfimages;
    return tools;
  }

  /**
   * 📋 REPORTE DE PROCESAMIENTO
   */
  generateProcessingReport(result) {
    const { originalSize, processedSize, compressionRatio, optimizations, verification } = result;
    
    let report = `\n📋 REPORTE DE PROCESAMIENTO PDF\n`;
    report += `====================================\n`;
    report += `📏 Tamaño original: ${(originalSize / (1024*1024)).toFixed(2)} MB\n`;
    report += `📏 Tamaño procesado: ${(processedSize / (1024*1024)).toFixed(2)} MB\n`;
    report += `🗜️ Compresión: ${compressionRatio}\n\n`;

    report += `✨ OPTIMIZACIONES APLICADAS:\n`;
    optimizations.forEach(opt => report += `  • ${opt}\n`);

    report += `\n✅ VERIFICACIÓN FINAL:\n`;
    report += `  • Escala grises 8-bit: ${verification.grayscale ? '✅' : '❌'}\n`;
    report += `  • Resolución 300 DPI: ${verification.dpi300 ? '✅' : '❌'}\n`;
    report += `  • Tamaño ≤ 3 MB: ${verification.size3MB ? '✅' : '❌'}\n`;

    if (verification.errors.length > 0) {
      report += `\n⚠️ ADVERTENCIAS:\n`;
      verification.errors.forEach(error => report += `  • ${error}\n`);
    }

    return report;
  }
}

// Instancia singleton
export const pdfProcessor = new PDFProcessor();