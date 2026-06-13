const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '../..');
const backendDir = path.join(rootDir, 'hce-backend');
const awsDir = path.join(rootDir, 'aws');
const buildDir = path.join(awsDir, 'scripts', 'build-backend');

// Helper para copiar recursivamente
function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  fs.readdirSync(from).forEach(element => {
    const stat = fs.lstatSync(path.join(from, element));
    if (stat.isFile()) {
      fs.copyFileSync(path.join(from, element), path.join(to, element));
    } else if (stat.isDirectory()) {
      copyFolderSync(path.join(from, element), path.join(to, element));
    }
  });
}

async function run() {
  console.log("🚀 Iniciando empaquetado del backend HCE para AWS...");

  // 1. Limpiar o crear build-backend
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
  fs.mkdirSync(buildDir, { recursive: true });

  // 2. Copiar archivos
  console.log("Copiando dist...");
  copyFolderSync(path.join(backendDir, 'dist'), path.join(buildDir, 'dist'));

  console.log("Copiando package.json y package-lock.json...");
  fs.copyFileSync(path.join(backendDir, 'package.json'), path.join(buildDir, 'package.json'));
  fs.copyFileSync(path.join(backendDir, 'package-lock.json'), path.join(buildDir, 'package-lock.json'));

  // Copiar configs de Beanstalk
  const procfilePath = path.join(awsDir, 'backend', 'Procfile');
  if (fs.existsSync(procfilePath)) {
    console.log("Copiando Procfile...");
    fs.copyFileSync(procfilePath, path.join(buildDir, 'Procfile'));
  }

  const ebExtensionsDir = path.join(awsDir, 'backend', '.ebextensions');
  if (fs.existsSync(ebExtensionsDir)) {
    console.log("Copiando .ebextensions...");
    copyFolderSync(ebExtensionsDir, path.join(buildDir, '.ebextensions'));
  }

  // 3. Crear el archivo ZIP usando tar.exe de Windows
  const timestamp = new Date().toISOString().replace(/T/, '-').replace(/\..+/, '').replace(/:/g, '');
  const zipName = `hce-backend-aws-${timestamp}.zip`;
  const zipPath = path.join(awsDir, 'scripts', zipName);

  console.log(`Generando archivo ZIP en: ${zipPath}`);
  
  try {
    // Usamos tar.exe que soporta el formato zip nativamente en Windows 10/11 con la opción -a
    // -a o --auto-compress determina el formato basándose en la extensión (zip)
    // Cambiamos de directorio temporalmente usando Cwd
    execSync(`tar -a -c -f "${zipPath}" *`, { cwd: buildDir });
    console.log(`✅ ¡Paquete creado con éxito! Nombre: ${zipName}`);
    console.log(`Sube este archivo ZIP a tu consola de AWS Elastic Beanstalk.`);
  } catch (error) {
    console.error("❌ Error al comprimir el archivo ZIP:", error.message);
    process.exit(1);
  }
}

run();
