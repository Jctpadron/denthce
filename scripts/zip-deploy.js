const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const sourceDir = path.resolve(__dirname, '..', 'aws', 'scripts', 'build-backend');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const zipPath = path.resolve(__dirname, '..', `hce-backend-aws-${timestamp}.zip`);

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`ZIP created: ${zipPath} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
});

archive.on('error', (err) => { throw err; });

archive.pipe(output);
archive.directory(sourceDir, false);
archive.finalize();
