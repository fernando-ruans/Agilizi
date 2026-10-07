import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });

test('footer debug', async ({ page }) => {
  await login(page, 'admin@demo.com', 'admin123');
  await page.goto('/configuracoes');
  await page.waitForLoadState('networkidle');
  const info = await page.evaluate(function () {
    const footer = document.querySelector('footer');
    const r = footer ? footer.getBoundingClientRect() : null;
    return { footerTop: r && r.top, footerBottom: r && r.bottom, innerHeight: window.innerHeight, bodyH: document.body.scrollHeight, docH: document.documentElement.scrollHeight };
  });
  console.log('INFO ' + JSON.stringify(info));
  await page.screenshot({ path: 'test-results/footer-debug.png', fullPage: false });
});
