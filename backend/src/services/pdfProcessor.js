import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

class PDFProcessor {
  constructor() {
    this.maxSizeBytes = 3 * 1024 * 1024; // 3MB
  }

  /**
   * 🎯 PROCESAMIENTO PRINCIPAL DE PDF
   * Punto de entrada principal para procesar documentos
   */
  async processPDF(inputBuffer, filename = 'document.pdf') {
    console.log(`📄 Iniciando procesamiento: ${filename}`);

    try {
      // Crear archivos temporales
      const tempDir = '/tmp/pdf-processing';
      await this.ensureDirectoryExists(tempDir);
      
      const timestamp = Date.now();
      const tempInputFile = path.join(tempDir, `input_${timestamp}.pdf`);
      const tempOutputFile = path.join(tempDir, `output_${timestamp}.pdf`);

      // Escribir buffer a archivo temporal
      await fs.writeFile(tempInputFile, inputBuffer);
      console.log('📝 Archivo temporal creado');

      // 🎯 PROCESAMIENTO SIMPLIFICADO: Solo escala de grises por ahora
      const processResult = await this.simpleGrayscaleOnly(tempInputFile, tempOutputFile);

      // Leer archivo procesado
      const processedBuffer = await fs.readFile(tempOutputFile);
      console.log('✅ Archivo procesado y leído');

      // Limpiar archivos temporales
      await this.cleanupFiles([tempInputFile, tempOutputFile]);

      return {
        success: true,
        processedBuffer,
        originalSize: inputBuffer.length,
        processedSize: processedBuffer.length,
        optimizations: ['✅ Conversión a escala de grises aplicada']
      };

    } catch (error) {
      console.error('❌ Error en procesamiento:', error);
      throw new Error(`Error procesando PDF: ${error.message}`);
    }
  }

  /**
   * 🎯 MÉTODO SIMPLIFICADO: Solo conversión a escala de grises
   * Paso a paso - implementación básica y robusta
   */
  async simpleGrayscaleOnly(inputPath, outputPath) {
    console.log('🎯 Convirtiendo a escala de grises con 300 DPI (método Ghostscript puro)...');

    try {
      // 🔍 DIAGNÓSTICO ANTES: Ver imágenes originales
      console.log('🔍 DIAGNÓSTICO ANTES de conversión:');
      try {
        const { stdout: beforeImages } = await execAsync(`pdfimages -list "${inputPath}"`);
        console.log('📊 Imágenes ANTES:\n', beforeImages);
      } catch (err) {
        console.log('⚠️ No se pudo analizar imágenes originales:', err.message);
      }

      // 🔄 ESTRATEGIA: Ghostscript con rasterización completa y recreación
      console.log('🔄 Aplicando conversión completa con rasterización...');
      
      const gsCommand = [
        'gs',
        '-sDEVICE=pdfwrite',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-dSAFER',
        '-sColorConversionStrategy=Gray',       // Convertir a escala de grises
        '-dProcessColorModel=/DeviceGray',      // Forzar modelo gris
        '-dCompatibilityLevel=1.4',             // PDF compatible
        '-r300',                                // RESOLUCIÓN GLOBAL 300 DPI
        '-dPDFSETTINGS=/prepress',             // Configuración de alta calidad
        '-dColorImageResolution=300',           // Imágenes color a 300 DPI
        '-dGrayImageResolution=300',            // Imágenes grises a 300 DPI  
        '-dMonoImageResolution=300',            // Imágenes mono a 300 DPI
        '-dDownsampleColorImages=true',         // Habilitar resampling
        '-dDownsampleGrayImages=true',          // Habilitar resampling
        '-dDownsampleMonoImages=true',          // Habilitar resampling
        '-dColorImageDownsampleType=/Bicubic',  // Interpolación de calidad
        '-dGrayImageDownsampleType=/Bicubic',   // Interpolación de calidad
        '-dMonoImageDownsampleType=/Bicubic',   // Interpolación de calidad
        '-dColorImageDownsampleThreshold=0.1',  // Threshold muy bajo para forzar resampling
        '-dGrayImageDownsampleThreshold=0.1',   // Threshold muy bajo para forzar resampling
        '-dMonoImageDownsampleThreshold=0.1',   // Threshold muy bajo para forzar resampling
        '-dUpsampleColorImages=true',           // FORZAR UPSAMPLING de imágenes color
        '-dUpsampleGrayImages=true',            // FORZAR UPSAMPLING de imágenes grises
        '-dUpsampleMonoImages=true',            // FORZAR UPSAMPLING de imágenes mono
        '-dColorImageDepth=8',                  // 8 bits por canal
        '-dGrayImageDepth=8',                   // 8 bits grises
        '-dAutoRotatePages=/None',              // Sin rotación automática
        '-dOptimize=true',                      // Optimizar salida
        `-sOutputFile=${outputPath}`,
        inputPath
      ].join(' ');

      console.log('🔧 Comando Ghostscript completo:', gsCommand);
      
      const startTime = Date.now();
      const { stdout: gsOutput, stderr: gsError } = await execAsync(gsCommand);
      const endTime = Date.now();
      
      if (gsOutput) console.log('📝 Salida GS:', gsOutput);
      if (gsError) console.log('⚠️ Errores GS:', gsError);
      
      console.log(`⏱️ Tiempo de conversión: ${((endTime - startTime) / 1000).toFixed(2)}s`);

      // Verificar que el archivo se generó correctamente
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('El archivo procesado está vacío');
      }

      // 🔍 DIAGNÓSTICO DESPUÉS: Ver imágenes procesadas
      console.log('🔍 DIAGNÓSTICO DESPUÉS de conversión:');
      try {
        const { stdout: afterImages } = await execAsync(`pdfimages -list "${outputPath}"`);
        console.log('📊 Imágenes DESPUÉS:\n', afterImages);
      } catch (err) {
        console.log('⚠️ No se pudo analizar imágenes procesadas:', err.message);
      }

      console.log(`✅ Conversión completa - Tamaño final: ${(stats.size / 1024).toFixed(2)}KB`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error en conversión completa:', error);
      throw new Error(`Error en conversión: ${error.message}`);
    }
  }

  /**
   * 🎯 MÉTODO PLACEHOLDER PARA COMPATIBILIDAD
   * Este método será usado por el endpoint principal
   */
  async optimizePDF(inputPath, outputPath) {
    console.log('🎯 Usando método simplificado de conversión a escala de grises...');
    
    try {
      // Por ahora delegamos al método simple - paso a paso
      await this.simpleGrayscaleOnly(inputPath, outputPath);
      
      return {
        success: true,
        optimizations: ['✅ Conversión básica a escala de grises aplicada (método simplificado)']
      };
    } catch (error) {
      console.error('❌ Error en conversión:', error);
      throw new Error(`Fallo en conversión: ${error.message}`);
    }
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

  /**
   * 📊 VALIDACIÓN BÁSICA DE PDF
   */
  async validatePDFStructure(filePath) {
    try {
      // Verificar que es un PDF válido usando pdfinfo
      const { stdout } = await execAsync(`pdfinfo "${filePath}"`);
      return stdout.includes('PDF version');
    } catch (error) {
      console.warn('⚠️ Validación PDF falló:', error.message);
      return false;
    }
  }
}

export default PDFProcessor;