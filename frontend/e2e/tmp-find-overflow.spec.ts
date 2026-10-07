import { test } from '@playwright/test';
import { login } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });

test('find overflow', async ({ page }) => {
  await login(page, 'admin@demo.com', 'admin123');
  await page.goto('/configuracoes');
  await page.waitForLoadState('networkidle');
  const bad = await page.evaluate(function () {
    const out = [];
    document.querySelectorAll('body *').forEach(function (el) {
      const r = el.getBoundingClientRect();
      const pos = getComputedStyle(el).position;
      if (pos === 'fixed') return;
      if (r.bottom > window.innerHeight + 1 && r.height > 0) {
        out.push(el.tagName + '.' + (el.className.baseVal !== undefined ? el.className.baseVal : el.className) + ' bottom=' + Math.round(r.bottom));
      }
    });
    return out.slice(0, 20);
  });
  console.log('CULPRITS ' + JSON.stringify(bad));
});
