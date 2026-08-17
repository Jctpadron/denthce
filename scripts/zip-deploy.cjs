const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '..', 'aws', 'scripts', 'build-backend');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const zipPath = path.resolve(__dirname, '..', `hce-backend-aws-${timestamp}.zip`);

const archiver = require('archiver');
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`ZIP: ${path.basename(zipPath)} (${(archive.pointer() / 1024).toFixed(0)} KB)`);
});

archive.on('error', (err) => { throw err; });
archive.pipe(output);
archive.directory(sourceDir, false);
archive.finalize();
