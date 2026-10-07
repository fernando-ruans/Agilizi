import { test } from '@playwright/test';
import { login } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });

test('outside-main', async ({ page }) => {
  await login(page, 'admin@demo.com', 'admin123');
  await page.goto('/configuracoes');
  await page.waitForLoadState('networkidle');
  const info = await page.evaluate(function () {
    const out = [];
    document.querySelectorAll('body *').forEach(function (el) {
      if (el.closest('main')) return;
      const pos = getComputedStyle(el).position;
      if (pos === 'fixed') return;
      const bottom = el.offsetTop + el.offsetHeight;
      if (bottom > 801) out.push(el.tagName + '.' + String(el.className).slice(0, 90) + ' bottom=' + bottom);
    });
    return out.slice(0, 15);
  });
  console.log('O ' + JSON.stringify(info));
});
