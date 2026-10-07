import { test } from '@playwright/test';
import { login } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });

test('layout-pos', async ({ page }) => {
  await login(page, 'admin@demo.com', 'admin123');
  await page.goto('/configuracoes');
  await page.waitForLoadState('networkidle');
  const info = await page.evaluate(function () {
    const out = [];
    let max = 0; let maxEl = '';
    document.querySelectorAll('body *').forEach(function (el) {
      const pos = getComputedStyle(el).position;
      if (pos === 'fixed') return;
      const bottom = el.offsetTop + el.offsetHeight;
      if (bottom > max) { max = bottom; maxEl = el.tagName + '.' + String(el.className).slice(0, 100); }
    });
    window.scrollTo(0, 1000);
    return { maxBottom: max, maxEl: maxEl, scrollY: window.scrollY, docH: document.documentElement.scrollHeight };
  });
  console.log('L ' + JSON.stringify(info));
});
