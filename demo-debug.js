const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://app.leveragedsystems.com.au';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'bob@email.com');
  await page.fill('input[type="password"]', 'DemoPass2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));

  // Screenshot of dashboard
  await page.screenshot({ path: '/tmp/debug-1-dashboard.png', fullPage: false });
  console.log('📸 Dashboard screenshot saved');

  // Try clicking New Project
  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons visible:', buttons);

  // Click the button
  try {
    await page.click('button:has-text("New Project")', { timeout: 5000 });
    console.log('✅ Clicked New Project');
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: '/tmp/debug-2-after-click.png', fullPage: false });
    console.log('📸 After click screenshot saved');

    // What inputs are visible?
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      const ph = await input.getAttribute('placeholder');
      const visible = await input.isVisible();
      console.log(`Input: placeholder="${ph}" visible=${visible}`);
    }
  } catch (e) {
    console.log('❌ Could not click:', e.message);
    await page.screenshot({ path: '/tmp/debug-2-error.png', fullPage: false });
  }

  await browser.close();
})();
