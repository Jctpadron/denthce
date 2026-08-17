const { execFileSync } = require('child_process');
const path = require('path');

const url = process.env.AUDIT_URL || 'http://127.0.0.1:4173/';
const root = path.resolve(__dirname, '../../..');
const frontend = path.join(root, 'hce-frontend');
const lighthouseCli = path.join(frontend, 'node_modules', 'lighthouse', 'cli', 'index.js');

const runs = [
  {
    name: 'mobile',
    args: [
      '--form-factor=mobile',
      '--screenEmulation.mobile=true',
      '--screenEmulation.width=390',
      '--screenEmulation.height=844',
      '--screenEmulation.deviceScaleFactor=2',
    ],
  },
  {
    name: 'desktop',
    args: [
      '--preset=desktop',
      '--form-factor=desktop',
      '--screenEmulation.mobile=false',
      '--screenEmulation.width=1280',
      '--screenEmulation.height=900',
      '--screenEmulation.deviceScaleFactor=1',
    ],
  },
];

function hasReports(outputPath) {
  return fsExists(`${outputPath}.report.json`) && fsExists(`${outputPath}.report.html`);
}

function fsExists(file) {
  try {
    require('fs').accessSync(file);
    return true;
  } catch {
    return false;
  }
}

for (const run of runs) {
  const outputPath = path.join(__dirname, `lighthouse-${run.name}`);
  const args = [
    lighthouseCli,
    url,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--output=json',
    '--output=html',
    `--output-path=${outputPath}`,
    '--quiet',
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
    ...run.args,
  ];

  console.log(`Running Lighthouse ${run.name} for ${url}`);
  try {
    execFileSync(process.execPath, args, { cwd: frontend, stdio: 'inherit' });
  } catch {
    if (hasReports(outputPath)) {
      console.warn(`Lighthouse ${run.name} report was generated; ignored Chrome profile cleanup warning.`);
      continue;
    }
    throw new Error(`Lighthouse ${run.name} failed before writing reports.`);
  }
}
