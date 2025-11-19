// Script de prueba local para verificar PDFProcessor
const fs = require('fs').promises;
const path = require('path');
const PDFProcessor = require('./src/services/pdfProcessor');

async function testPDFProcessor() {
  console.log('🧪 INICIANDO PRUEBA LOCAL DEL PDF PROCESSOR');
  console.log('='.repeat(50));

  try {
    const processor = new PDFProcessor();
    
    // Buscar el archivo de prueba
    const testFile = 'Manifestacion Valor.pdf';
    const testFilePath = path.join(__dirname, testFile);
    
    console.log(`📂 Buscando archivo de prueba: ${testFile}`);
    
    try {
      await fs.access(testFilePath);
      console.log('✅ Archivo de prueba encontrado');
    } catch (error) {
      console.log('❌ Archivo de prueba no encontrado en el directorio backend');
      console.log('📁 Archivos disponibles:');
      
      const files = await fs.readdir(__dirname);
      files.forEach(file => {
        if (file.endsWith('.pdf')) {
          console.log(`   - ${file}`);
        }
      });
      return;
    }

    // Leer archivo
    console.log('📖 Leyendo archivo...');
    const inputBuffer = await fs.readFile(testFilePath);
    console.log(`📏 Tamaño original: ${(inputBuffer.length / 1024).toFixed(2)} KB`);

    // Procesar PDF
    console.log('🔄 Iniciando procesamiento...');
    const startTime = Date.now();
    
    const result = await processor.processPDF(inputBuffer, testFile);
    
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('='.repeat(50));
    console.log('✅ PROCESAMIENTO COMPLETADO');
    console.log(`⏱️  Tiempo de procesamiento: ${processingTime} segundos`);
    console.log(`📏 Tamaño original: ${(result.originalSize / 1024).toFixed(2)} KB`);
    console.log(`📏 Tamaño procesado: ${(result.processedSize / 1024).toFixed(2)} KB`);
    console.log(`📊 Reducción: ${(((result.originalSize - result.processedSize) / result.originalSize) * 100).toFixed(2)}%`);
    console.log('🎯 Optimizaciones aplicadas:');
    
    result.optimizations.forEach(opt => {
      console.log(`   ${opt}`);
    });

    // Guardar archivo procesado para verificación
    const outputPath = path.join(__dirname, `processed_${testFile}`);
    await fs.writeFile(outputPath, result.processedBuffer);
    console.log(`💾 Archivo procesado guardado en: processed_${testFile}`);
    
    console.log('='.repeat(50));
    console.log('🎉 ¡PRUEBA COMPLETADA EXITOSAMENTE!');

  } catch (error) {
    console.error('❌ ERROR EN LA PRUEBA:', error.message);
    console.error(error.stack);
  }
}

// Ejecutar prueba
testPDFProcessor();