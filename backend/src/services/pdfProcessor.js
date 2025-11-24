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
      
      const timestamp = Date.now() + Math.random().toString(36).substr(2, 9);
      const tempInputFile = path.join(tempDir, `input_${timestamp}.pdf`);
      const tempOutputFile = path.join(tempDir, `output_${timestamp}.pdf`);

      // Escribir buffer a archivo temporal
      await fs.writeFile(tempInputFile, inputBuffer);
      console.log(`📝 Archivo temporal creado: ${tempInputFile} (${(inputBuffer.length / 1024).toFixed(2)}KB)`);

      // Verificar que el archivo se escribió correctamente
      const inputStats = await fs.stat(tempInputFile);
      if (inputStats.size !== inputBuffer.length) {
        throw new Error(`Error escribiendo archivo temporal: tamaño esperado ${inputBuffer.length}, encontrado ${inputStats.size}`);
      }

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
   * Versión mejorada con validaciones automáticas
   */
  async simpleGrayscaleOnly(inputPath, outputPath) {
    console.log('🎯 Convirtiendo a escala de grises con 300 DPI + validaciones automáticas...');

    try {
      // 🔍 PRE-VALIDACIÓN: Verificar que no sea página en blanco
      console.log('🔍 Verificando contenido del PDF...');
      try {
        const { stdout: textContent } = await execAsync(`pdftotext "${inputPath}" -`);
        const textLength = textContent.trim().length;
        
        if (textLength < 10) {
          console.log('⚠️ ADVERTENCIA: PDF parece contener muy poco texto (posible OCR o página en blanco)');
        } else {
          console.log(`✅ PDF contiene texto suficiente (${textLength} caracteres)`);
        }
      } catch (err) {
        console.log('⚠️ No se pudo analizar texto del PDF:', err.message);
      }

      // 🔍 VERIFICACIÓN: Detectar código embebido
      try {
        const { stdout: pdfInfo } = await execAsync(`mutool info "${inputPath}"`);
        if (pdfInfo.toLowerCase().includes('javascript')) {
          throw new Error('❌ PDF RECHAZADO: Contiene JavaScript embebido (no permitido)');
        }
        console.log('✅ PDF libre de código JavaScript');
      } catch (err) {
        if (err.message.includes('JavaScript')) throw err;
        console.log('⚠️ No se pudo verificar JavaScript:', err.message);
      }

      // 🔍 DIAGNÓSTICO ANTES: Ver imágenes originales
      console.log('🔍 DIAGNÓSTICO ANTES de conversión:');
      try {
        const { stdout: beforeImages } = await execAsync(`pdfimages -list "${inputPath}"`);
        console.log('📊 Imágenes ANTES:\n', beforeImages);
      } catch (err) {
        console.log('⚠️ No se pudo analizar imágenes originales:', err.message);
      }

      // 🔄 CONVERSIÓN AUTOMÁTICA: Ghostscript con rasterización completa
      console.log('🔄 ¡CONVERSIÓN AUTOMÁTICA! - Aplicando escala de grises 8-bit a 300 DPI...');
      const gsCommand = [
        "gs",
        "-sDEVICE=pdfwrite",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dSAFER",

        // 🔥 CONVERSIÓN AUTOMÁTICA A ESCALA DE GRISES (Método corregido)
        "-dProcessColorModel=/DeviceGray",
        "-dColorConversionStrategy=/Gray",
        "-dOverrideICC",                     // ← Ignorar perfiles ICC

        // 🔄 CONVERSIÓN AUTOMÁTICA A 300 DPI
        "-r300",
        "-dPDFSETTINGS=/prepress",
        
        // 🔧 Upsampling agresivo para DPI bajo
        "-dUpsampleColorImages=true",
        "-dUpsampleGrayImages=true",
        "-dColorImageResolution=300",
        "-dGrayImageResolution=300",

        // 🔧 Forzar que TODAS las imágenes pasen por filtro
        "-dAutoFilterColorImages=false",
        "-dAutoFilterGrayImages=false",
        "-dColorImageFilter=/FlateEncode",
        "-dGrayImageFilter=/FlateEncode",

        // 🖼 CONVERSIÓN AUTOMÁTICA A 8-BIT
        "-dColorImageDepth=8",
        "-dGrayImageDepth=8",

        // 🛠 Archivo resultante
        `-sOutputFile=${outputPath}`,
        inputPath
      ].join(" ");

      console.log('🔧 Comando Ghostscript (CONVERSIÓN AUTOMÁTICA):', gsCommand);
      
      const startTime = Date.now();
      
      try {
        const { stdout: gsOutput, stderr: gsError } = await execAsync(gsCommand);
        const endTime = Date.now();
        
        if (gsOutput) console.log('📝 Salida GS:', gsOutput);
        if (gsError && gsError.trim()) {
          console.log('⚠️ Mensajes GS:', gsError);
          // Solo considerar como error si contiene palabras clave de error real
          if (gsError.toLowerCase().includes('error') || gsError.toLowerCase().includes('failed')) {
            throw new Error(`Ghostscript error: ${gsError}`);
          }
        }
        
        console.log(`⏱️ Tiempo de conversión automática: ${((endTime - startTime) / 1000).toFixed(2)}s`);

        // Verificar que el archivo se generó correctamente
        const stats = await fs.stat(outputPath);
        if (stats.size === 0) {
          throw new Error('El archivo procesado está vacío');
          
        }

        console.log(`📦 Archivo generado: ${(stats.size / 1024).toFixed(2)}KB`);
        
        // 🔍 POST-VALIDACIÓN: Verificar que no quede como página en blanco
        try {
          const { stdout: finalText } = await execAsync(`pdftotext "${outputPath}" -`);
          if (finalText.trim().length < 5) {
            console.log('⚠️ ADVERTENCIA: PDF procesado tiene muy poco texto visible');
          } else {
            console.log('✅ PDF procesado mantiene contenido de texto');
          }
        } catch (err) {
          console.log('⚠️ No se pudo verificar texto final:', err.message);
        }

        // 🔍 DIAGNÓSTICO DESPUÉS: Ver imágenes procesadas
        console.log('🔍 DIAGNÓSTICO DESPUÉS de conversión automática:');
        try {
          const { stdout: afterImages } = await execAsync(`pdfimages -list "${outputPath}"`);
          console.log('📊 Imágenes DESPUÉS (AUTOMÁTICO):\n', afterImages);
          
          // Verificar que se aplicó la conversión
          if (afterImages.includes('color') && !afterImages.includes('gray')) {
            console.log('⚠️ ADVERTENCIA: Algunas imágenes podrían seguir en color');
          } else {
            console.log('✅ CONVERSIÓN EXITOSA: Imágenes convertidas a escala de grises');
          }
        } catch (err) {
          console.log('⚠️ No se pudo analizar imágenes procesadas:', err.message);
        }

        console.log(`✅ ¡CONVERSIÓN AUTOMÁTICA COMPLETA! - Tamaño final: ${(stats.size / 1024).toFixed(2)}KB`);
        return { success: true };
        
      } catch (execError) {
        const endTime = Date.now();
        console.error('❌ Error detallado en Ghostscript:');
        console.error('Comando:', gsCommand);
        console.error('Error:', execError.message);
        console.error('Tiempo transcurrido:', `${((endTime - startTime) / 1000).toFixed(2)}s`);
        
        // Verificar si el archivo temporal de entrada existe
        try {
          const inputStats = await fs.stat(inputPath);
          console.log(`📄 Archivo de entrada: ${(inputStats.size / 1024).toFixed(2)}KB`);
        } catch (inputError) {
          console.error('❌ Archivo de entrada no encontrado:', inputError.message);
        }
        
        throw new Error(`Fallo en conversión Ghostscript: ${execError.message}`);
      }

    } catch (error) {
      console.error('❌ Error en conversión automática:', error);
      throw new Error(`Error en conversión automática: ${error.message}`);
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