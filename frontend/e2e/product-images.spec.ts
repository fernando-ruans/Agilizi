import { test, expect } from '@playwright/test';
import { login, field } from './helpers';

// 1×1 transparent PNG
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test.describe('Imagens de produto', () => {
  test('anexa imagem, mostra thumbnail e permite excluir', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/produtos');
    await expect(page.getByRole('heading', { name: 'Produtos' })).toBeVisible();

    const productName = `Produto com foto ${Date.now()}`;
    await page.getByRole('button', { name: /Novo Produto/ }).click();
    await field(page, 'Nome').fill(productName);
    // Label has regex metacharacters "(R$)" — target the input's id instead
    await page.locator('#product-price').fill('49.90');
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText('Produto criado')).toBeVisible({ timeout: 8_000 });

    // Product created — open its edit modal (uploader needs the saved id)
    const row = page.locator('tr', { hasText: productName });
    await row.getByTitle('Editar').click();
    await expect(page.getByText('Editar produto')).toBeVisible();

    // Upload the fixture
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    });
    await expect(page.getByText('Imagem adicionada')).toBeVisible({ timeout: 8_000 });

    // Thumbnail appears in the uploader grid (page-level: modal scoping is brittle)
    const thumb = page.getByRole('img', { name: 'foto.png' });
    await expect(thumb).toBeVisible();

    // Close modal → thumbnail now shows in the table row
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(row.locator('img').first()).toBeVisible();

    // Reopen and delete the image
    await row.getByTitle('Editar').click();
    await page.getByRole('button', { name: /Excluir imagem/i }).click();
    await expect(page.getByText('Imagem removida')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('img', { name: 'foto.png' })).toHaveCount(0);
  });

  test('uploader bloqueia salvar imagem antes do produto existir', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await page.goto('/produtos');

    await page.getByRole('button', { name: /Novo Produto/ }).click();
    await expect(page.getByText('Salve o produto para adicionar imagens.')).toBeVisible();
    // File input is disabled while the product does not exist yet
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
  });
});
