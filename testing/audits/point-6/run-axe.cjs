const fs = require('fs');
const path = require('path');
const puppeteer = require('../../..//hce-frontend/node_modules/puppeteer');
const axe = require('../../..//hce-frontend/node_modules/axe-core');

const url = process.env.AUDIT_URL || 'http://127.0.0.1:4173/';
const outDir = __dirname;
const viewports = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900 },
];

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const summary = [];
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage();
      await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('#root', { timeout: 30000 });
      await new Promise((resolve) => setTimeout(resolve, 9000));
      await page.screenshot({ path: path.join(outDir, `axe-${viewport.name}.png`), fullPage: true });

      await page.evaluate(axe.source);
      const results = await page.evaluate(async () => {
        return window.axe.run(document, {
          resultTypes: ['violations', 'incomplete', 'passes'],
        });
      });
      const reportPath = path.join(outDir, `axe-${viewport.name}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
      summary.push({
        viewport: viewport.name,
        url: results.url,
        violations: results.violations.length,
        incomplete: results.incomplete.length,
        passes: results.passes.length,
        violationIds: results.violations.map((v) => `${v.id}:${v.nodes.length}`),
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(outDir, 'axe-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
