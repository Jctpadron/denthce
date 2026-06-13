const fs = require('fs');
const path = require('path');

const pdfPath = path.join(__dirname, 'test_odontologia.pdf');
if (!fs.existsSync(pdfPath)) {
  console.error('El archivo no existe:', pdfPath);
  process.exit(1);
}

const buffer = fs.readFileSync(pdfPath);

function searchBuffer(buf, searchStr) {
  console.log(`\n--- Buscando "${searchStr}" en el Buffer ---`);
  
  // 1. ASCII / UTF-8
  const asciiBuf = Buffer.from(searchStr, 'ascii');
  let index = buf.indexOf(asciiBuf);
  if (index !== -1) {
    console.log(`[OK] Encontrado en ASCII en la posición ${index}`);
    return true;
  }

  // 2. UTF-16LE (Little Endian)
  const leBuf = Buffer.from(searchStr, 'utf16le');
  index = buf.indexOf(leBuf);
  if (index !== -1) {
    console.log(`[OK] Encontrado en UTF-16LE en la posición ${index}`);
    return true;
  }

  // 3. UTF-16BE (Big Endian)
  const beBytes = [];
  for (let i = 0; i < searchStr.length; i++) {
    const code = searchStr.charCodeAt(i);
    beBytes.push((code >> 8) & 0xff);
    beBytes.push(code & 0xff);
  }
  const beBuf = Buffer.from(beBytes);
  index = buf.indexOf(beBuf);
  if (index !== -1) {
    console.log(`[OK] Encontrado en UTF-16BE (Big Endian) en la posición ${index}`);
    return true;
  }

  console.log(`[X] No se encontró "${searchStr}" en ninguna de las codificaciones.`);
  return false;
}

searchBuffer(buffer, 'PAMI');
searchBuffer(buffer, 'AFILIADO');
searchBuffer(buffer, 'COBERTURA');
searchBuffer(buffer, 'ODONTOGRAMA');
