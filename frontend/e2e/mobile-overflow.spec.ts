import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });

async function expectNoPageOverflow(page: Page, root = 'main') {
  await expect(page.locator(root).first()).toBeVisible();
  const overflow = await page.evaluate(function () {
    return document.documentElement.scrollWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('Mobile sem rolagem horizontal (públicas)', () => {
  test('/login cabe em 360px', async ({ page }) => {
    await page.goto('/login');
    await expectNoPageOverflow(page, 'form');
  });

  test('/register cabe em 360px', async ({ page }) => {
    await page.goto('/register');
    await expectNoPageOverflow(page, 'form');
  });
});

test.describe('Mobile sem rolagem horizontal (autenticadas)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
  });

  const routes = [
    '/dashboard',
    '/clientes',
    '/fornecedores',
    '/produtos',
    '/servicos',
    '/vendas',
    '/orcamentos',
    '/ordens-servico',
    '/caixa',
    '/despesas',
    '/relatorios',
    '/configuracoes',
    '/perfil',
  ];

  for (const route of routes) {
    test('sem overflow em ' + route, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expectNoPageOverflow(page);
    });
  }

  test('shell: documento não rola e rodapé fica preso', async ({ page }) => {
    await page.goto('/configuracoes');
    await page.waitForLoadState('networkidle');
    // A rolagem de usuário (roda do mouse/toque) pertence só ao <main>;
    // o documento não pode se mover nem tirar o rodapé da base.
    await page.mouse.move(180, 40);
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(400);
    const info = await page.evaluate(function () {
      const f = document.querySelector('footer').getBoundingClientRect();
      return { scrollY: window.scrollY, footerBottom: Math.round(f.bottom), innerHeight: window.innerHeight };
    });
    expect(info.scrollY).toBe(0);
    expect(info.footerBottom).toBe(info.innerHeight);
  });

  test('dashboard com Personalizado aberto', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const custom = page.getByRole('button', { name: /Personalizado/ }).first();
    if (await custom.isVisible()) await custom.click();
    await expectNoPageOverflow(page);
  });
});
