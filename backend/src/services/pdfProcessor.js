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
        
        // 🔥 Si TODAVÍA no cumple, aplicar rasterización completa
        const secondVerify = await this.quickImageCheck(outputPath);
        if (!secondVerify.success) {
          console.log('🔥 Aplicando rasterización completa como último recurso...');
          await this.fullRasterization(outputPath);
          optimizations.push('Rasterización completa aplicada');
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
   * 🔥🔥 RASTERIZACIÓN COMPLETA - ÚLTIMO RECURSO
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
        '-sDEVICE=png16m',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-r300', // 300 DPI
        '-dDownScaleFactor=1',
        '-dTextAlphaBits=4',
        '-dGraphicsAlphaBits=4',
        // Forzar escala de grises desde la conversión
        '-sProcessColorModel=DeviceGray',
        '-dProcessColorModel=/DeviceGray',
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
        } else {
          // Alternativa con Ghostscript
          const tempGrayFile = imageFile + '.gray';
          await execAsync([
            'gs',
            '-sDEVICE=png16m',
            '-dNOPAUSE',
            '-dQUIET',
            '-dBATCH',
            '-r300',
            '-sProcessColorModel=DeviceGray',
            '-dProcessColorModel=/DeviceGray',
            `-sOutputFile=${tempGrayFile}`,
            imageFile
          ].join(' '));
          await fs.rename(tempGrayFile, imageFile);
        }
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