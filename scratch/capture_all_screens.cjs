const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\283f9b55-16b8-47e6-b895-0edb0a00e597';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureAllScreenshots() {
  console.log('🚀 Launching Chrome to capture full-screen screenshots of every screen and tab...');

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--window-size=1920,1080'
    ]
  });

  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  // ── SCREEN 1: Home Page (Boot Diagnostic / Arc Reactor Screen) ───────────
  console.log('📸 Navigating to Home Page...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await sleep(3500);

  const screen1Path = path.join(ARTIFACTS_DIR, 'screen_01_home_boot.png');
  await page.screenshot({ path: screen1Path, fullPage: true });
  console.log(`✅ Saved Screen 1: ${screen1Path}`);

  // Click ENGAGE J.A.R.V.I.S to enter workspace
  console.log('⚡ Engaging J.A.R.V.I.S into Workspace...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const engage = btns.find((b) => b.textContent && b.textContent.includes('ENGAGE J.A.R.V.I.S'));
    if (engage) engage.click();
  });
  await sleep(3000);

  // Helper to click tab by label
  async function clickTabByText(tabText) {
    await page.evaluate((text) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const tab = btns.find((b) => b.textContent && b.textContent.toUpperCase().includes(text.toUpperCase()));
      if (tab) tab.click();
    }, tabText);
    await sleep(2000);
  }

  // ── SCREEN 2: Workspace - ARC HUD Tab ────────────────────────────────────
  console.log('📸 Capturing Screen 2: ARC HUD Tab...');
  await clickTabByText('ARC HUD');
  const screen2Path = path.join(ARTIFACTS_DIR, 'screen_02_workspace_arc.png');
  await page.screenshot({ path: screen2Path, fullPage: true });
  console.log(`✅ Saved Screen 2: ${screen2Path}`);

  // ── SCREEN 3: Workspace - ASSISTANT Tab ──────────────────────────────────
  console.log('📸 Capturing Screen 3: ASSISTANT Tab (Chat & Voice)...');
  await clickTabByText('ASSISTANT');
  const screen3Path = path.join(ARTIFACTS_DIR, 'screen_03_workspace_assistant.png');
  await page.screenshot({ path: screen3Path, fullPage: true });
  console.log(`✅ Saved Screen 3: ${screen3Path}`);

  // ── SCREEN 4: Workspace - WORKSPACE Multi-panel Tab ──────────────────────
  console.log('📸 Capturing Screen 4: WORKSPACE Multi-panel Tab...');
  await clickTabByText('WORKSPACE');
  const screen4Path = path.join(ARTIFACTS_DIR, 'screen_04_workspace_panels.png');
  await page.screenshot({ path: screen4Path, fullPage: true });
  console.log(`✅ Saved Screen 4: ${screen4Path}`);

  // ── SCREEN 5: Workspace - PC APPS Tab ────────────────────────────────────
  console.log('📸 Capturing Screen 5: PC APPS Matrix Tab...');
  await clickTabByText('PC APPS');
  const screen5Path = path.join(ARTIFACTS_DIR, 'screen_05_workspace_apps.png');
  await page.screenshot({ path: screen5Path, fullPage: true });
  console.log(`✅ Saved Screen 5: ${screen5Path}`);

  // ── SCREEN 6: Workspace - APPROVALS Security Gate Tab ────────────────────
  console.log('📸 Capturing Screen 6: APPROVALS Security Gate Tab...');
  await clickTabByText('APPROVALS');
  const screen6Path = path.join(ARTIFACTS_DIR, 'screen_06_workspace_approvals.png');
  await page.screenshot({ path: screen6Path, fullPage: true });
  console.log(`✅ Saved Screen 6: ${screen6Path}`);

  // ── SCREEN 7: Workspace - TELEMETRY Tab ──────────────────────────────────
  console.log('📸 Capturing Screen 7: TELEMETRY Tab...');
  await clickTabByText('TELEMETRY');
  const screen7Path = path.join(ARTIFACTS_DIR, 'screen_07_workspace_telemetry.png');
  await page.screenshot({ path: screen7Path, fullPage: true });
  console.log(`✅ Saved Screen 7: ${screen7Path}`);

  // ── SCREEN 8: Config / SETTINGS Page ─────────────────────────────────────
  console.log('📸 Capturing Screen 8: SETTINGS / Configuration Page...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const configBtn = btns.find((b) => b.textContent && b.textContent.includes('Config'));
    if (configBtn) configBtn.click();
  });
  await sleep(2500);

  const screen8Path = path.join(ARTIFACTS_DIR, 'screen_08_settings.png');
  await page.screenshot({ path: screen8Path, fullPage: true });
  console.log(`✅ Saved Screen 8: ${screen8Path}`);

  console.log('🎉 All 8 full-screen screenshots captured successfully!');
  await sleep(2000);
  await browser.close();
}

captureAllScreenshots().catch((err) => {
  console.error('❌ Error capturing screenshots:', err);
  process.exit(1);
});
