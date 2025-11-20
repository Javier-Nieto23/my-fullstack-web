// Script de diagnóstico específico para analizar PDFs problemáticos
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

async function diagnosticoPDFCompleto(pdfPath) {
  console.log('🔍 DIAGNÓSTICO COMPLETO DEL PDF');
  console.log('='.repeat(50));
  console.log(`📄 Archivo: ${path.basename(pdfPath)}`);
  
  try {
    // 1. Información básica del archivo
    const stats = await fs.stat(pdfPath);
    console.log(`📏 Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // 2. Información del PDF con pdfinfo
    console.log('\n📊 INFORMACIÓN PDF (pdfinfo):');
    try {
      const { stdout: pdfInfo } = await execAsync(`pdfinfo "${pdfPath}"`);
      console.log(pdfInfo);
    } catch (err) {
      console.log('⚠️ No se pudo obtener info del PDF:', err.message);
    }

    // 3. Análisis de imágenes con pdfimages
    console.log('\n🖼️ ANÁLISIS DE IMÁGENES (pdfimages):');
    try {
      const { stdout: imageList } = await execAsync(`pdfimages -list "${pdfPath}"`);
      console.log(imageList);
      
      // Parsear y analizar cada imagen
      const lines = imageList.split('\n').slice(2).filter(line => /^\s*\d+/.test(line));
      console.log(`\n📈 RESUMEN DE IMÁGENES: ${lines.length} imágenes encontradas`);
      
      lines.forEach((line, index) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          const color = parts[5];
          const bpc = parts[6];
          const xDpi = parts[10];
          const yDpi = parts[11];
          
          const problemas = [];
          if (color !== 'gray') problemas.push(`Color: ${color} (requiere gray)`);
          if (parseInt(bpc) !== 8) problemas.push(`BPC: ${bpc} (requiere 8)`);
          if (parseInt(xDpi) < 300) problemas.push(`X-DPI: ${xDpi} (requiere 300)`);
          if (parseInt(yDpi) < 300) problemas.push(`Y-DPI: ${yDpi} (requiere 300)`);
          
          console.log(`  Imagen ${index + 1}: ${problemas.length > 0 ? '❌' : '✅'} ${problemas.join(', ') || 'OK'}`);
        }
      });
      
    } catch (err) {
      console.log('⚠️ No se pudo analizar imágenes:', err.message);
    }

    // 4. Estructura del PDF con mutool
    console.log('\n🏗️ ESTRUCTURA PDF (mutool):');
    try {
      const { stdout: objects } = await execAsync(`mutool show "${pdfPath}" trailer`);
      console.log('Objetos principales encontrados:');
      
      // Buscar problemas comunes
      if (objects.includes('AcroForm')) console.log('⚠️ Contiene formularios (AcroForm)');
      if (objects.includes('JavaScript')) console.log('⚠️ Contiene JavaScript');
      if (objects.includes('EmbeddedFiles')) console.log('⚠️ Contiene archivos embebidos');
      if (objects.includes('Encrypt')) console.log('⚠️ PDF cifrado');
      
    } catch (err) {
      console.log('⚠️ No se pudo analizar estructura:', err.message);
    }

    // 5. Prueba de conversión simple
    console.log('\n🧪 PRUEBA DE CONVERSIÓN SIMPLE:');
    try {
      const tempOutput = pdfPath.replace('.pdf', '_test_conversion.pdf');
      
      const gsCommand = `gs -sDEVICE=pdfwrite -dNOPAUSE -dQUIET -dBATCH -sColorConversionStrategy=Gray -dProcessColorModel=/DeviceGray -sOutputFile="${tempOutput}" "${pdfPath}"`;
      
      console.log('🔄 Ejecutando conversión de prueba...');
      await execAsync(gsCommand);
      
      const testStats = await fs.stat(tempOutput);
      console.log(`✅ Conversión exitosa - Tamaño resultante: ${(testStats.size / 1024).toFixed(2)} KB`);
      
      // Analizar resultado
      const { stdout: testImageList } = await execAsync(`pdfimages -list "${tempOutput}"`);
      console.log('\n🔍 Imágenes después de conversión de prueba:');
      console.log(testImageList);
      
      // Limpiar archivo temporal
      await fs.unlink(tempOutput);
      
    } catch (convErr) {
      console.log('❌ Error en conversión de prueba:', convErr.message);
    }

    // 6. Verificación de herramientas disponibles
    console.log('\n🔧 HERRAMIENTAS DISPONIBLES:');
    const tools = ['gs', 'pdfimages', 'pdfinfo', 'mutool', 'convert'];
    
    for (const tool of tools) {
      try {
        await execAsync(`which ${tool}`);
        console.log(`✅ ${tool} disponible`);
      } catch {
        console.log(`❌ ${tool} NO disponible`);
      }
    }

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

// Usar con: node diagnostico.cjs ruta/al/archivo.pdf
const pdfPath = process.argv[2];

if (!pdfPath) {
  console.log('Uso: node diagnostico.cjs <ruta-al-pdf>');
  process.exit(1);
}

diagnosticoPDFCompleto(pdfPath);