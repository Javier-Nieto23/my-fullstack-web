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
        '-sProcessColorModel=DeviceGray', // Forzar escala de grises
        '-sColorConversionStrategy=Gray', // Estrategia de conversión
        '-dProcessColorModel=/DeviceGray', // Modelo de color dispositivo
        '-dOverrideICC=true', // Sobrescribir perfiles de color
        '-dCompatibilityLevel=1.4',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-r300', // 300 DPI fijo
        // Configuración agresiva de imágenes
        '-dDownsampleColorImages=true',
        '-dDownsampleGrayImages=true',
        '-dDownsampleMonoImages=true',
        '-dColorImageResolution=300',
        '-dGrayImageResolution=300', 
        '-dMonoImageResolution=300',
        '-dColorImageDownsampleType=/Bicubic',
        '-dGrayImageDownsampleType=/Bicubic',
        '-dMonoImageDownsampleType=/Bicubic',
        // Forzar resampling de todas las imágenes
        '-dColorImageDownsampleThreshold=1.0',
        '-dGrayImageDownsampleThreshold=1.0',
        '-dMonoImageDownsampleThreshold=1.0',
        // Optimizaciones adicionales
        '-dDetectDuplicateImages=true',
        '-dCompressFonts=true',
        '-dSubsetFonts=true',
        '-dEmbedAllFonts=true',
        '-dAutoRotatePages=/None',
        '-dPDFSETTINGS=/prepress', // Configuración prepress para máxima calidad
        // Configuraciones de color específicas
        '-dConvertCMYKImagesToRGB=false',
        '-dConvertImagesToIndexed=false',
        '-dUseFlateCompression=true',
        `-sOutputFile=${outputPath}`,
        inputPath
      ].join(' ');

      await execAsync(gsCommand);
      optimizations.push('Conversión forzada a escala de grises DeviceGray');
      optimizations.push('Resolución normalizada a 300 DPI con resampling');
      optimizations.push('Compresión optimizada prepress');

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
        // Forzar rasterización de imágenes
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
        // Forzar conversión total
        '-dConvertCMYKImagesToRGB=false',
        '-dAutoFilterColorImages=false',
        '-dAutoFilterGrayImages=false',
        '-dEncodeColorImages=true',
        '-dEncodeGrayImages=true',
        '-dColorImageFilter=/DCTEncode',
        '-dGrayImageFilter=/DCTEncode',
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