const Archiver = require('archiver').Archiver;
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'aws', 'scripts', 'build-backend');
const ts = new Date().toISOString().replace(/[:]/g, '-').slice(0, 19);
const zp = path.join(root, `hce-backend-aws-${ts}.zip`);

console.log('Source:', src);
console.log('Target:', zp);

const out = fs.createWriteStream(zp);
const a = new Archiver('zip', { zlib: { level: 9 } });

out.on('close', () => {
  console.log(`OK: ${path.basename(zp)} (${(a.pointer() / 1024).toFixed(0)} KB)`);
});
a.on('error', (e) => { throw e; });
a.pipe(out);
a.directory(src, false);
a.finalize();
