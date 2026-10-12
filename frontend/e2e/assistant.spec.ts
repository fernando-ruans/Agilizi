import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Assistente de IA', () => {
  test('sem chave de IA, o painel mostra estado desativado', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.getByRole('button', { name: 'Abrir assistente de IA' }).click();
    await expect(page.getByRole('dialog', { name: 'Assistente de IA' })).toBeVisible();
    await expect(page.getByText(/assistente está desativado/)).toBeVisible();
  });

  test('conversas persistem por empresa via API', async ({ page }) => {
    await login(page, 'admin@demo.com', 'admin123');
    const token = await page.evaluate(() => localStorage.getItem('agilzi_token'));
    const headers = { Authorization: 'Bearer ' + token };

    const created = await page.request.post('http://localhost:5173/api/v1/assistant/threads', {
      headers,
      data: { title: 'Conversa E2E' },
    });
    expect(created.ok()).toBeTruthy();
    const thread = await created.json();
    const id = thread.data.id;

    const listed = await page.request.get('http://localhost:5173/api/v1/assistant/threads', { headers });
    const threads = (await listed.json()).data;
    expect(threads.map((t: any) => t.id)).toContain(id);

    const gone = await page.request.delete('http://localhost:5173/api/v1/assistant/threads/' + id, { headers });
    expect(gone.ok()).toBeTruthy();
  });
});
