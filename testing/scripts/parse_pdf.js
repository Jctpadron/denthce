const fs = require('fs');
const path = require('path');
const pdfParseExport = require('pdf-parse');

console.log('Export de pdf-parse:', typeof pdfParseExport, pdfParseExport);

const pdfPath = path.join(__dirname, 'test_odontologia.pdf');
const dataBuffer = fs.readFileSync(pdfPath);

const parse = typeof pdfParseExport === 'function' ? pdfParseExport : pdfParseExport.default || pdfParseExport;

parse(dataBuffer).then(function(data) {
  console.log('--- TEXTO DEL PDF EXTRAÍDO ---');
  console.log(data.text);
  console.log('------------------------------');
  
  console.log('\n--- VERIFICACIÓN DE PALABRAS CLAVE ---');
  const textLower = data.text.toLowerCase();
  
  const pamiCount = (textLower.match(/pami/g) || []).length;
  console.log(`Palabra "PAMI": ${pamiCount} ocurrencias.`);
  
  // Buscar líneas que contengan PAMI
  const lines = data.text.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('pami')) {
      console.log(`  Línea ${idx + 1}: "${line.trim()}"`);
    }
  });
}).catch(err => {
  console.error('Error al parsear el PDF:', err);
});
