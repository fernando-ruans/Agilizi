import { test } from '@playwright/test';
import { login } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });

test('measure', async ({ page }) => {
  await login(page, 'admin@demo.com', 'admin123');
  await page.goto('/configuracoes');
  await page.waitForLoadState('networkidle');
  const info = await page.evaluate(function () {
    function rect(sel) {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), cls: String(el.className).slice(0, 80) };
    }
    const root = document.getElementById('root');
    const kids = root ? Array.prototype.map.call(root.children, function (c) { const r = c.getBoundingClientRect(); return c.tagName + ' top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom); }) : [];
    return { rootKids: kids, main: rect('main'), footer: rect('footer'), app: rect('#root > div'), scrolling: document.scrollingElement && document.scrollingElement.tagName };
  });
  console.log('M ' + JSON.stringify(info));
});
