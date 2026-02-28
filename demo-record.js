/**
 * Variation Shield — Demo Video Recorder v2
 * Records: login → dashboard → create project → create variation → view variation
 * Features: visible cursor dot, click ripple effect, slow deliberate pacing
 * Output: demo-output/variation-shield-demo.mp4
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://app.leveragedsystems.com.au';
const EMAIL = 'bob@email.com';
const PASSWORD = 'DemoPass2026!';

const OUTPUT_DIR = path.join(__dirname, 'demo-output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Inject visible cursor + click ripple into the page
async function injectCursor(page) {
  await page.addStyleTag({ content: `
    * { cursor: none !important; }

    #demo-cursor {
      position: fixed;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.95);
      border: 2.5px solid #1B365D;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      pointer-events: none;
      z-index: 999999;
      transform: translate(-50%, -50%);
      transition: transform 0.08s ease, width 0.08s ease, height 0.08s ease;
    }

    #demo-cursor.clicking {
      transform: translate(-50%, -50%) scale(0.75);
      background: rgba(27, 54, 93, 0.9);
    }

    .demo-ripple {
      position: fixed;
      border-radius: 50%;
      background: rgba(27, 54, 93, 0.25);
      pointer-events: none;
      z-index: 999998;
      transform: translate(-50%, -50%) scale(0);
      animation: rippleOut 0.45s ease-out forwards;
    }

    @keyframes rippleOut {
      0%   { transform: translate(-50%, -50%) scale(0); opacity: 1; width: 20px; height: 20px; }
      100% { transform: translate(-50%, -50%) scale(4); opacity: 0; width: 20px; height: 20px; }
    }
  `});

  await page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    document.body.appendChild(cursor);

    document.addEventListener('mousemove', e => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top  = e.clientY + 'px';
    });

    document.addEventListener('mousedown', e => {
      cursor.classList.add('clicking');
      const ripple = document.createElement('div');
      ripple.className = 'demo-ripple';
      ripple.style.left = e.clientX + 'px';
      ripple.style.top  = e.clientY + 'px';
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    });

    document.addEventListener('mouseup', () => {
      cursor.classList.remove('clicking');
    });
  });
}

// Move mouse to element, pause, then click — human-like
async function humanClick(page, locator, pauseMs = 400) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) { await locator.click(); return; }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 20 });
  await sleep(pauseMs);
  await page.mouse.down();
  await sleep(80);
  await page.mouse.up();
  await sleep(200);
}

// Type slowly with visible keystroke delays
async function humanType(page, locator, text, delayMs = 55) {
  await humanClick(page, locator, 300);
  await sleep(200);
  for (const char of text) {
    await page.keyboard.type(char);
    await sleep(delayMs + Math.random() * 35);
  }
}

(async () => {
  console.log('🎬 Launching browser...');

  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1280,800'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1280, height: 800 },
    },
  });

  const page = await context.newPage();

  // Inject cursor on every navigation
  page.on('load', () => injectCursor(page).catch(() => {}));

  try {
    // ── STEP 1: Login ───────────────────────────────────────
    console.log('📋 Step 1: Login');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await injectCursor(page);

    // Move cursor to email field, type
    const emailInput = page.locator('input[type="email"]');
    await humanType(page, emailInput, EMAIL, 60);
    await sleep(500);

    const passInput = page.locator('input[type="password"]');
    await humanType(page, passInput, PASSWORD, 60);
    await sleep(700);

    // Click sign in button
    const signInBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();
    await humanClick(page, signInBtn, 500);

    await page.waitForURL('**/', { timeout: 15000 });
    await sleep(800);
    await injectCursor(page);

    // ── STEP 2: Pause on Dashboard ──────────────────────────
    console.log('📋 Step 2: Dashboard');
    // Slowly move mouse across the dashboard to show it off
    await page.mouse.move(640, 300, { steps: 40 });
    await sleep(800);
    await page.mouse.move(400, 400, { steps: 30 });
    await sleep(600);
    await page.mouse.move(900, 250, { steps: 30 });
    await sleep(1200);

    // ── STEP 3: Create New Project ──────────────────────────
    console.log('📋 Step 3: Create project');
    const newProjectBtn = page.locator('button', { hasText: 'New Project' }).first();
    await humanClick(page, newProjectBtn, 600);

    await page.waitForSelector('input[placeholder*="Northern Hospital"]', { timeout: 10000 });
    await sleep(600);

    // Fill project name
    const projectNameInput = page.locator('input[placeholder*="Northern Hospital"]');
    await humanType(page, projectNameInput, 'Northern Hospital — Ward Extension', 65);
    await sleep(600);

    // Fill client name
    const clientInput = page.locator('input[placeholder*="Lendlease"]');
    await humanType(page, clientInput, 'Buildcorp Construction', 60);
    await sleep(800);

    // Click Create Project
    const createProjectBtn = page.locator('button:has-text("Create Project")');
    await humanClick(page, createProjectBtn, 500);
    await sleep(2500);

    // ── STEP 4: Open the new project ───────────────────────
    console.log('📋 Step 4: Open project');
    const projectRow = page.locator('text=Northern Hospital — Ward Extension').first();
    await humanClick(page, projectRow, 600);
    await page.waitForURL('**/project/**', { timeout: 10000 });
    await sleep(800);
    await injectCursor(page);
    await sleep(1500);

    // Pan mouse across project page
    await page.mouse.move(640, 350, { steps: 30 });
    await sleep(800);

    // ── STEP 5: Create New Variation ───────────────────────
    console.log('📋 Step 5: New variation');
    const newVarBtn = page.locator('button', { hasText: 'New Variation' }).first();
    await humanClick(page, newVarBtn, 600);

    const titleInput = page.locator('input[placeholder*="Additional fire dampers"]');
    await titleInput.waitFor({ state: 'visible', timeout: 8000 });
    await sleep(500);

    // Fill title
    await humanType(page, titleInput, 'Additional concrete pour — unexpected ground conditions', 55);
    await sleep(600);

    // Instructed by
    const instructedByInput = page.locator('input[placeholder="e.g. John Smith"]');
    await humanType(page, instructedByInput, 'James Wheeler', 60);
    await sleep(500);

    // Estimated value
    const valueInput = page.locator('input[placeholder="0.00"]');
    await humanClick(page, valueInput, 400);
    await sleep(200);
    await page.keyboard.type('45000', { delay: 80 });
    await sleep(600);

    // Source dropdown
    try {
      const select = page.locator('select').first();
      await humanClick(page, select, 400);
      await sleep(300);
      await select.selectOption('verbal');
      await sleep(400);
    } catch { /* skip */ }

    // Description — scroll into view first
    const descField = page.locator('textarea[placeholder="Describe the scope change..."]');
    await descField.scrollIntoViewIfNeeded();
    await sleep(300);
    await humanType(page, descField,
      'Site supervisor directed additional concrete pour to Level 2 slab due to unexpected ground conditions. Scope outside original contract.',
      30
    );
    await sleep(700);

    // Submit
    const createVarBtn = page.locator('button:has-text("Create Variation")');
    await humanClick(page, createVarBtn, 600);
    await sleep(3000);

    // ── STEP 6: Open the variation ─────────────────────────
    console.log('📋 Step 6: View variation');
    try {
      const varRow = page.locator('text=Additional concrete pour').first();
      await humanClick(page, varRow, 600);
      await page.waitForURL('**/variation/**', { timeout: 10000 });
      await sleep(800);
      await injectCursor(page);

      // Scroll down slowly to show the full variation detail
      await sleep(1000);
      await page.mouse.move(640, 400, { steps: 20 });
      await sleep(800);
      await page.mouse.wheel(0, 300);
      await sleep(1200);
      await page.mouse.wheel(0, 300);
      await sleep(2000);
    } catch {
      console.log('Could not navigate to variation — staying on project page');
      await sleep(2000);
    }

    // ── FINAL: Linger ──────────────────────────────────────
    console.log('📋 Done — saving...');
    await sleep(2000);

  } catch (err) {
    console.error('❌ Error at step:', err.message);
  }

  await context.close();
  await browser.close();

  // Rename video
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.webm'));
  if (files.length > 0) {
    const src = path.join(OUTPUT_DIR, files[files.length - 1]);
    const dest = path.join(OUTPUT_DIR, 'variation-shield-demo.webm');
    if (src !== dest) fs.renameSync(src, dest);
    console.log(`✅ WebM saved: ${dest}`);
    console.log('Converting to MP4...');

    const { execSync } = require('child_process');
    try {
      execSync(`ffmpeg -y -i "${dest}" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p "${path.join(OUTPUT_DIR, 'variation-shield-demo.mp4')}" 2>/dev/null`);
      console.log(`✅ MP4 saved: ${path.join(OUTPUT_DIR, 'variation-shield-demo.mp4')}`);
    } catch (e) {
      console.log('ffmpeg conversion failed — use the .webm file');
    }
  }
})();
