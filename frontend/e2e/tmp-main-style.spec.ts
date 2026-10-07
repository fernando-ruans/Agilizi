import { test } from '@playwright/test';
import { login } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });

test('main-style', async ({ page }) => {
  await login(page, 'admin@demo.com', 'admin123');
  await page.goto('/configuracoes');
  await page.waitForLoadState('networkidle');
  const info = await page.evaluate(function () {
    const main = document.querySelector('main');
    const cs = getComputedStyle(main);
    const col = main.parentElement;
    const ccs = getComputedStyle(col);
    return { ox: cs.overflowX, oy: cs.overflowY, mh: cs.minHeight, h: cs.height, clientH: main.clientHeight, scrollH: main.scrollHeight, colH: ccs.height, colMinH: ccs.minHeight, colOy: ccs.overflowY };
  });
  console.log('S ' + JSON.stringify(info));
});
